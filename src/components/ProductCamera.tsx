import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ProductCamera: React.FC = () => {
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

const identifyProduct = async () => {
  if (!capturedImage) return;
  setIsLoading(true);
  setError(null);

  try {
    const res = await fetch(capturedImage);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append('image', blob, 'product.jpg');

    const response = await fetch('/api/identify', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('AI scraping engine identification failed.');

    const data = await response.json();

    // Preserving all fields returned from the backend scraper or providing safe fallbacks
    const productData = {
      capturedImage: data.capturedImage || capturedImage,
      title: data.title || 'Identified Product Reference',
      brand: data.brand || 'Detected Brand',
      category: data.category || 'Watches',
      condition: data.condition || 'New',
      modelNumber: data.modelNumber || 'Detected Model',
      material: data.material || 'Detected Material',
      description: data.description || 'No product description found.',
      price: data.recommendedPrice || '0.00',
      allegroAverage: data.allegroAverage || '0.00',
      ebayAverage: data.ebayAverage || '0.00'
    };

    // Save the full payload into memory
    sessionStorage.setItem('pendingAnalysis', JSON.stringify(productData));

    // Route to Step 2 (The Draft and Specifications page) instead of skipping to the end
    navigate('/product-draft');
  } catch (err) {
    setError('Failed to query image parameters. Please retry.');
    console.error(err);
  } finally {
    setIsLoading(false);
  }
};

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
        <div className="flex gap-4">
          <button onClick={resetCamera} className="flex-1 py-4 bg-zinc-800 rounded font-semibold hover:bg-zinc-700 transition-colors">
            Retake
          </button>
          <button onClick={identifyProduct} disabled={isLoading} className="flex-1 py-4 bg-blue-600 rounded font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors">
            {isLoading ? 'Identifying...' : 'Identify Product'}
          </button>
        </div>
      </div>
    )}
    <canvas ref={canvasRef} className="hidden" />
  </div>
);
};

export default ProductCamera;