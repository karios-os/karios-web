import React from 'react';
import LoadingState from './LoadingState';
import { MdDownload, MdCheckCircle } from 'react-icons/md';

interface ActionButtonProps {
  text: string;
  disabled?: boolean;
  variant: 'generate' | 'download' | 'processing' | 'success' | 'disabled';
  onClick: () => void;
  isLoading?: boolean;
  className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  text,
  disabled = false,
  variant,
  onClick,
  isLoading = false,
  className = '',
}) => {
  const getButtonStyles = () => {
    const baseStyles =
      'inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white text-sm font-medium transition-all duration-200';

    switch (variant) {
      case 'success':
        return `${baseStyles} bg-karios-green cursor-not-allowed`;
      case 'download':
        return `${baseStyles} bg-karios-green hover:bg-karios-green/90 shadow-md hover:shadow-lg`;
      case 'processing':
        return `${baseStyles} bg-karios-blue cursor-not-allowed`;
      case 'disabled':
        return `${baseStyles} bg-gray-400 cursor-not-allowed`;
      case 'generate':
      default:
        return `${baseStyles} bg-karios-blue hover:bg-karios-blue/90 shadow-md hover:shadow-lg`;
    }
  };

  const renderIcon = () => {
    if (isLoading) {
      return <LoadingState size="sm" color="border-white" className="w-4 h-4" />;
    }

    if (variant === 'download') {
      return <MdDownload className="w-4 h-4" />;
    }

    if (variant === 'success') {
      return <MdCheckCircle className="w-4 h-4" />;
    }

    return null;
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${getButtonStyles()} ${className}`}>
      {renderIcon()}
      {text}
    </button>
  );
};

export default ActionButton;
