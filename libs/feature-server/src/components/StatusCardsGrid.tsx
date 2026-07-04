import React from 'react';
import { IconType } from 'react-icons';

interface CustomStatusCardProps {
  icon: IconType | React.ComponentType<any>;
  metric: string;
  text: string;
  detail: string;
  className: string;
  metricsColor: string;
  iconColor: string;
  showProgressBar?: boolean;
  progressValue?: number;
  progressLabel?: string;
  info?: string;
  onInfoClick?: () => void;
  onClick?: () => void;
  metricSize?: string;
  textSize?: string;
  iconSize?: number;
  cardHeight?: string;
  progressBarColor?: string;
  progressBgColor?: string;
  progressHeight?: string;
}

interface StatusCardsGridProps {
  statusCards: CustomStatusCardProps[];
  serverName: string;
}

export default function StatusCardsGrid({ statusCards, serverName }: StatusCardsGridProps) {
  return (
    <div className="space-y-2 rounded-lg">
      {/* Status Cards Grid */}
      <div className="w-full gap-3 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
        {(statusCards || []).map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className={`${card.className} rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow ${card.onClick ? 'cursor-pointer' : ''}`}
              onClick={card.onClick}
            >
              {/* Top section: Icon and Name side by side */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon size={20} color={card.iconColor} />
                  <p className="text-sm font-medium text-gray-800">{card.text}</p>
                </div>
                {card.info && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      card.onInfoClick?.();
                    }}
                    className="text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Percentage (Metric) */}
              <div
                className={`${card.metricsColor} ${card.metricSize || 'text-xl'} font-bold mb-0.5`}
              >
                {card.metric}
              </div>

              {/* Secondary text (Detail) - close to percentage */}
              <p className="text-xs text-gray-600 mb-1">{card.detail}</p>

              {/* Progress Bar if applicable - close to detail text */}
              {card.showProgressBar && (
                <div className="mt-0.5">
                  <div className="w-full bg-gray-300 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`${card.progressBarColor} h-full rounded-full transition-all`}
                      style={{
                        width: `${Math.min(card.progressValue || 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
