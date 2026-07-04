import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FaTimes } from 'react-icons/fa';

interface ModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  width?: string;
  closeOnEsc?: boolean;
  maxHeight?: string;
  scrollable?: boolean;
  closeOnOverlayClick?: boolean;
  disablePasswordCopyPaste?: boolean;
  showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  children,
  isOpen,
  onClose,
  title,
  width = '500px',
  closeOnEsc = true,
  maxHeight = '80vh',
  scrollable = true,
  closeOnOverlayClick = true,
  disablePasswordCopyPaste = false,
  showCloseButton = true,
}) => {
  // Add ESC key handler
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return void 0;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose, closeOnEsc]);

  // Add copy/paste prevention for password fields
  useEffect(() => {
    if (!isOpen || !disablePasswordCopyPaste) return void 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+X for copy/paste operations
      if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'x')) {
        const target = e.target as HTMLElement;
        if (
          target &&
          target.tagName === 'INPUT' &&
          (target as HTMLInputElement).type === 'password'
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'password'
      ) {
        e.preventDefault();
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'password'
      ) {
        e.preventDefault();
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'password'
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('copy', handleCopy, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('copy', handleCopy, true);
    };
  }, [isOpen, disablePasswordCopyPaste]);

  // Don't render anything if the modal is not open
  if (!isOpen) return null;

  // Handle clicks on the overlay background
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Create a portal for the modal
  return ReactDOM.createPortal(
    // Overlay with fixed position that covers the entire screen
    <div
      className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Modal content */}
      <div
        className="bg-white rounded-lg shadow-sm w-full"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal header */}
        <div className="flex justify-between items-center bg-[#E8EAF0] p-4 pl-7 rounded-t-lg">
          <h3 className="text-lg font-medium">{title}</h3>
          {showCloseButton && (
            <button
              className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              onClick={onClose}
              aria-label="Close"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal body - with scrolling container if scrollable is true */}
        <div
          className={`p-4 ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}`}
          style={scrollable ? { maxHeight } : undefined}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
