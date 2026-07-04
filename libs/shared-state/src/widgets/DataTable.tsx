import React from 'react';

// TypeScript interface for column definition
interface Column {
  key: string;
  header: string;
  render?: (value: any, item: any) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

// TypeScript interface for DataTable props
interface DataTableProps {
  data: Record<string, any>[];
  columns: Column[];
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
  className?: string;
  maxHeight?: string;
  showHeaders?: boolean;
  onRowClick?: (item: Record<string, any>, index: number) => void;
  showAllData?: boolean;
  selectedItemId?: string | number;
  selectedRowClassName?: string;
}

const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  striped = false,
  hoverable = true,
  bordered = false,
  compact = false,
  className = '',
  maxHeight = '500px',
  showHeaders = true,
  onRowClick,
  showAllData = false,
  selectedItemId,
  selectedRowClassName = 'bg-blue-50 border-l-4 border-blue-500',
}) => {
  return (
    <div className={`overflow-hidden bg-white border border-gray-200 ${className}`}>
      <div className={`max-h-[${maxHeight}] overflow-y-auto`}>
        <table
          className={`w-full mx-auto min-w-[96%] border-collapse ${compact ? 'text-sm' : 'text-base'}`}
        >
          {showHeaders && (
            <thead className="bg-white border-b border-gray-200">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider bg-white ${column.headerClassName || (column.key === 'id' ? 'text-left' : 'text-center')} ${bordered ? 'border' : ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-gray-200">
            {(showAllData ? data : data.slice(0, 10)).map((item, rowIndex) => {
              const isSelected =
                selectedItemId !== undefined &&
                (item.id === selectedItemId || item.key === selectedItemId);
              return (
                <tr
                  key={item.id || rowIndex}
                  className={`
                    bg-gray-50
                    ${striped && rowIndex % 2 === 0 && !isSelected ? 'bg-gray-50' : ''}
                    ${hoverable && !isSelected ? 'hover:bg-gray-100' : ''}
                    ${bordered ? 'border-b' : ''}
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${isSelected ? selectedRowClassName : ''}
                    transition-colors duration-200
                  `}
                  onClick={() => onRowClick && onRowClick(item, rowIndex)}
                  title={onRowClick ? `Click to view details` : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-gray-600 ${column.className || (column.key === 'id' ? 'text-left' : 'text-center')} ${bordered ? 'border' : ''}`}
                    >
                      {column.render ? column.render(item[column.key], item) : item[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
