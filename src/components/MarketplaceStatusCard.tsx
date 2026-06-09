import React from 'react';

export type MarketplaceVerifyStatus = {
  marketplace: string;
  ok: boolean;
  configured: boolean;
  status: number;
  message: string;
  hint?: string;
  authorizeUrl?: string;
  connectLabel?: string;
};

export const MarketplaceStatusCard = ({ status }: { status: MarketplaceVerifyStatus }) => {
  const isHealthy = status.ok;
  return (
    <div className={`p-4 rounded-lg border ${isHealthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex justify-between items-center">
        <h3 className="font-bold capitalize text-lg text-gray-900">{status.marketplace}</h3>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${isHealthy ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
          {isHealthy ? 'Connected' : 'Action Required'}
        </span>
      </div>
      <p className="text-sm mt-2 text-gray-700 whitespace-pre-line break-words">{status.message}</p>
      {status.hint && <p className="text-xs mt-1 text-gray-500 italic">Hint: {status.hint}</p>}
      {!isHealthy && status.authorizeUrl && (
        <a href={status.authorizeUrl} className="mt-3 inline-block bg-blue-600 text-white text-xs px-4 py-2 rounded hover:bg-blue-700">
          {status.connectLabel ?? "Connect"}
        </a>
      )}
    </div>
  );
};
