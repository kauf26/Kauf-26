import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveListingSession, type MatchType } from '@/lib/pendingAnalysis';

const MAX_EXPORT_DIM = 1280;
const JPEG_QUALITY = 0.95;

type CropRegion = { x: number; y: number; w: number; h: number };

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Crop (normalized 0–1), scale to max 1280px, JPEG q=0.95 */
async function encodeForApi(
  sourceDataUrl: string,
  crop: CropRegion
): Promise<string> {
  const img = await loadImage(sourceDataUrl);
  const sx = Math.round(img.width * crop.x);
  const sy = Math.round(img.height * crop.y);
  const sw = Math.max(1, Math.round(img.width * crop.w));
  const sh = Math.max(1, Math.round(img.height * crop.h));

  let outW = sw;
  let outH = sh;
  const maxSide = Math.max(outW, outH);
  if (maxSide > MAX_EXPORT_DIM) {
    const scale = MAX_EXPORT_DIM / maxSide;
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [rawCapture, setRawCapture] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRegion>({ x: 0, y: 0, w: 1, h: 1 });
  const [identifyFailed, setIdentifyFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setIdentifyFailed(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
        audio: false,
      });
      await applyFocusExposure(mediaStream);
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

  const directImageScrape = async () => {
    const source = rawCapture ?? capturedImage;
    if (!source) return;
    setIsLoading(true);
    setError(null);
    setIdentifyFailed(false);

    try {
      const encoded = await encodeForApi(source, crop);
      setCapturedImage(encoded);
      console.log('📸 Sending camera image to /api/identify...');
      const result = await sendImageToScraper(encoded);
      console.log('✅ Identify result:', result);

      persistPendingAnalysisFromIdentify(result);

      if (result.draftId != null) {
        console.log('Draft saved with ID:', result.draftId);
      }

      onScrapeSuccess?.(result);
      navigate('/product-draft');
    } catch (err) {
      setIdentifyFailed(true);
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

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    canvasRef.current.width = vw;
    canvasRef.current.height = vh;
    context.drawImage(videoRef.current, 0, 0, vw, vh);
    const fullRes = canvasRef.current.toDataURL('image/jpeg', JPEG_QUALITY);
    setRawCapture(fullRes);
    setCapturedImage(fullRes);
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
    setIdentifyFailed(false);
    setError(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const resetCamera = () => {
    setRawCapture(null);
    setCapturedImage(null);
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
    setIdentifyFailed(false);
    setError(null);
    startCamera();
  };

  const retakeAfterFailure = () => {
    setIdentifyFailed(false);
    setError(null);
    setCapturedImage(null);
    startCamera();
  };

  useEffect(() => {
    startCamera();
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
        <>
          {!stream ? (
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
                onClick={capturePhoto}
                disabled={isLoading}
                className="w-full py-3 bg-emerald-600 rounded font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                Capture Photo
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <img
            src={capturedImage}
            alt="Captured preview"
            className="w-full rounded border border-zinc-700"
          />

          <div className="rounded border border-zinc-800 bg-zinc-950/80 p-3 space-y-3">
            <p className="text-xs text-zinc-400">
              Adjust crop to focus on logos, dial text, or serial numbers (optional).
            </p>
            <label className="block text-xs text-zinc-500">
              Crop left %{' '}
              <input
                type="range"
                min={0}
                max={80}
                value={Math.round(crop.x * 100)}
                onChange={(e) =>
                  setCrop((c) => ({ ...c, x: Number(e.target.value) / 100 }))
                }
                className="w-full"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Crop top %{' '}
              <input
                type="range"
                min={0}
                max={80}
                value={Math.round(crop.y * 100)}
                onChange={(e) =>
                  setCrop((c) => ({ ...c, y: Number(e.target.value) / 100 }))
                }
                className="w-full"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Crop width %{' '}
              <input
                type="range"
                min={20}
                max={100}
                value={Math.round(crop.w * 100)}
                onChange={(e) =>
                  setCrop((c) => ({ ...c, w: Number(e.target.value) / 100 }))
                }
                className="w-full"
              />
            </label>
            <label className="block text-xs text-zinc-500">
              Crop height %{' '}
              <input
                type="range"
                min={20}
                max={100}
                value={Math.round(crop.h * 100)}
                onChange={(e) =>
                  setCrop((c) => ({ ...c, h: Number(e.target.value) / 100 }))
                }
                className="w-full"
              />
            </label>
          </div>

          {identifyFailed && (
            <p className="text-xs text-amber-400/90">
              Identification failed. Retake a sharper photo or tighten the crop on small
              text, then try again.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex gap-4">
              <button
                onClick={identifyFailed ? retakeAfterFailure : resetCamera}
                disabled={isLoading}
                className="flex-1 py-4 bg-zinc-800 rounded font-semibold hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                Retake photo
              </button>
              <button
                onClick={() => void directImageScrape()}
                disabled={isLoading}
                className="flex-1 py-4 bg-blue-600 rounded font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors"
              >
                {isLoading ? 'Identifying...' : 'Identify product'}
              </button>
            </div>
            {isLoading && (
              <p className="text-center text-xs text-zinc-400">Analyzing photo…</p>
            )}
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ProductCamera;
