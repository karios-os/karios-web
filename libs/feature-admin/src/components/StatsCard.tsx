import React from 'react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  bgColor: string;
  iconBgColor: string;
}

export default function StatsCard({ title, value, icon, bgColor, iconBgColor }: StatsCardProps) {
  return (
    <div className={`${bgColor} rounded-lg p-3 border border-gray-200`}>
      <div className="flex items-center gap-2">
        <div>{icon}</div>
        <div>
          <p className="text-xs text-gray-600">{title}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
