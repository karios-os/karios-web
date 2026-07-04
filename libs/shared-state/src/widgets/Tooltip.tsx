import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  disabled?: boolean;
  iconSize?: number;
  iconColor?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  position = 'bottom',
  delay = 300,
  className = '',
  disabled = false,
  iconSize = 16,
  iconColor = '#6b7280',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    if (disabled || !text.trim()) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updateTooltipPosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updateTooltipPosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;
        break;
    }

    // Keep tooltip within viewport bounds
    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    setTooltipStyle({
      top: `${top}px`,
      left: `${left}px`,
    });
  };

  useEffect(() => {
    if (isVisible) {
      // Update position when the tooltip becomes visible
      const timer = setTimeout(updateTooltipPosition, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible]);

  useEffect(() => {
    // Update position on window resize
    const handleResize = () => {
      if (isVisible) {
        updateTooltipPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-flex items-center justify-center cursor-help ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        tabIndex={0}
        role="button"
        aria-label="Information"
      >
        {/* Info icon */}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" stroke={iconColor} strokeWidth="1.5" fill="none" />
          <path
            d="M12 16V12"
            stroke={iconColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="8" r="1" fill={iconColor} />
        </svg>
      </div>

      {/* Tooltip rendered at the body level with maximum z-index */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-[999999] border border-gray-200 px-3 py-2 text-sm bg-white text-gray-800 rounded-md shadow-lg pointer-events-none max-w-sm break-words"
          style={{
            ...tooltipStyle,
            // Ensure tooltip is always on top with extremely high z-index
            zIndex: 999999,
            whiteSpace: 'normal',
          }}
          role="tooltip"
        >
          {text}

          {/* Tooltip arrow */}
          <div
            className={`absolute w-2 h-2 bg-white transform rotate-45 ${
              position === 'top'
                ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b border-gray-200'
                : position === 'bottom'
                  ? 'top-[-4px] left-1/2 -translate-x-1/2 border-l border-t border-gray-200'
                  : position === 'left'
                    ? 'right-[-4px] top-1/2 -translate-y-1/2 border-r border-t border-gray-200'
                    : 'left-[-4px] top-1/2 -translate-y-1/2 border-l border-b border-gray-200'
            }`}
          />
        </div>
      )}
    </>
  );
};

export default Tooltip;
