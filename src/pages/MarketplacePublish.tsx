import { useState, useEffect, useRef } from 'react';

type Marketplace = {
  id: string;
  name: string;
  status: 'idle' | 'publishing' | 'processing' | 'completed' | 'failed';
};

export default function MarketplacePublish() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([
    { id: 'amzn', name: 'Amazon', status: 'idle' },
    { id: 'ebay', name: 'eBay', status: 'idle' },
    { id: 'etsy', name: 'Etsy', status: 'idle' },
    { id: 'depop', name: 'Depop', status: 'idle' },
  ]);

  const productData = {
    title: 'Sample Product Layout',
    description: 'Automated listing data payload via local worker engine.',
    price: 45.0,
    imageUrl: 'https://your-local-cdn-link.com/item.jpg',
  };

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handlePublishAll = async () => {
    if (isPublishing) return;
    setIsPublishing(true);

    setMarketplaces((prev) =>
      prev.map((mp) => ({ ...mp, status: 'publishing' }))
    );

    try {
      const response = await fetch('/api/marketplaces/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productData,
          marketplaceIds: marketplaces.map((mp) => mp.id),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Server error');

      const jobId = result.jobId;
      console.log('Job queued:', jobId);

      intervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/marketplaces/status/${jobId}`);
          if (!statusRes.ok) return;

          const statusData = await statusRes.json();
          setMarketplaces((prev) =>
            prev.map((mp) => {
              const task = statusData.tasks?.find(
                (t: any) => t.marketplace_id === mp.id
              );
              if (task) {
                let newStatus: Marketplace['status'] = 'processing';
                if (task.status === 'completed') newStatus = 'completed';
                else if (task.status === 'failed') newStatus = 'failed';
                else if (task.status === 'processing') newStatus = 'processing';
                return { ...mp, status: newStatus };
              }
              return mp;
            })
          );

          const allFinished = statusData.tasks?.every(
            (t: any) => t.status === 'completed' || t.status === 'failed'
          );
          if (allFinished && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setIsPublishing(false);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 3000);
    } catch (error) {
      console.error('Publish failed:', error);
      setMarketplaces((prev) => prev.map((mp) => ({ ...mp, status: 'failed' })));
      setIsPublishing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        {marketplaces.map((mp) => (
          <div key={mp.id} className="flex items-center justify-between">
            <span className="font-medium">{mp.name}</span>
            <div>
              {mp.status === 'completed' && (
                <span className="text-green-600 text-sm font-semibold">Published</span>
              )}
              {mp.status === 'failed' && (
                <span className="text-red-500 text-sm font-semibold">Failed</span>
              )}
              {mp.status === 'publishing' && (
                <span className="text-blue-500 text-sm animate-pulse">Publishing...</span>
              )}
              {mp.status === 'processing' && (
                <span className="text-amber-500 text-sm font-medium">Queued on Server...</span>
              )}
              {mp.status === 'idle' && (
                <span className="text-gray-400 text-sm">Not published</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handlePublishAll}
        disabled={isPublishing}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isPublishing ? 'Activating Engine...' : 'Publish to All'}
      </button>
    </div>
  );
}