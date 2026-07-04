import React from 'react';

// TypeScript interface for Button props
interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'outline' | 'primary' | '';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = '',
  onClick,
  disabled = false,
}) => {
  const variantStyles: Record<string, string> = {
    outline: disabled
      ? 'border border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
      : 'border border-blue-300 bg-blue-500 text-white hover:bg-blue-600',
    primary: disabled
      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
      : 'bg-blue-500 text-white hover:bg-blue-600',
    '': '',
  };

  return (
    <button
      className={`px-4 py-2 rounded-md transition-colors ${variantStyles[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
