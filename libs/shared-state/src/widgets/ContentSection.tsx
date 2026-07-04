import React from 'react';

interface ContentSectionProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export default function ContentSection({
  title,
  icon,
  children,
  className = 'bg-white p-3 sm:p-5 rounded-lg',
  headerClassName = 'text-lg sm:text-2xl font-semibold text-black flex items-center mb-2',
  contentClassName = '',
}: ContentSectionProps) {
  return (
    <div className={className}>
      {title && (
        <h3 className={headerClassName}>
          {icon && <span className="mr-2 sm:mr-4">{icon}</span>}
          {title}
        </h3>
      )}
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
