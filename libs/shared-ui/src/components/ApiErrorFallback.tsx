import React from 'react';

interface ApiErrorFallbackProps {
  error?: string;
  onRetry?: () => void;
  endpoint?: string;
  showRetry?: boolean;
  className?: string;
}

const ApiErrorFallback: React.FC<ApiErrorFallbackProps> = ({
  error = 'Unable to connect to the server',
  onRetry,
  endpoint,
  showRetry = true,
  className = '',
}) => {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
      <p className="text-red-600 text-sm mb-2">
        {endpoint ? `Cannot connect to ${endpoint}` : error}
      </p>
      {showRetry && onRetry && (
        <button onClick={onRetry} className="text-red-700 text-sm hover:text-red-900 underline">
          Try Again
        </button>
      )}
    </div>
  );
};

export default ApiErrorFallback;
