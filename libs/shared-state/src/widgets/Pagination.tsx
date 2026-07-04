import React from 'react';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa6';

interface PaginationProps {
  // Page-based pagination (original)
  currentPage?: number;
  totalPages?: number;
  pageInput?: string;
  onPageInputChange?: (value: string) => void;
  onPageInputSubmit?: () => void;
  onPageInputKeyPress?: (e: React.KeyboardEvent) => void;

  // Offset-based pagination (alternative)
  offset?: number;
  limit?: number;

  // Common props
  totalCount: number;
  itemsPerPage?: number;
  onPageChange: (pageOrOffset: number) => void;
  showPageInput?: boolean;
  className?: string;
  // Display mode
  displayMode?: 'entries' | 'pages';
}

export default function Pagination({
  // Page-based props
  currentPage,
  totalPages,
  pageInput,
  onPageInputChange,
  onPageInputSubmit,
  onPageInputKeyPress,

  // Offset-based props
  offset,
  limit,

  // Common props
  totalCount,
  itemsPerPage,
  onPageChange,
  showPageInput = true,
  className = '',
  displayMode = 'entries',
}: PaginationProps) {
  // Determine if we're using offset-based or page-based pagination
  const isOffsetBased = offset !== undefined && limit !== undefined;

  let calculatedCurrentPage: number;
  let calculatedTotalPages: number;
  let startItem: number;
  let endItem: number;
  let isFirstPage: boolean;
  let isLastPage: boolean;

  if (isOffsetBased) {
    // Offset-based calculations
    calculatedCurrentPage = Math.floor(offset! / limit!) + 1;
    calculatedTotalPages = Math.ceil(totalCount / limit!);
    startItem = Math.min(offset! + 1, totalCount);
    endItem = Math.min(offset! + limit!, totalCount);
    isFirstPage = offset === 0;
    isLastPage = offset! + limit! >= totalCount;
  } else {
    // Page-based calculations (original behavior)
    calculatedCurrentPage = currentPage || 1;
    calculatedTotalPages = totalPages || 1;
    const items = itemsPerPage || 10;
    startItem = Math.min((calculatedCurrentPage - 1) * items + 1, totalCount);
    endItem = Math.min(calculatedCurrentPage * items, totalCount);
    isFirstPage = calculatedCurrentPage <= 1;
    isLastPage = calculatedCurrentPage >= calculatedTotalPages;
  }

  const handlePreviousClick = () => {
    if (isOffsetBased) {
      const newOffset = Math.max(0, offset! - limit!);
      onPageChange(newOffset);
    } else {
      onPageChange(calculatedCurrentPage - 1);
    }
  };

  const handleNextClick = () => {
    if (isOffsetBased) {
      const newOffset = offset! + limit!;
      onPageChange(newOffset);
    } else {
      onPageChange(calculatedCurrentPage + 1);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (calculatedTotalPages <= maxPagesToShow + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= calculatedTotalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (calculatedCurrentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, calculatedCurrentPage - 1);
      const end = Math.min(calculatedTotalPages - 1, calculatedCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (calculatedCurrentPage < calculatedTotalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(calculatedTotalPages);
    }

    return pages;
  };

  const handlePageClick = (page: number) => {
    if (isOffsetBased) {
      const newOffset = (page - 1) * limit!;
      onPageChange(newOffset);
    } else {
      onPageChange(page);
    }
  };

  const handleGoClick = () => {
    if (pageInput && onPageInputSubmit) {
      onPageInputSubmit();
    }
  };

  return (
    <div
      className={`flex flex-col lg:flex-row justify-center items-center mt-6 gap-3 lg:gap-0 ${className}`}
    >
      <div className="flex items-center gap-2">
        {/* Item Count Display */}
        <div className="text-sm text-gray-600 mr-2">
          {displayMode === 'pages'
            ? `Page ${calculatedCurrentPage} of ${calculatedTotalPages}`
            : `${startItem}-${endItem} of ${totalCount.toLocaleString()}`}
        </div>

        {/* Back Button */}
        <button
          onClick={handlePreviousClick}
          disabled={isFirstPage}
          className={`flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium ${
            isFirstPage
              ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <FaArrowLeft className="text-xs" />
          Back
        </button>

        {/* Page Numbers */}
        {!isOffsetBased && (
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                    {page}
                  </span>
                );
              }

              const pageNum = page as number;
              const isActive = pageNum === calculatedCurrentPage;

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageClick(pageNum)}
                  className={`min-w-[40px] px-3 py-2 rounded text-sm font-medium ${
                    isActive
                      ? 'bg-karios-blue text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={handleNextClick}
          disabled={isLastPage}
          className={`flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium ${
            isLastPage
              ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Next
          <FaArrowRight className="text-xs" />
        </button>

        {/* Page Input with Go Button */}
        {showPageInput && !isOffsetBased && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-600">Page</span>
            <input
              type="text"
              value={pageInput !== undefined ? pageInput : calculatedCurrentPage.toString()}
              onChange={(e) => onPageInputChange?.(e.target.value)}
              onKeyPress={onPageInputKeyPress}
              className="w-20 px-3 py-2 text-center border border-gray-300 rounded text-sm"
              placeholder={calculatedCurrentPage.toString()}
            />
            <button
              onClick={handleGoClick}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
            >
              Go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
