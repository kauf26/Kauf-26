import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveListingSession, type MatchType } from '@/lib/pendingAnalysis';

const MAX_EXPORT_DIM = 1280;
const JPEG_QUALITY = 0.9;
const BURST_FRAME_COUNT = 3;
const BURST_FRAME_DELAY_MS = 100;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Variance of Laplacian — higher = sharper */
function laplacianVariance(imageData: ImageData): number {
  const { width, height, data } = imageData;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const c =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const l = (y * width + (x - 1)) * 4;
      const r = (y * width + (x + 1)) * 4;
      const t = ((y - 1) * width + x) * 4;
      const b = ((y + 1) * width + x) * 4;
      const grayL =
        0.299 * data[l] + 0.587 * data[l + 1] + 0.114 * data[l + 2];
      const grayR =
        0.299 * data[r] + 0.587 * data[r + 1] + 0.114 * data[r + 2];
      const grayT =
        0.299 * data[t] + 0.587 * data[t + 1] + 0.114 * data[t + 2];
      const grayB =
        0.299 * data[b] + 0.587 * data[b + 1] + 0.114 * data[b + 2];
      const lap = 4 * c - grayT - grayB - grayL - grayR;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function drawVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): { score: number; width: number; height: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(video, 0, 0, vw, vh);
  const score = laplacianVariance(ctx.getImageData(0, 0, vw, vh));
  return { score, width: vw, height: vh };
}

/** Full frame → max 1280px, JPEG q=0.9 */
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

async function captureSharpestFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<string> {
  let bestScore = -1;
  let bestSnapshot: ImageData | null = null;
  let w = 0;
  let h = 0;

  for (let i = 0; i < BURST_FRAME_COUNT; i++) {
    if (i > 0) await sleep(BURST_FRAME_DELAY_MS);
    const { score, width, height } = drawVideoFrame(video, canvas);
    if (score > bestScore) {
      bestScore = score;
      w = width;
      h = height;
      bestSnapshot = canvas.getContext('2d')!.getImageData(0, 0, width, height);
    }
  }

  if (!bestSnapshot) throw new Error('Could not capture frame');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(bestSnapshot, 0, 0);
  return encodeCanvasForApi(canvas);
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

  const identifyFromCapture = async (imageDataUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('📸 Sending camera image to /api/identify...');
      const result = await sendImageToScraper(imageDataUrl);
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
    setIsLoading(true);

    try {
      const imageDataUrl = await captureSharpestFrame(
        videoRef.current,
        canvasRef.current
      );
      stopStream();
      await identifyFromCapture(imageDataUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not capture photo.'
      );
      setIsLoading(false);
    }
  };

  const retake = () => {
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

      {!stream ? (
        <button
          onClick={startCamera}
          className="w-full py-3 bg-blue-600 rounded font-semibold hover:bg-blue-500 transition-colors"
        >
          Start Camera
        </button>
      ) : (
        <div className="space-y-4 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded border border-zinc-700 bg-black"
          />
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded bg-black/70">
              <div className="h-10 w-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="mt-3 text-sm text-zinc-300">Identifying product…</p>
            </div>
          )}
          <button
            onClick={() => void capturePhoto()}
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 rounded font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
          >
            {isLoading ? 'Identifying…' : 'Capture Photo'}
          </button>
        </div>
      )}

      {error && !stream && !isLoading && (
        <button
          onClick={retake}
          className="w-full py-3 bg-zinc-800 rounded font-semibold hover:bg-zinc-700 transition-colors"
        >
          Retake
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ProductCamera;
