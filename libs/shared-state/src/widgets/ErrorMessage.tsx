import React from 'react';

interface ErrorMessageProps {
  message: string | null;
  className?: string;
  variant?: 'error' | 'warning' | 'info';
  onRetry?: () => void;
  retryLabel?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  className = '',
  variant = 'error',
  onRetry,
  retryLabel = 'Retry',
}) => {
  if (!message) return null;

  const getStyles = () => {
    const baseStyles = 'p-3 rounded-lg text-sm border';

    switch (variant) {
      case 'warning':
        return `${baseStyles} bg-yellow-50 text-yellow-700 border-yellow-200`;
      case 'info':
        return `${baseStyles} bg-blue-50 text-blue-700 border-blue-200`;
      case 'error':
      default:
        return `${baseStyles} bg-red-50 text-red-700 border-red-200`;
    }
  };

  const getRetryButtonStyles = () => {
    switch (variant) {
      case 'warning':
        return 'mt-2 px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded text-sm';
      case 'info':
        return 'mt-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm';
      case 'error':
      default:
        return 'mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm';
    }
  };

  return (
    <div className={`${getStyles()} ${className}`}>
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={getRetryButtonStyles()}>
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
