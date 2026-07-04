import React from 'react';
import { Cpu, Information } from 'iconsax-react';
import { BsClock } from 'react-icons/bs';

interface StatusCardProps {
  className?: string;
  metricsColor?: string;
  metric?: string;
  text?: string | React.ReactNode;
  metricSize?: string;
  textSize?: string;
  icon?: React.ComponentType<{ className?: string; size?: string | number; color?: string }>;
  iconColor?: string;
  iconSize?: number;
  iconPosition?: 'left' | 'right';
  info?: string | null;
  infoColor?: string;
  onInfoClick?: () => void;
  onClick?: () => void;
  layout?: 'column' | 'row' | 'row-reverse' | 'column-reverse';
  showProgressBar?: boolean;
  progressValue?: number;
  progressLabel?: string;
  detail?: string;
  textBesideIcon?: boolean;
  progressBarColor?: string;
  progressBgColor?: string;
  progressHeight?: string;
}

const StatusCard: React.FC<StatusCardProps> = ({
  className = '',
  metricsColor = '',
  metric = '',
  text = '',
  metricSize = 'text-lg',
  textSize = 'text-lg',
  icon: Icon,
  iconColor = '#000000',
  iconSize = 20,
  iconPosition = 'right',
  info = null,
  infoColor = 'text-gray-600',
  onInfoClick,
  onClick,
  layout = 'column',
  showProgressBar = false,
  progressValue = 0,
  progressLabel = 'Usage',
  detail = '',
  textBesideIcon = false,
  progressBarColor = 'bg-black',
  progressBgColor = 'bg-gray-200',
  progressHeight = 'h-1.5',
}) => {
  // Determine flex direction and alignment based on layout prop
  let contentClass = '';
  switch (layout) {
    case 'row':
      contentClass = 'flex flex-row items-center justify-between w-full';
      break;
    case 'row-reverse':
      contentClass = 'flex flex-row-reverse items-center justify-between w-full';
      break;
    case 'column-reverse':
      contentClass = 'flex flex-col-reverse items-center w-full';
      break;
    case 'column':
    default:
      contentClass = 'flex flex-col min-w-full';
      break;
  }
  return (
    <div
      className={`flex flex-col  w-full min-h-10 rounded-xl ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex flex-col w-full h-full rounded-[12px] py-[12px] px-[19px] justify-between">
        {/* Header with icons */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={iconSize} color={iconColor} className="flex-shrink-0" />}
            {textBesideIcon && (layout === 'column' || layout === 'column-reverse') && (
              <span className={`font-lexend font-normal ${textSize} leading-[140%] text-gray-700`}>
                {text}
              </span>
            )}
          </div>
          {/* Show info icon in header for non-row layouts */}
          {info && layout !== 'row' && layout !== 'row-reverse' && (
            <div className="relative inline-block group">
              <Information
                size={14}
                color="#9CA3AF"
                className="hover:text-gray-700 cursor-pointer"
                onClick={onInfoClick ? onInfoClick : undefined}
              />
              {!onInfoClick && (
                <div
                  className={`invisible group-hover:visible absolute z-[9999] w-52 p-2 mt-1 text-xs ${infoColor} bg-white border rounded shadow-lg left-0 border-gray-400 top-full`}
                >
                  {info}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Content based on layout */}
        <div className={`${contentClass} flex-1`}>
          {layout === 'row' || layout === 'row-reverse' ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className={`font-lexend font-normal ${textSize} leading-[140%] ${metricsColor}`}
                >
                  {text}
                </span>
                {/* Info icon next to text for row layouts */}
                {info && (
                  <div className="relative inline-block group">
                    <Information
                      size={14}
                      color="#9CA3AF"
                      className="hover:text-gray-700 cursor-pointer"
                      onClick={onInfoClick ? onInfoClick : undefined}
                    />
                    {!onInfoClick && (
                      <div
                        className={`invisible group-hover:visible absolute z-[9999] w-52 p-2 mt-1 text-xs ${infoColor} bg-white border rounded shadow-lg left-0 border-gray-400 top-full`}
                      >
                        {info}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span
                className={`font-lexend font-normal ${metricSize} leading-[140%] ${metricsColor}`}
              >
                {metric}
              </span>
            </>
          ) : (
            <>
              <span
                className={`font-lexend font-normal ${metricSize} leading-[140%] ${metricsColor}`}
              >
                {metric}
              </span>
              {!textBesideIcon && (
                <span
                  className={`font-lexend font-normal ${textSize} leading-[140%] text-black mt-2`}
                >
                  {text}
                </span>
              )}
              {detail && (
                <span
                  className={
                    'font-lexend font-normal text-sm font-lexend leading-[140%] text-neutral-500 mt-1'
                  }
                >
                  {detail}
                </span>
              )}
            </>
          )}
        </div>
        {/* Progress bar at bottom */}
        {showProgressBar && (
          <div className="mt-auto pt-1 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">{progressLabel}</span>
              <span className={`text-xs ${metricsColor} font-medium `}>{progressValue}%</span>
            </div>
            <div className={`w-full rounded-full ${progressBgColor} ${progressHeight}`}>
              <div
                className={`${progressBarColor} ${progressHeight} rounded-full transition-all duration-300`}
                style={{ width: `${progressValue}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusCard;
