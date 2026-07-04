import React from 'react';
import { FaChevronRight, FaAngleDown } from 'react-icons/fa';
import LoadingState from './LoadingState';

// TypeScript interface for column definition
interface Column {
  key: string;
  header: string;
  render?: (value: any, item: any) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

// TypeScript interface for ExpandableTable props
interface ExpandableTableProps {
  data: Record<string, any>[];
  columns: Column[];
  expandedRowId: string | null;
  onRowClick: (item: Record<string, any>) => void;
  renderExpandedContent: (item: Record<string, any>) => React.ReactNode;
  getRowId: (item: Record<string, any>) => string;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  className?: string;
  maxHeight?: string;
  striped?: boolean;
}

const ExpandableTable: React.FC<ExpandableTableProps> = ({
  data,
  columns,
  expandedRowId,
  onRowClick,
  renderExpandedContent,
  getRowId,
  loading = false,
  loadingText = 'Loading...',
  emptyText = 'No data available',
  className = '',
  maxHeight = '600px',
  striped = false,
}) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <LoadingState message={loadingText} size="md" showMessage={true} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full border border-gray-300 rounded-xl overflow-hidden">
        <div className="text-center py-8 bg-white">
          <div className="text-gray-500">{emptyText}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-x-auto border border-gray-300 rounded-xl ${className}`}>
      <div className="min-w-full inline-block align-middle">
        <div className="overflow-hidden rounded-lg">
          <table className="min-w-full w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    className={`px-6 py-3 ${index === 0 ? 'text-left' : 'text-center'} text-md font-semibold bg-white text-gray-800 ${column.headerClassName || column.className || ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((item, index) => {
                const rowId = getRowId(item);
                const isOddRow = index % 2 === 0;
                const rowBgClass = striped && isOddRow ? 'bg-gray-100' : 'bg-white';
                const isExpanded = expandedRowId === rowId;
                return (
                  <React.Fragment key={rowId}>
                    <tr
                      className={`${rowBgClass} hover:bg-gray-50 cursor-pointer`}
                      onClick={() => onRowClick(item)}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-md text-left`}>
                        <div className="flex items-center gap-2">
                          {isExpanded ? <FaAngleDown /> : <FaChevronRight size={14} />}
                          <span>
                            {columns[0].render
                              ? columns[0].render(item[columns[0].key], item)
                              : item[columns[0].key]}
                          </span>
                        </div>
                      </td>
                      {columns.slice(1).map((column, colIndex) => (
                        <td
                          key={colIndex + 1}
                          className={`px-6 py-4 whitespace-nowrap text-md text-center ${column.className || ''}`}
                        >
                          {column.render ? column.render(item[column.key], item) : item[column.key]}
                        </td>
                      ))}
                    </tr>
                    {/* Expandable content row */}
                    {expandedRowId === rowId && (
                      <tr key={`${rowId}-expanded`}>
                        <td colSpan={columns.length}>{renderExpandedContent(item)}</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpandableTable;
