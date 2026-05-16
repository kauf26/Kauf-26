import React, { useRef, useState } from 'react';

const ProductCamera: React.FC = () => {
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
     if (videoRef.current) {
       videoRef.current.srcObject = mediaStream;
     }
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

 const dataURLToBlob = (dataURL: string): Blob => {
   const arr = dataURL.split(',');
   const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
   const bstr = atob(arr[1]);
   let n = bstr.length;
   const u8arr = new Uint8Array(n);
   while (n--) {
     u8arr[n] = bstr.charCodeAt(n);
   }
   return new Blob([u8arr], { type: mime });
 };

 const identifyProduct = async () => {
   if (!capturedImage) return;
   setIsLoading(true);
   setError(null);

   const blob = dataURLToBlob(capturedImage);
   const formData = new FormData();
   formData.append('image', blob, 'product.jpg');

   try {
     const response = await fetch('/api/identify', {
       method: 'POST',
       body: formData,
     });

     if (!response.ok) throw new Error('Identification failed');

     const data = await response.json();

     const productData = {
       title: data.title || data.modelName || 'Unknown Product',
       brand: data.brand || 'Unknown Brand',
       description: data.aiDescription || data.description || '',
       price: data.recommendedPrice ? String(data.recommendedPrice) : data.price || '0.00',
       category: data.category || 'General',
       condition: data.condition || 'New',
       isExactMatch: data.confidence ? data.confidence > 0.8 : true,
       isProhibited: data.isProhibited || false,
       prohibitionReason: data.prohibitionReason || '',
     };

     sessionStorage.setItem('pending_kauf26_draft', JSON.stringify(productData));
     sessionStorage.setItem('pending', JSON.stringify(productData));
     window.location.hash = '/product-draft';
   } catch (err) {
     setError('Failed to identify product. Please try again.');
     console.error(err);
   } finally {
     setIsLoading(false);
   }
 };

 return (
   <div className="max-w-2xl mx-auto p-6">
     <h1 className="text-3xl font-bold mb-6">Product Scanner</h1>

     {error && (
       <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
         {error}
       </div>
     )}

     {!capturedImage ? (
       <>
         {!stream ? (
           <button
             onClick={startCamera}
             className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"

             Start Camera
           </button>
         ) : (
           <div className="space-y-4">
             <video
               ref={videoRef}
               autoPlay
               playsInline
               className="w-full rounded-lg border"
             />
             <button
               onClick={capturePhoto}
               className="w-full py-4 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"

               Capture Photo
             </button>
           </div>
         )}
       </>
     ) : (
       <div className="space-y-4">
         <img src={capturedImage} alt="Captured" className="w-full rounded-lg border" />
         <div className="flex gap-4">
           <button
             onClick={resetCamera}
             className="flex-1 py-4 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700"

             Retake
           </button>
           <button
             onClick={identifyProduct}
             disabled={isLoading}
             className="flex-1 py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"

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