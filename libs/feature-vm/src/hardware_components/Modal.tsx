import React, { ReactNode } from 'react';
import { CloseCircle } from 'iconsax-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  width?: string;
  zIndex?: number;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  width = 'max-w-md',
  zIndex = 50,
}) => {
  if (!isOpen) return null;

  // Close on backdrop click, but prevent propagation from modal content
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center backdrop-blur-xs bg-black/10 transition-opacity"
      style={{ zIndex: zIndex * 10 }}
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white rounded-lg shadow-2xl ${width} w-full transform transition-all duration-300 ease-in-out max-h-[85vh] flex flex-col`}
        data-testid="modal"
      >
        {title && (
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900" data-testid="modal-title">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
              aria-label="Close modal"
            >
              <CloseCircle size={24} variant="Bold" />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1 min-h-0" data-testid="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
