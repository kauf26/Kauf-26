import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveListingSession, type MatchType } from '@/lib/pendingAnalysis';

const MAX_IMAGES = 5;

const ANGLE_ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
] as const;
const MAX_EXPORT_DIM = 1024;
const JPEG_QUALITY = 0.85;

function CameraIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

type CaptureShutterButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label: string;
};

function CaptureShutterButton({
  onClick,
  disabled = false,
  label,
}: CaptureShutterButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={[
        'relative flex items-center justify-center',
        'w-[72px] h-[72px] min-w-[48px] min-h-[48px] rounded-full',
        'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40',
        'ring-4 ring-white/40 ring-offset-2 ring-offset-black/50',
        'transition-transform duration-150 ease-out',
        'hover:bg-emerald-400 active:bg-emerald-600',
        'disabled:opacity-40 disabled:pointer-events-none',
        'touch-manipulation select-none',
        pressed ? 'scale-95' : 'scale-100',
      ].join(' ')}
      style={{ padding: 16 }}
    >
      {pressed && (
        <span
          className="absolute inset-0 rounded-full bg-white/25 animate-ping"
          aria-hidden
        />
      )}
      <CameraIcon className="w-8 h-8 relative z-10" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

type MatchConfidence = 'low' | 'medium' | 'high';

type IdentifyApiResponse = {
  success?: boolean;
  draftId?: number | string;
  imagesProcessed?: number;
  sources?: Record<string, string>;
  message?: string;
  fallbackToVision?: boolean;
  listingsFound?: number;
  isExactMatch?: boolean;
  matchType?: MatchType;
  visionConfidence?: MatchConfidence;
  matchConfidence?: MatchConfidence;
  confidence?: MatchConfidence;
  matchScore?: number;
  timedOut?: boolean;
  verificationWarning?: string | null;
  requiresManualReview?: boolean;
  priceMin?: number | string | null;
  priceMax?: number | string | null;
  publishJobId?: number | null;
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
    capturedImages?: string[];
    isExactMatch?: boolean;
    matchType?: MatchType;
    priceReliable?: boolean;
    productUrl?: string;
    matchConfidence?: MatchConfidence;
  };
  productUrl?: string;
  priceReliable?: boolean;
};

function isExactMatchResult(result: IdentifyApiResponse): boolean {
  const matchType = result.matchType ?? result.product?.matchType;
  return (
    result.isExactMatch === true ||
    result.product?.isExactMatch === true ||
    matchType === 'exact'
  );
}

function shouldProceedToDraft(result: IdentifyApiResponse): boolean {
  if (result.success === true && result.draftId != null) return true;
  if (result.requiresManualReview === true) return true;
  if (result.fallbackToVision === true) return true;
  if (isExactMatchResult(result)) return true;
  const p = result.product;
  if (!p) return false;
  const price = parseFloat(String(p.price ?? 0));
  const reliable =
    result.priceReliable === true || p.priceReliable === true;
  const matchType = result.matchType ?? p.matchType;
  return (
    (matchType === 'similar' || matchType === 'exact') &&
    price > 0 &&
    reliable
  );
}

function persistPendingAnalysisFromIdentify(
  result: IdentifyApiResponse,
  capturedImages: string[]
) {
  if (!result?.product) {
    throw new Error('Identify response missing product');
  }
  const p = result.product;
  const primaryImage =
    p.capturedImage ?? capturedImages[0] ?? '';
  const matchType: MatchType =
    result.matchType ??
    p.matchType ??
    ((result.isExactMatch ?? p.isExactMatch) ? 'exact' : 'generic');
  const isExactMatch = matchType === 'exact';
  const warning = result.verificationWarning?.trim();
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
    capturedImage: primaryImage,
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
      capturedImage: primaryImage,
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
  if (capturedImages.length > 0) {
    sessionStorage.setItem(
      'identifyCapturedImages',
      JSON.stringify(capturedImages)
    );
  }
  if (warning) {
    sessionStorage.setItem('identifyVerificationWarning', warning);
  } else {
    sessionStorage.removeItem('identifyVerificationWarning');
  }
}

interface ProductCameraProps {
  onScrapeSuccess?: (result: IdentifyApiResponse) => void;
}

