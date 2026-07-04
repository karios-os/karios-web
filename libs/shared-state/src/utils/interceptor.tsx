import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { handleGlobalError, isAPIError } from '../types/ApiError.types';
import { logger } from './logger';

const USE_DUMMY_SERVER = false; // Toggle this flag to switch between dummy and actual server

// Define types for the API interceptor
interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

let lastToastMessage = '';
let lastToastTime = 0;

const api = {
  fetch: async (url: string, options: FetchOptions = {}): Promise<Response> => {
    const token = localStorage.getItem('accessToken');

    // Create optimized headers to minimize CORS preflight requests
    const headers: Record<string, string> = {
      ...options.headers,
    };

    // Only add Content-Type for requests that actually need it (have body)
    // Don't set it for FormData - let browser set it with boundary
    if (options.body && options.method !== 'GET' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add Authorization token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Use dummy server if the flag is enabled
    if (USE_DUMMY_SERVER) {
      url = url.replace(/http:\/\/[^/]+:8080/, 'http://localhost:3000');
    }

    try {
      // Make the fetch call
      const response = await fetch(url, {
        ...options,
        headers,
        // Always include credentials to support HTTP-only cookies
        credentials: options.credentials || 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const now = Date.now();

        // Try to use the global error handler first
        try {
          // Check if this is a standardized API error response
          if (isAPIError(errorData)) {
            // Use global error handler with duplicate prevention
            // Skip toast for /api/v1/network/pf/update endpoint (errors shown inline)
            // Also skip toast for VM info retrieval (GET requests to /api/v1/compute/vms/{vmName})
            // Also skip toast for console endpoints (errors shown in alert box)
            const shouldSuppressToast =
              url.includes('/api/v1/network/pf/update') ||
              (url.includes('/api/v1/compute/vms/') &&
                (!options.method || options.method === 'GET')) ||
              url.includes('/api/v1/console');
            const showToastWithDuplicatePrevention = (
              message: string,
              _type?: 'error' | 'warning' | 'info'
            ) => {
              if (
                !shouldSuppressToast &&
                !(message === lastToastMessage && now - lastToastTime < 1000)
              ) {
                toast.error(message);
                lastToastMessage = message;
                lastToastTime = now;
              }
            };

            handleGlobalError(errorData, showToastWithDuplicatePrevention);
            throw new Error(errorData.message);
          }
        } catch (globalHandlerError) {
          // If global handler fails, fall back to existing logic
          logger.error('Global error handler failed, using fallback:', globalHandlerError);
        }

        // Fallback to existing error handling logic
        const errorMsg =
          errorData.error ||
          errorData.message ||
          errorData.status ||
          'An error occurred - No connectivity found';

        // Special handling for license errors
        if (response.status === 403 && errorMsg.toLowerCase().includes('license')) {
          if (!(errorMsg === lastToastMessage && now - lastToastTime < 1000)) {
            toast.error(errorMsg);
            lastToastMessage = errorMsg;
            lastToastTime = now;
          }
        }
        // Special handling for insufficient permissions errors
        else if (
          response.status === 403 &&
          errorMsg === 'Insufficient permissions' &&
          !url.includes('/api/v1/storageclient/seaweed/master')
        ) {
          if (!(errorMsg === lastToastMessage && now - lastToastTime < 1000)) {
            toast.error(errorMsg);
            lastToastMessage = errorMsg;
            lastToastTime = now;
          }
        } else if (
          options.method &&
          options.method !== 'GET' &&
          !url.includes('/api/v1/user/logout') &&
          !url.includes('/api/v1/user/refresh') &&
          !url.includes('node/system/check-feature-availability') &&
          !url.includes('/updates/bmc/refresh') &&
          !url.includes('/api/v1/pikvm/check-vendor') &&
          !url.includes('/api/v1/network/pf/update') &&
          !url.includes('/api/v1/compute/vms/')
        ) {
          if (!(errorMsg === lastToastMessage && now - lastToastTime < 1000)) {
            toast.error(errorMsg);
            lastToastMessage = errorMsg;
            lastToastTime = now;
          }
        }
        throw new Error(errorMsg);
      }
      return response;
    } catch (error) {
      // Only log error, do not show toast here to avoid duplicate toasts
      logger.error('API Error:', error.message);
      return Promise.reject(error);
    }
  },
};

export default api;
