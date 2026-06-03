import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveToDraftStorage } from './masterScraperBridge';

type IdentifyApiResponse = {
  success?: boolean;
  draftId?: number | string;
  isExactMatch?: boolean;
  product?: {
    title?: string;
    description?: string;
    price?: string | number;
    brand?: string;
    category?: string;
    condition?: string;
    allegroAvg?: string | number;
    ebayAvg?: string | number;
    capturedImage?: string;
    isExactMatch?: boolean;
  };
};

/** Persist Task A shape for ProductDraft: reads `data.product` */
function persistPendingAnalysisFromIdentify(result: IdentifyApiResponse) {
  if (!result?.product) {
    throw new Error('Identify response missing product');
  }
  sessionStorage.setItem(
    'pendingAnalysis',
    JSON.stringify({
      product: result.product,
      draftId: result.draftId,
      isExactMatch: result.isExactMatch ?? result.product.isExactMatch ?? false,
    })
  );
}

interface ProductCameraProps {
  onScrapeSuccess?: (result: IdentifyApiResponse) => void;
}

const ProductCamera: React.FC<ProductCameraProps> = ({ onScrapeSuccess }) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const imageData = canvasRef.current.toDataURL('image/jpeg');
    setCapturedImage(imageData);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const resetCamera = () => {
    setCapturedImage(null);
    startCamera();
  };

  const sendImageToScraper = async (imageBase64: string, productTitle?: string) => {
    const response = await fetch(imageBase64);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append('image', blob, 'camera-capture.jpg');
    formData.append('title', productTitle || "Camera Captured Product");

    const res = await fetch('/api/identify', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error('Failed to process image with scraper');
    }

    return res.json() as Promise<IdentifyApiResponse>;
  };

  const identifyProduct = async () => {
    if (!capturedImage) return;
    setIsLoading(true);
    setError(null);

    try {
      const productQuery = prompt("Enter product name to search for:", "Apple Watch Series 8");
      if (!productQuery) {
        setError("Product name is required for search.");
        return;
      }

      const result = await sendImageToScraper(capturedImage, productQuery);
      persistPendingAnalysisFromIdentify(result);

      await saveToDraftStorage(result.product);
      onScrapeSuccess?.(result);
      navigate('/product-draft');
    } catch (err) {
      setError('Failed to identify product. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const directImageScrape = async () => {
    if (!capturedImage) return;
    setIsLoading(true);
    setError(null);

    try {
      console.log("📸 Sending camera image to /api/identify...");
      const result = await sendImageToScraper(capturedImage, "Live Camera Scan");
      console.log("✅ Identify result:", result);

      persistPendingAnalysisFromIdentify(result);

      if (result.draftId != null) {
        console.log("Draft saved with ID:", result.draftId);
      }

      onScrapeSuccess?.(result);
      navigate('/product-draft');
    } catch (err) {
      setError('Failed to process image with scraper.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    startCamera();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-lg text-white space-y-4">
      <h1 className="text-xl font-bold tracking-tight">KAUF26 Scanner Node</h1>
      {error && <div className="bg-red-950/40 border border-red-900 text-red-400 px-3 py-2 text-xs rounded">{error}</div>}

      {!capturedImage ? (
        <>
          {!stream ? (
            <button onClick={startCamera} className="w-full py-3 bg-blue-600 rounded font-semibold hover:bg-blue-500 transition-colors">
              Start Camera
            </button>
          ) : (
            <div className="space-y-4">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded border border-zinc-700 bg-black" />
              <button onClick={capturePhoto} className="w-full py-3 bg-emerald-600 rounded font-semibold hover:bg-emerald-500 transition-colors">
                Capture Photo
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <img src={capturedImage} alt="Captured preview" className="w-full rounded border border-zinc-700" />
          <div className="flex flex-col gap-3">
            <div className="flex gap-4">
              <button onClick={resetCamera} className="flex-1 py-4 bg-zinc-800 rounded font-semibold hover:bg-zinc-700 transition-colors">
                Retake
              </button>
              <button onClick={identifyProduct} disabled={isLoading} className="flex-1 py-4 bg-blue-600 rounded font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors">
                {isLoading ? 'Identifying...' : 'Text Search'}
              </button>
            </div>
            <button onClick={directImageScrape} disabled={isLoading} className="w-full py-4 bg-purple-600 rounded font-semibold hover:bg-purple-500 disabled:opacity-40 transition-colors">
              {isLoading ? 'Scraping...' : '📸 Camera → Scraper'}
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ProductCamera;