const ProductCamera: React.FC<ProductCameraProps> = ({ onScrapeSuccess }) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCapturingMore, setIsCapturingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
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

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startAnalyzeProgress = (total: number) => {
    clearProgressTimer();
    setAnalyzeStep(1);
    if (total <= 1) return;
    progressTimerRef.current = setInterval(() => {
      setAnalyzeStep((prev) => (prev < total ? prev + 1 : prev));
    }, 4500);
  };

  const sendImagesToIdentify = async (imageDataUrls: string[]) => {
    const formData = new FormData();
    for (let i = 0; i < imageDataUrls.length; i++) {
      const blob = await dataUrlToBlob(imageDataUrls[i]);
      formData.append('images', blob, `angle-${i + 1}.jpg`);
    }

    const res = await fetch('/api/identify', {
      method: 'POST',
      body: formData,
    });

    const body = (await res.json().catch(() => ({}))) as IdentifyApiResponse & {
      error?: string;
      message?: string;
    };

    if (body.success === true && body.draftId != null) {
      return body;
    }

    if (!res.ok) {
      throw new Error(
        body.message ||
          body.error ||
          'Failed to identify product. Please try again.'
      );
    }

    return body;
  };

  const goToDraft = (result: IdentifyApiResponse) => {
    persistPendingAnalysisFromIdentify(result, capturedImages);
    if (result.draftId != null) {
      console.log('Draft saved with ID:', result.draftId);
    }
    onScrapeSuccess?.(result);
    navigate('/product-draft');
  };

  const identify = async () => {
    if (capturedImages.length === 0) return;
    setIsLoading(true);
    setError(null);
    startAnalyzeProgress(capturedImages.length);

    try {
      console.log(
        `📸 Sending ${capturedImages.length} image(s) to /api/identify...`
      );
      const result = await sendImagesToIdentify(capturedImages);
      console.log('[Identify] API response:', JSON.stringify(result, null, 2));

      if (result.message && result.requiresManualReview) {
        console.log('[Identify]', result.message);
      }

      if (shouldProceedToDraft(result)) {
        goToDraft({
          ...result,
          verificationWarning:
            result.verificationWarning ??
            (result.requiresManualReview
              ? result.message ??
                'Product identified — please review pricing before posting.'
              : undefined),
        });
        return;
      }

      goToDraft({
        ...result,
        verificationWarning:
          result.message ??
          "Here's our match, please review before publishing.",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to identify product. Please try again.'
      );
      console.error(err);
    } finally {
      clearProgressTimer();
      setAnalyzeStep(0);
      setIsLoading(false);
    }
  };

  const addCapturedImage = (imageDataUrl: string) => {
    setCapturedImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev;
      return [...prev, imageDataUrl];
    });
    setIsCapturingMore(false);
    stopStream();
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isLoading) return;
    setError(null);

    try {
      captureVideoFrame(videoRef.current, canvasRef.current);
      const imageDataUrl = await encodeCanvasForApi(canvasRef.current);
      addCapturedImage(imageDataUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not capture photo.'
      );
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files?.length || isLoading) return;
    setError(null);

    try {
      const remaining = MAX_IMAGES - capturedImages.length;
      const selected = Array.from(files).slice(0, remaining);
      const dataUrls = await Promise.all(selected.map(fileToDataUrl));
      setCapturedImages((prev) => [...prev, ...dataUrls].slice(0, MAX_IMAGES));
      setIsCapturingMore(false);
      stopStream();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load image file.'
      );
    } finally {
      event.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const replaceImage = (index: number) => {
    removeImage(index);
    setIsCapturingMore(true);
    void startCamera();
  };

  const addAnotherAngle = () => {
    if (capturedImages.length >= MAX_IMAGES) return;
    setIsCapturingMore(true);
    void startCamera();
  };

  const retakeAll = () => {
    setCapturedImages([]);
    setIsCapturingMore(false);
    setError(null);
    void startCamera();
  };

  const showCamera =
    capturedImages.length === 0 || isCapturingMore;

  useEffect(() => {
    if (capturedImages.length === 0) {
      void startCamera();
    }
    return () => {
      clearProgressTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (showCamera && !stream && capturedImages.length < MAX_IMAGES) {
      void startCamera();
    }
  }, [showCamera, stream, capturedImages.length]);

  const angleLabel =
    capturedImages.length < ANGLE_ORDINALS.length
      ? ANGLE_ORDINALS[capturedImages.length]
      : `${capturedImages.length + 1}th`;

  const captureLabel =
    capturedImages.length === 0 ? 'Take Photo' : `Take ${angleLabel} photo`;

  return (
    <div className="flex flex-col h-full min-h-0 max-w-2xl mx-auto p-3 sm:p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-white space-y-3">
      <div className="shrink-0">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight">KAUF26 Scanner</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          For best results, take up to 5 photos: front, back, label/tag, and details.
        </p>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900 text-red-400 px-3 py-2 text-xs rounded">
          {error}
        </div>
      )}

      <input
        id="product-camera-file-input"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={isLoading}
        onChange={(e) => void handleFileUpload(e)}
      />

      {showCamera ? (
        !stream ? (
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <button
              type="button"
              onClick={() => void startCamera()}
              className="w-full min-h-[48px] py-4 bg-blue-600 rounded-xl font-bold text-lg hover:bg-blue-500 active:scale-[0.98] transition-transform"
            >
              Start Camera
            </button>
            <label
              htmlFor="product-camera-file-input"
              className={[
                'flex items-center justify-center gap-2 w-full min-h-[48px] py-4',
                'rounded-xl bg-zinc-800 font-bold text-lg text-white',
                'hover:bg-zinc-700 active:scale-[0.98] transition-transform cursor-pointer',
                isLoading ? 'opacity-40 pointer-events-none' : '',
              ].join(' ')}
            >
              <CameraIcon className="w-6 h-6" />
              Upload photo
            </label>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <p className="text-sm text-zinc-400 shrink-0 px-1">
              {capturedImages.length === 0
                ? 'Capture or upload your first photo.'
                : `Capture your ${angleLabel} angle (${capturedImages.length + 1}/${MAX_IMAGES}).`}
            </p>

            <div className="relative flex-1 min-h-[240px] sm:min-h-[320px] rounded-xl overflow-hidden bg-black border border-zinc-700">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div
                className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pt-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
                style={{
                  paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
                }}
              >
                <p className="text-white text-lg font-bold drop-shadow-md">
                  {captureLabel}
                </p>

                <CaptureShutterButton
                  onClick={() => void capturePhoto()}
                  disabled={isLoading}
                  label={captureLabel}
                />

                <label
                  htmlFor="product-camera-file-input"
                  className={[
                    'inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3',
                    'rounded-full bg-zinc-800/90 text-white text-sm font-semibold',
                    'border border-zinc-600 shadow-md',
                    'transition-all duration-150',
                    'hover:bg-zinc-700 active:scale-95 active:bg-zinc-600',
                    'cursor-pointer touch-manipulation select-none',
                    isLoading ? 'opacity-40 pointer-events-none' : '',
                  ].join(' ')}
                >
                  <CameraIcon className="w-5 h-5" />
                  Upload from gallery
                </label>

                {capturedImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCapturingMore(false);
                      stopStream();
                    }}
                    className="min-h-[44px] px-4 text-sm font-medium text-zinc-300 hover:text-white underline underline-offset-2"
                  >
                    Done adding angles
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {capturedImages.map((img, index) => (
              <div key={`${index}-${img.slice(0, 24)}`} className="relative group">
                <img
                  src={img}
                  alt={`Angle ${index + 1}`}
                  className="w-full aspect-square object-cover rounded border border-zinc-700"
                />
                <span className="absolute top-1 left-1 text-[10px] bg-black/70 px-1.5 py-0.5 rounded">
                  {index + 1}
                </span>
                <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => replaceImage(index)}
                    disabled={isLoading}
                    className="flex-1 text-[10px] py-1 bg-zinc-800/90 rounded"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    disabled={isLoading}
                    className="flex-1 text-[10px] py-1 bg-red-900/90 rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {capturedImages.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={addAnotherAngle}
              disabled={isLoading}
              className="w-full py-3 border border-dashed border-zinc-600 rounded font-semibold text-zinc-200 hover:border-zinc-400 hover:bg-zinc-800/50 disabled:opacity-40 transition-colors"
            >
              + Add another angle
            </button>
          )}

          {isLoading && (
            <p className="text-center text-sm text-zinc-400">
              Analyzing image {Math.min(analyzeStep || 1, capturedImages.length)}/
              {capturedImages.length}… this may take up to a minute.
            </p>
          )}

          <div className="flex gap-4">
            <button
              onClick={retakeAll}
              disabled={isLoading}
              className="flex-1 py-3 bg-zinc-800 rounded font-semibold hover:bg-zinc-700 disabled:opacity-40 transition-colors"
            >
              Start over
            </button>
            <button
              onClick={() => void identify()}
              disabled={isLoading}
              className="flex-1 py-3 bg-blue-600 rounded font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {isLoading
                ? 'Analyzing…'
                : capturedImages.length === 1
                  ? 'Identify'
                  : `Submit all (${capturedImages.length} photos)`}
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ProductCamera;
