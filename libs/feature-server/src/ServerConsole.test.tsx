import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServerConsole from './ServerConsole';
import { useAppState, api } from '@karios-monorepo/shared-state';

// Mock the shared-state hooks and api
jest.mock('@karios-monorepo/shared-state', () => ({
  useAppState: jest.fn(),
  api: {
    fetch: jest.fn(),
  },
}));

// Declare mocks for global access
const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;
const mockApiFetch = api.fetch as jest.MockedFunction<typeof api.fetch>;

describe('ServerConsole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockClear();
  });

  it('1. should render without crashing', () => {
    // Arrange
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: null,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    expect(screen.getByTestId('server-console-container')).toBeInTheDocument();
  });

  it('2. should display no server selected message when selectedServer is null', () => {
    // Arrange
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: null,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    expect(screen.getByText('No server selected for console access.')).toBeInTheDocument();
    expect(screen.queryByTitle(/Server Console/)).not.toBeInTheDocument(); // iframe should not be present
  });

  it('3. should display no server selected message when selectedServer is undefined', () => {
    // Arrange
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: undefined,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    expect(screen.getByText('No server selected for console access.')).toBeInTheDocument();
    expect(screen.queryByTitle(/Server Console/)).not.toBeInTheDocument();
  });

  it('4. should render iframe when selectedServer has IP address', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.1.100',
      name: 'Test Server',
      id: '1',
    };

    const mockApiResponse = {
      host: '192.168.1.100',
      port: 7899,
    };

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert - should initially show loading
    expect(screen.getByText('Loading node console...')).toBeInTheDocument();

    // Wait for API call to complete and iframe to render
    await waitFor(() => {
      const iframe = screen.getByTitle('Server Console - Test Server');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'http://192.168.1.100:7899/vnc.html');
      expect(iframe).toHaveAttribute('title', 'Server Console - Test Server');
    });
  });

  it('5. should use IP address in title when server name is not provided', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.1.100',
      id: '1',
    };

    const mockApiResponse = {
      host: '192.168.1.100',
      port: 7899,
    };

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Wait for loading to complete and iframe to render
    await waitFor(() => {
      const iframe = screen.getByTitle('Server Console - 192.168.1.100');
      expect(iframe).toHaveAttribute('title', 'Server Console - 192.168.1.100');
    });
  });

  it('6. should update console URL when selectedServer changes', async () => {
    // Arrange
    const initialServer = {
      ip: '192.168.1.100',
      name: 'Test Server 1',
      id: '1',
    };

    const updatedServer = {
      ip: '192.168.1.200',
      name: 'Test Server 2',
      id: '2',
    };

    const mockState = {
      state: {
        selectedServer: initialServer,
      } as any,
    } as any;

    mockUseAppState.mockReturnValue(mockState);

    // Mock API responses for both calls
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ host: '192.168.1.100', port: 7899 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ host: '192.168.1.200', port: 7899 }),
      } as Response);

    // Act
    const { rerender } = render(<ServerConsole />);

    // Wait for initial render to complete
    await waitFor(() => {
      expect(screen.getByTitle('Server Console - Test Server 1')).toHaveAttribute(
        'src',
        'http://192.168.1.100:7899/vnc.html'
      );
    });

    // Update the mock to return new server
    mockState.state.selectedServer = updatedServer;

    await act(async () => {
      rerender(<ServerConsole />);
    });

    // Assert
    await waitFor(() => {
      expect(screen.getByTitle('Server Console - Test Server 2')).toHaveAttribute(
        'src',
        'http://192.168.1.200:7899/vnc.html'
      );
      expect(screen.getByTitle('Server Console - Test Server 2')).toHaveAttribute(
        'title',
        'Server Console - Test Server 2'
      );
    });
  });

  it('7. should have correct iframe attributes when server is selected', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.1.100',
      name: 'Test Server',
      id: '1',
    };

    const mockApiResponse = {
      host: '192.168.1.100',
      port: 7899,
    };

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Wait for API call to complete and iframe to render
    await waitFor(() => {
      const iframe = screen.getByTitle('Server Console - Test Server');
      expect(iframe).toHaveClass('w-full', 'h-full', 'border-none');
      expect(iframe).toHaveAttribute('allowFullScreen');
    });
  });

  it('8. should display correct container styling', () => {
    // Arrange
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: null,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    const container = screen.getByTestId('server-console-container');
    expect(container).toHaveClass('w-full', 'h-screen', 'border-none', 'mt-3');
  });

  it('9. should display correct warning message styling', () => {
    // Arrange
    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: null,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    const warningDiv = screen.getByText('No server selected for console access.').closest('div');
    expect(warningDiv).toHaveClass(
      'text-center',
      'p-4',
      'max-w-lg',
      'bg-yellow-50',
      'rounded-lg',
      'shadow-sm'
    );
    expect(screen.getByText('No server selected for console access.')).toHaveClass(
      'text-yellow-600'
    );
  });

  it('10. should handle server with empty string IP', () => {
    // Arrange
    const mockServer = {
      ip: '',
      name: 'Test Server',
      id: '1',
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    expect(screen.getByText('No server selected for console access.')).toBeInTheDocument();
    expect(screen.queryByTitle(/Server Console/)).not.toBeInTheDocument();
  });

  it('11. should handle server with null IP', () => {
    // Arrange
    const mockServer = {
      ip: null,
      name: 'Test Server',
      id: '1',
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    expect(screen.getByText('No server selected for console access.')).toBeInTheDocument();
    expect(screen.queryByTitle(/Server Console/)).not.toBeInTheDocument();
  });

  it('12. should handle server with undefined IP', () => {
    // Arrange
    const mockServer = {
      ip: undefined,
      name: 'Test Server',
      id: '1',
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    render(<ServerConsole />);

    // Assert
    expect(screen.getByText('No server selected for console access.')).toBeInTheDocument();
    expect(screen.queryByTitle(/Server Console/)).not.toBeInTheDocument();
  });

  it('13. should construct URL with port 6900 correctly', async () => {
    // Arrange
    const mockServer = {
      ip: '10.0.0.1',
      name: 'Production Server',
      id: 'prod-1',
    };

    // Mock API failure to test fallback behavior
    mockApiFetch.mockRejectedValueOnce(new Error('API failed'));

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Wait for API call to fail and error message to be shown
    await waitFor(() => {
      expect(screen.getByText('API failed')).toBeInTheDocument();
    });
  });

  it('14. should handle server object with only IP (minimal object)', async () => {
    // Arrange
    const mockServer = {
      ip: '172.16.0.1',
    };

    // Mock API failure to test error handling
    mockApiFetch.mockRejectedValueOnce(new Error('API failed'));

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Wait for API call to fail and error message to be shown
    await waitFor(() => {
      expect(screen.getByText('API failed')).toBeInTheDocument();
    });
  });

  it('15. should transition from no server to server selected state', async () => {
    // Arrange
    const mockState = {
      state: {
        selectedServer: null,
      } as any,
    } as any;

    mockUseAppState.mockReturnValue(mockState);

    // Act
    const { rerender } = render(<ServerConsole />);

    // Initial state - no server
    expect(screen.getByText('No server selected for console access.')).toBeInTheDocument();
    expect(screen.queryByTitle(/Server Console/)).not.toBeInTheDocument();

    // Update state to have a server
    const mockServer = {
      ip: '192.168.100.50',
      name: 'New Server',
      id: 'new-1',
    };

    mockState.state.selectedServer = mockServer;
    // Mock API call for the new server
    mockApiFetch.mockRejectedValueOnce(new Error('API failed'));

    await act(async () => {
      rerender(<ServerConsole />);
    });

    // Assert
    await waitFor(() => {
      expect(screen.queryByText('No server selected for console access.')).not.toBeInTheDocument();
      expect(screen.getByText('API failed')).toBeInTheDocument();
    });
  });

  // Auto-fetch Console Tests
  it('16. should automatically call node console API when server is mounted', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.116.132',
      name: 'Test Server',
      id: '1',
    };

    const mockApiResponse = {
      host: '192.168.116.132',
      port: 7899,
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Assert - API should be called automatically
    expect(mockApiFetch).toHaveBeenCalledWith(
      'http://192.168.116.132:8080/api/v1/console/node/ensure',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  });

  it('17. should automatically update console URL with API response data', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.116.132',
      name: 'Test Server',
      id: '1',
    };

    const mockApiResponse = {
      host: '192.168.116.132',
      port: 7899,
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Assert - console URL should be updated automatically
    await waitFor(() => {
      const iframe = screen.getByTitle('Server Console - Test Server');
      expect(iframe).toHaveAttribute('src', 'http://192.168.116.132:7899/vnc.html');
    });
  });

  it('18. should show loading state during automatic API call', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.116.132',
      name: 'Test Server',
      id: '1',
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    // Create a promise that we can control
    let resolvePromise: (value: any) => void;
    const mockPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockApiFetch.mockReturnValueOnce(mockPromise as any);

    // Act
    render(<ServerConsole />);

    // Assert - should show loading state automatically
    expect(screen.getByText('Loading node console...')).toBeInTheDocument();

    // Resolve the promise to clean up
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ host: '192.168.116.132', port: 7899 }),
    });
  });

  it('19. should handle API error and show error message', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.116.132',
      name: 'Test Server',
      id: '1',
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Assert - should show error message
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('20. should handle API response with missing data and show error', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.116.132',
      name: 'Test Server',
      id: '1',
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ host: null, port: null }),
    } as Response);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Assert - should show error message when data is missing
    await waitFor(() => {
      expect(screen.getByText('Invalid response: host or port missing')).toBeInTheDocument();
    });
  });

  it('21. should automatically retry API call when server changes', async () => {
    // Arrange
    const initialServer = {
      ip: '192.168.1.100',
      name: 'Server 1',
      id: '1',
    };

    const newServer = {
      ip: '192.168.1.200',
      name: 'Server 2',
      id: '2',
    };

    const mockState = {
      state: {
        selectedServer: initialServer,
      } as any,
    } as any;

    mockUseAppState.mockReturnValue(mockState);

    // Mock API responses
    mockApiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ host: '192.168.1.100', port: 7899 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ host: '192.168.1.200', port: 7899 }),
      } as Response);

    // Act - initial render
    const { rerender } = render(<ServerConsole />);

    // Wait for initial API call
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8080/api/v1/console/node/ensure',
        expect.any(Object)
      );
    });

    // Change server
    mockState.state.selectedServer = newServer;

    await act(async () => {
      rerender(<ServerConsole />);
    });

    // Assert - should call API again for new server
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        'http://192.168.1.200:8080/api/v1/console/node/ensure',
        expect.any(Object)
      );
    });
  });

  it('22. should handle successful API response with custom port', async () => {
    // Arrange
    const mockServer = {
      ip: '10.0.0.50',
      name: 'Custom Server',
      id: 'custom-1',
    };

    const mockApiResponse = {
      host: '10.0.0.50',
      port: 8899, // Custom port
    };

    mockUseAppState.mockReturnValue({
      state: {
        selectedServer: mockServer,
      } as any,
    } as any);

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);

    // Act
    await act(async () => {
      render(<ServerConsole />);
    });

    // Assert - should use the custom port from API response
    await waitFor(() => {
      const iframe = screen.getByTitle('Server Console - Custom Server');
      expect(iframe).toHaveAttribute('src', 'http://10.0.0.50:8899/vnc.html');
    });
  });

  it('23. should clear console when server is deselected', async () => {
    // Arrange
    const mockServer = {
      ip: '192.168.1.100',
      name: 'Test Server',
      id: '1',
    };

    const mockState = {
      state: {
        selectedServer: mockServer,
      } as any,
    } as any;

    mockUseAppState.mockReturnValue(mockState);

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ host: '192.168.1.100', port: 7899 }),
    } as Response);

    // Act - initial render with server
    const { rerender } = render(<ServerConsole />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTitle('Server Console - Test Server')).toBeInTheDocument();
    });

    // Change to no server
    mockState.state.selectedServer = null;

    await act(async () => {
      rerender(<ServerConsole />);
    });

    // Assert - should show no server message
    expect(screen.getByText('No server selected for console access.')).toBeInTheDocument();
    expect(screen.queryByTitle(/Server Console/)).not.toBeInTheDocument();
  });
});
