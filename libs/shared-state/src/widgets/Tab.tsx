import React from 'react';

interface TabOption {
  value: string;
  label: string;
}

interface TabProps {
  value: string;
  options: TabOption[];
  onChange: (value: string) => void;
  className?: string;
  bordered?: boolean;
}

const Tab: React.FC<TabProps> = ({ value, options, onChange, className = '', bordered = true }) => {
  return (
    <div className={`flex border-b border-gray-200 mb-6 gap-2 ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            className={`px-4 py-2 bg-white rounded-t-lg font-medium transition-colors ${
              isActive
                ? 'text-[var(--karios-blue)] border-b-2 border-b-[var(--karios-blue)]'
                : 'text-gray-500 hover:text-[var(--karios-blue)] border-b border-b-gray-200'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tab;
