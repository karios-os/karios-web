import { fetchVMsList } from './apiService';
import envConfig from '../../../../runtime-config';
// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    // Mock axios instance methods if needed
  })),
}));

// Mock fetch globally
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('API Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetchVMsList', () => {
    const mockServerIp = '192.168.1.100';
    const mockVMsData = [
      { id: 1, name: 'VM-1', status: 'running' },
      { id: 2, name: 'VM-2', status: 'stopped' },
    ];

    it('successfully fetches VMs list', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockVMsData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchVMsList(mockServerIp);

      expect(mockFetch).toHaveBeenCalledWith(
        `${envConfig().PROTOCOL}://${mockServerIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list`
      );
      expect(result).toEqual(mockVMsData);
    });

    it('throws error when serverIp is not provided', async () => {
      await expect(fetchVMsList('')).rejects.toThrow('Server IP is required to fetch VMs.');
      await expect(fetchVMsList(null as any)).rejects.toThrow(
        'Server IP is required to fetch VMs.'
      );
      await expect(fetchVMsList(undefined as any)).rejects.toThrow(
        'Server IP is required to fetch VMs.'
      );
    });

    it('handles HTTP error responses', async () => {
      const errorMessage = 'Server not found';
      const mockErrorResponse = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ message: errorMessage }),
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      await expect(fetchVMsList(mockServerIp)).rejects.toThrow(errorMessage);
      expect(mockFetch).toHaveBeenCalledWith(
        `${envConfig().PROTOCOL}://${mockServerIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list`
      );
    });

    it('handles HTTP error responses with invalid JSON', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      await expect(fetchVMsList(mockServerIp)).rejects.toThrow('Failed to parse error response');
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(fetchVMsList(mockServerIp)).rejects.toThrow('Network error');
    });

    it('logs errors appropriately', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: 'Bad request' }),
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      try {
        await fetchVMsList(mockServerIp);
      } catch (error) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith('Error fetching VMs:', 400, {
        message: 'Bad request',
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        `Error in fetchVMsList for IP ${mockServerIp}:`,
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('constructs correct URL with server IP', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const testServerIp = '10.0.0.1';
      await fetchVMsList(testServerIp);

      expect(mockFetch).toHaveBeenCalledWith(
        `${envConfig().PROTOCOL}://${testServerIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/vms/list`
      );
    });

    it('handles empty VMs list response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchVMsList(mockServerIp);

      expect(result).toEqual([]);
    });

    it('handles response with null data', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await fetchVMsList(mockServerIp);

      expect(result).toBeNull();
    });
  });
});
