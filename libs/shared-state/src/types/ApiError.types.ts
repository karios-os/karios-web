/**
 * Standardized API Error Response Types
 *
 * These interfaces define the structure of error responses from all APIs
 * to ensure consistent error handling throughout the application.
 */

/**
 * Individual error detail for validation errors or field-specific issues
 */
export interface ErrorDetail {
  /** Field name or error location */
  field?: string;
  /** Specific error code for this detail */
  code?: string;
  /** Human-readable error message */
  message: string;
  /** Additional context for this specific error */
  context?: Record<string, any>;
}

/**
 * Standard API Error Response Structure
 *
 * All API endpoints should return errors in this format for consistent handling
 */
export interface APIError {
  /** Error code (e.g., "VALIDATION_ERROR", "UNAUTHORIZED", "NOT_FOUND") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Unique correlation ID for tracking this error across systems */
  correlation_id: string;
  /** Array of detailed error information (e.g., validation errors) */
  error_details?: ErrorDetail[];
  /** Additional metadata or context for the error */
  meta?: Record<string, any>;
}

/**
 * Enhanced error interface that includes HTTP response information
 * Useful for handling different types of API errors
 */
export interface APIErrorResponse extends APIError {
  /** HTTP status code */
  status?: number;
  /** HTTP status text */
  statusText?: string;
  /** Original error object if available */
  originalError?: Error;
}

/**
 * Error handling utility types
 */

/** Common error codes used throughout the application */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

/** Error severity levels */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Extended error interface with additional client-side properties
 */
export interface ExtendedAPIError extends APIErrorResponse {
  /** Error severity level */
  severity?: ErrorSeverity;
  /** Whether this error should be displayed to the user */
  userFacing?: boolean;
  /** Retry strategy information */
  retryable?: boolean;
  /** Timestamp when the error occurred */
  timestamp?: string;
}

/**
 * Type guard to check if an object is an APIError
 */
export function isAPIError(error: any): error is APIError {
  return (
    error &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.correlation_id === 'string'
  );
}

/**
 * Type guard to check if an object is an APIErrorResponse
 */
export function isAPIErrorResponse(error: any): error is APIErrorResponse {
  return isAPIError(error) && (!('status' in error) || typeof error.status === 'number');
}

/**
 * Utility function to extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

/**
 * Utility function to extract error code from various error types
 */
export function getErrorCode(error: unknown): string {
  if (isAPIError(error)) {
    return error.code;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Utility function to create a standardized error response
 */
export function createAPIError(
  code: string,
  message: string,
  correlationId: string,
  errorDetails?: ErrorDetail[],
  meta?: Record<string, any>
): APIError {
  return {
    code,
    message,
    correlation_id: correlationId,
    error_details: errorDetails,
    meta,
  };
}

/**
 * Utility function to convert a generic error to APIErrorResponse
 */
export function toAPIErrorResponse(
  error: unknown,
  status?: number,
  correlationId?: string
): APIErrorResponse {
  if (isAPIErrorResponse(error)) {
    return error;
  }

  if (isAPIError(error)) {
    return {
      ...error,
      status,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  return {
    code,
    message,
    correlation_id: correlationId || generateCorrelationId(),
    status,
    originalError: error instanceof Error ? error : undefined,
  };
}

/**
 * Generate a simple correlation ID for tracking errors
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Common error response patterns for specific scenarios
 */
export const CommonErrors = {
  NETWORK_ERROR: (correlationId?: string): APIError => ({
    code: 'NETWORK_ERROR',
    message: 'Network connection failed. Please check your internet connection and try again.',
    correlation_id: correlationId || generateCorrelationId(),
  }),

  UNAUTHORIZED: (correlationId?: string): APIError => ({
    code: 'UNAUTHORIZED',
    message: 'Authentication required. Please log in and try again.',
    correlation_id: correlationId || generateCorrelationId(),
  }),

  FORBIDDEN: (correlationId?: string): APIError => ({
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
    correlation_id: correlationId || generateCorrelationId(),
  }),

  NOT_FOUND: (resource: string, correlationId?: string): APIError => ({
    code: 'NOT_FOUND',
    message: `${resource} not found.`,
    correlation_id: correlationId || generateCorrelationId(),
  }),

  VALIDATION_ERROR: (details: ErrorDetail[], correlationId?: string): APIError => ({
    code: 'VALIDATION_ERROR',
    message: 'Validation failed. Please check your input and try again.',
    correlation_id: correlationId || generateCorrelationId(),
    error_details: details,
  }),

  SERVER_ERROR: (correlationId?: string): APIError => ({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred. Please try again later.',
    correlation_id: correlationId || generateCorrelationId(),
  }),
};

/**
 * Global error handler function that displays appropriate toast notifications
 *
 * @param error - The error object to handle
 * @param showToast - Function to display toast notifications (should be provided by the UI framework)
 */
export function handleGlobalError(
  error: unknown,
  showToast: (message: string, type?: 'error' | 'warning' | 'info') => void
): void {
  // Convert any error to APIError format for consistent handling
  let apiError: APIError;

  if (isAPIError(error)) {
    apiError = error;
  } else {
    // Convert generic error to APIError format
    const message = getErrorMessage(error);
    const code = getErrorCode(error);
    apiError = {
      code,
      message,
      correlation_id: generateCorrelationId(),
    };
  }

  // If error details are present, show those instead of the main message
  if (apiError.error_details && apiError.error_details.length > 0) {
    // Show each error detail as a separate toast
    apiError.error_details.forEach((detail) => {
      showToast(detail.message, 'error');
    });
  } else {
    // Show the main error message
    showToast(apiError.message, 'error');
  }
}
