import {
  parseJsonWithCleanup,
  fetchWithErrorHandling,
  fetchApiResponse,
  validateApiResponse,
  formatErrorMessage,
  retryWithBackoff,
  debounce,
} from './utils';

// Mock fetch for testing
globalThis.fetch = jest.fn();

describe('JSON Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseJsonWithCleanup', () => {
    it('should parse valid JSON', () => {
      const validJson = '{"success": true, "data": {"test": "value"}}';
      const result = parseJsonWithCleanup(validJson);
      expect(result).toEqual({ success: true, data: { test: 'value' } });
    });

    it('should handle trailing commas', () => {
      const jsonWithTrailingComma = '{"success": true, "data": {"test": "value",},}';
      const result = parseJsonWithCleanup(jsonWithTrailingComma);
      expect(result).toEqual({ success: true, data: { test: 'value' } });
    });

    it('should fix misplaced report_formats', () => {
      const malformedJson = `{
        "success": true,
        "data": {
          "scans": [
            {"id": "test"},
            "report_formats": [
              {"format": "PDF", "url": "/test"},
            ],
          ]
        }
      }`;

      const result = parseJsonWithCleanup(malformedJson);
      expect(result.success).toBe(true);
      expect(result.data.scans).toBeDefined();
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{"invalid": json}';
      expect(() => parseJsonWithCleanup(invalidJson)).toThrow('Invalid JSON response from server');
    });
  });

  describe('fetchWithErrorHandling', () => {
    it('should handle successful response', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue('{"success": true, "data": {}}'),
      };
      (globalThis.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await fetchWithErrorHandling('http://test.com');
      expect(result).toEqual({ success: true, data: {} });
    });

    it('should throw error for HTTP error', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      (globalThis.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(fetchWithErrorHandling('http://test.com')).rejects.toThrow(
        'HTTP error! status: 404'
      );
    });
  });

  describe('validateApiResponse', () => {
    it('should validate correct response structure', () => {
      const validResponse = { success: true, data: { test: 'value' } };
      expect(validateApiResponse(validResponse)).toBe(true);
    });

    it('should reject response without success field', () => {
      const invalidResponse = { data: { test: 'value' } };
      expect(validateApiResponse(invalidResponse)).toBe(false);
    });

    it('should reject successful response without data', () => {
      const invalidResponse = { success: true };
      expect(validateApiResponse(invalidResponse)).toBe(false);
    });

    it('should validate required fields', () => {
      const response = { success: true, data: { field1: 'value1', field2: 'value2' } };
      expect(validateApiResponse(response, ['field1', 'field2'])).toBe(true);
      expect(validateApiResponse(response, ['field1', 'field3'])).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format Error objects', () => {
      const error = new Error('Test error message');
      expect(formatErrorMessage(error)).toBe('Test error message');
    });

    it('should format string errors', () => {
      expect(formatErrorMessage('String error')).toBe('String error');
    });

    it('should use default message for unknown errors', () => {
      expect(formatErrorMessage(null)).toBe('An unknown error occurred');
      expect(formatErrorMessage(123, 'Custom default')).toBe('Custom default');
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(successFn);
      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(retryWithBackoff(failFn, 2, 10)).rejects.toThrow('Always fails');
      expect(failFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3');
    });
  });
});
