import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveListingSession, type MatchType } from '@/lib/pendingAnalysis';

const MAX_EXPORT_DIM = 1024;
const JPEG_QUALITY = 0.85;

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  facingMode: 'environment',
  focusMode: { ideal: 'continuous' },
  exposureMode: { ideal: 'continuous' },
} as MediaTrackConstraints;

async function applyFocusExposure(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track?.applyConstraints) return;
  try {
    await track.applyConstraints({
      advanced: [
        { focusMode: 'continuous' },
        { exposureMode: 'continuous' },
      ] as unknown as MediaTrackConstraintSet[],
    });
  } catch {
    /* optional — ignore if unsupported */
  }
}

function captureVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(video, 0, 0, vw, vh);
}

/** Full frame → max 1024px longest side, JPEG q=0.85 */
function encodeCanvasForApi(canvas: HTMLCanvasElement): Promise<string> {
  let outW = canvas.width;
  let outH = canvas.height;
  const maxSide = Math.max(outW, outH);
  if (maxSide > MAX_EXPORT_DIM) {
    const scale = MAX_EXPORT_DIM / maxSide;
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas not supported'));
  ctx.drawImage(canvas, 0, 0, outW, outH);
  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

type IdentifyApiResponse = {
  success?: boolean;
  draftId?: number | string;
  isExactMatch?: boolean;
  matchType?: MatchType;
  product?: {
    title?: string;
    description?: string;
    price?: string | number;
    brand?: string;
    category?: string;
    condition?: string;
    material?: string;
    color?: string;
    style?: string;
    allegroAvg?: string | number;
    ebayAvg?: string | number;
    capturedImage?: string;
    isExactMatch?: boolean;
    matchType?: MatchType;
    priceReliable?: boolean;
  };
  priceReliable?: boolean;
};

/** Persist Task A shape for ProductDraft: reads `data.product` */
function persistPendingAnalysisFromIdentify(result: IdentifyApiResponse) {
  if (!result?.product) {
    throw new Error('Identify response missing product');
  }
  const p = result.product;
  const matchType: MatchType =
    result.matchType ??
    p.matchType ??
    ((result.isExactMatch ?? p.isExactMatch) ? 'exact' : 'generic');
  const isExactMatch = matchType === 'exact';
  saveListingSession({
    title: p.title ?? '',
    description: p.description ?? '',
    price: String(p.price ?? 0),
    brand: p.brand ?? '',
    category: p.category ?? '',
    condition: p.condition ?? 'Used',
    material: p.material ?? '',
    color: p.color ?? '',
    style: p.style ?? '',
    capturedImage: p.capturedImage ?? '',
    isExactMatch,
    matchType,
    priceReliable: result.priceReliable === true || p.priceReliable === true,
    product: {
      title: p.title ?? '',
      description: p.description ?? '',
      price: String(p.price ?? 0),
      brand: p.brand ?? '',
      category: p.category ?? '',
      condition: p.condition ?? 'Used',
      material: p.material ?? '',
      color: p.color ?? '',
      style: p.style ?? '',
      capturedImage: p.capturedImage ?? '',
      allegroAvg: String(p.allegroAvg ?? p.price ?? 0),
      ebayAvg: String(p.ebayAvg ?? p.price ?? 0),
      isExactMatch,
      matchType,
      priceReliable: result.priceReliable === true || p.priceReliable === true,
    },
  });
  if (result.draftId != null) {
    sessionStorage.setItem('identifyDraftId', String(result.draftId));
  }
}

interface ProductCameraProps {
  onScrapeSuccess?: (result: IdentifyApiResponse) => void;
}

const ProductCamera: React.FC<ProductCameraProps> = ({ onScrapeSuccess }) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => {
    const active = streamRef.current;
    if (active) {
      active.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: false,
      });
      await applyFocusExposure(mediaStream);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch {
      setError('Could not access camera. Please check permissions.');
    }
  };

  const sendImageToScraper = async (imageDataUrl: string) => {
    const blob = await dataUrlToBlob(imageDataUrl);

    const formData = new FormData();
    formData.append('image', blob, 'camera-capture.jpg');

    const res = await fetch('/api/identify', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { message?: string; error?: string }).message ||
          (body as { message?: string; error?: string }).error ||
          'Failed to process image with scraper'
      );
    }

    return res.json() as Promise<IdentifyApiResponse>;
  };

  const identify = async () => {
    if (!capturedImage) return;
    setIsLoading(true);
    setError(null);

    try {
      console.log('📸 Sending camera image to /api/identify...');
      const result = await sendImageToScraper(capturedImage);
      console.log('✅ Identify result:', result);

      persistPendingAnalysisFromIdentify(result);

      if (result.draftId != null) {
        console.log('Draft saved with ID:', result.draftId);
      }

      onScrapeSuccess?.(result);
      navigate('/product-draft');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to identify product. Please try again.'
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isLoading) return;
    setError(null);

    try {
      captureVideoFrame(videoRef.current, canvasRef.current);
      const imageDataUrl = await encodeCanvasForApi(canvasRef.current);
      stopStream();
      setCapturedImage(imageDataUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not capture photo.'
      );
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setError(null);
    startCamera();
  };

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-lg text-white space-y-4">
      <h1 className="text-xl font-bold tracking-tight">KAUF26 Scanner Node</h1>
      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 px-3 py-2 text-xs rounded">
          {error}
        </div>
      )}

      {!capturedImage ? (
        !stream ? (
          <button
            onClick={startCamera}
            className="w-full py-3 bg-blue-600 rounded font-semibold hover:bg-blue-500 transition-colors"
          >
            Start Camera
          </button>
        ) : (
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded border border-zinc-700 bg-black"
            />
            <button
              onClick={() => void capturePhoto()}
              disabled={isLoading}
              className="w-full py-3 bg-emerald-600 rounded font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            >
              Capture Photo
            </button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <img
            src={capturedImage}
            alt="Captured preview"
            className="w-full rounded border border-zinc-700"
          />
          {isLoading && (
            <p className="text-center text-sm text-zinc-400">Identifying product…</p>
          )}
          <div className="flex gap-4">
            <button
              onClick={retake}
              disabled={isLoading}
              className="flex-1 py-3 bg-zinc-800 rounded font-semibold hover:bg-zinc-700 disabled:opacity-40 transition-colors"
            >
              Retake
            </button>
            <button
              onClick={() => void identify()}
              disabled={isLoading}
              className="flex-1 py-3 bg-blue-600 rounded font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {isLoading ? 'Identifying…' : 'Identify'}
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ProductCamera;
