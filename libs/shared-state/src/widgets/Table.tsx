import React from 'react';
import { AddCircle } from 'iconsax-react';
import StatusPill from './StatusPill';

// TypeScript interface for Table props
interface TableProps {
  data: Record<string, any>;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
  className?: string;
}

const Table: React.FC<TableProps> = ({
  data,
  striped = false,
  hoverable = false,
  bordered = false,
  compact = false,
  className = '',
}) => {
  const tableData = Object.entries(data);

  return (
    <div className={`overflow-x-auto p-0 ${className}`}>
      <table
        className={`w-full text-left ${bordered ? 'border' : ''} ${compact ? 'text-sm' : 'text-base'}`}
      >
        <tbody>
          {tableData.map(([key, value], rowIndex) => (
            <tr
              key={key}
              className={`
                ${striped && rowIndex % 2 === 0 ? 'bg-gray-100' : ''}
                ${hoverable ? 'hover:bg-gray-100' : ''}
                ${bordered ? 'border-b' : ''}
              `}
            >
              <td
                className={`text-neutral-500 font-semibold lexend text-left p-2 px-${compact ? '3' : '4'} py-${compact ? '2' : '3'} font-medium 
                  ${bordered ? 'border' : ''}`}
              >
                {key}
              </td>
              <td
                className={`text-right p-2 px-${compact ? '3' : '4'} py-${compact ? '2' : '3'} 
                  ${bordered ? 'border' : ''}`}
              >
                <div className="flex justify-end gap-2 m-2 text-black lexend font-semibold">
                  {typeof value === 'string' &&
                  [
                    'available',
                    'unavailable',
                    'offline',
                    'pending',
                    'in progress',
                    'active',
                    'inactive',
                  ].includes(value.toLowerCase()) ? (
                    <StatusPill status={value} />
                  ) : (
                    String(value)
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
