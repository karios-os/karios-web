import { api, logger } from '@karios-monorepo/shared-state';

export const parseJsonWithCleanup = (responseText: string): any => {
  let cleanedResponse = responseText.replace(/,(\s*[}\]])/g, '$1');

  if (cleanedResponse.includes('"report_formats"')) {
    cleanedResponse = cleanedResponse.replace(
      /},(\s*)"report_formats":\s*\[([\s\S]*?)\](\s*)\]/,
      ',"report_formats":[$2]}$3]'
    );
  }

  try {
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    logger.error('JSON Parse Error', {
      parseError,
      originalResponse: responseText,
      cleanedResponse,
    });
    throw new Error('Invalid JSON response from server');
  }
};

export const fetchWithErrorHandling = async (url: string, options?: RequestInit): Promise<any> => {
  const response = await api.fetch(url, options);

  if (!response.ok) {
    return null;
  }

  const responseText = await response.text();

  return parseJsonWithCleanup(responseText);
};

export const fetchApiResponse = async <T>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data: T }> => {
  const result = await fetchWithErrorHandling(url, options);

  if (!result.success || !result.data) {
    throw new Error('API returned unsuccessful response or missing data');
  }

  return result;
};

export const validateApiResponse = (response: any, requiredFields: string[] = []): boolean => {
  if (!response || typeof response !== 'object') {
    return false;
  }

  if (typeof response.success !== 'boolean') {
    return false;
  }

  if (response.success && !response.data) {
    return false;
  }

  if (response.success && requiredFields.length > 0) {
    const data = response.data;
    return requiredFields.every((field) => field in data);
  }

  return true;
};

export const formatErrorMessage = (
  error: unknown,
  defaultMessage = 'An unknown error occurred'
): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return defaultMessage;
};

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
