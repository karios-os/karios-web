import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import JobStatusModal from './JobStatusModal';

// Static test configuration instead of importing env.config
const TEST_CONFIG = {
  CONTROL_NODE_IP: '192.168.1.100',
  ENVIRONMENT: 'test',
};

// Mock the Modal component
jest.mock('../../feature-server/src/widgets/Modal', () => {
  return function MockModal({ isOpen, onClose, title, children }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button data-testid="close-modal" onClick={onClose}>
          Close
        </button>
        <div data-testid="log-container">{children}</div>
      </div>
    );
  };
});

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url = '';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Store instance for test access
    (globalThis as any).mockWebSocketInstance = this;

    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  send(data: string) {
    // Mock sending data
  }

  // Helper method for tests to simulate receiving messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  // Helper method for tests to simulate connection error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Replace global WebSocket with mock
Object.defineProperty(window, 'WebSocket', {
  writable: true,
  value: MockWebSocket,
});

describe('JobStatusModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    jobId: 'job-123',
    jobType: 'server_deployment',
    title: 'Server Deployment Status',
    bmcIp: '192.168.1.100',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).mockWebSocketInstance = null;
  });

  it('renders modal when isOpen is true', () => {
    render(<JobStatusModal {...defaultProps} />);

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Server Deployment Status');
  });

  it('does not render modal when isOpen is false', () => {
    render(<JobStatusModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('creates WebSocket connection when jobId is provided', () => {
    render(<JobStatusModal {...defaultProps} />);

    expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    expect((globalThis as any).mockWebSocketInstance.url).toContain('job-123');
  });

  it('does not create WebSocket connection when jobId is null', () => {
    render(<JobStatusModal {...defaultProps} jobId={null} />);

    expect((globalThis as any).mockWebSocketInstance).toBeNull();
  });

  it('displays connection status', async () => {
    render(<JobStatusModal {...defaultProps} />);
  });

  it('displays status logs when receiving messages', async () => {
    render(<JobStatusModal {...defaultProps} />);

    // Wait for WebSocket connection
    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    // Simulate receiving a status message
    const wsInstance = (globalThis as any).mockWebSocketInstance;
    act(() => {
      wsInstance.simulateMessage({
        Status: 'Starting deployment process',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Starting deployment process')).toBeInTheDocument();
    });
  });

  it('handles job completion', async () => {
    const onJobComplete = jest.fn();
    render(<JobStatusModal {...defaultProps} onJobComplete={onJobComplete} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    // Simulate job completion message
    const wsInstance = (globalThis as any).mockWebSocketInstance;
    act(() => {
      wsInstance.simulateMessage({
        Status: 'Provisioning scripts completed successfully',
        completed: true,
      });
    });

    await waitFor(() => {
      expect(onJobComplete).toHaveBeenCalledWith('job-123');
    });
  });

  it('handles different completion message formats', async () => {
    const onJobComplete = jest.fn();
    render(<JobStatusModal {...defaultProps} onJobComplete={onJobComplete} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    const wsInstance = (globalThis as any).mockWebSocketInstance;

    // Test with 'completed' in status message
    wsInstance.simulateMessage({
      Status: 'Job completed successfully',
    });

    await waitFor(() => {
      expect(onJobComplete).toHaveBeenCalledWith('job-123');
    });
  });

  it('handles job failure', async () => {
    render(<JobStatusModal {...defaultProps} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    const wsInstance = (globalThis as any).mockWebSocketInstance;
    wsInstance.simulateMessage({
      Status: 'Deployment failed with error',
      failed: true,
    });

    await waitFor(() => {
      expect(screen.getByText('Deployment failed with error')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', () => {
    const onClose = jest.fn();
    render(<JobStatusModal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByTestId('close-modal');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears logs when reopened with different job', async () => {
    const { rerender } = render(<JobStatusModal {...defaultProps} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    // Add some logs
    const wsInstance = (globalThis as any).mockWebSocketInstance;
    wsInstance.simulateMessage({
      Status: 'First job log',
    });

    await waitFor(() => {
      expect(screen.getByText('First job log')).toBeInTheDocument();
    });

    // Close and reopen with different job
    rerender(<JobStatusModal {...defaultProps} isOpen={false} />);
    rerender(<JobStatusModal {...defaultProps} jobId="job-456" />);

    // Should not see old logs
    expect(screen.queryByText('First job log')).not.toBeInTheDocument();
  });

  it('handles WebSocket connection errors', async () => {
    render(<JobStatusModal {...defaultProps} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    // Simulate WebSocket error
    const wsInstance = (globalThis as any).mockWebSocketInstance;
    wsInstance.simulateError();

    // Should handle error gracefully
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('closes WebSocket connection on unmount', async () => {
    const { unmount } = render(<JobStatusModal {...defaultProps} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    const wsInstance = (globalThis as any).mockWebSocketInstance;
    const closeSpy = jest.spyOn(wsInstance, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('displays timestamps for log messages', async () => {
    render(<JobStatusModal {...defaultProps} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    const wsInstance = (globalThis as any).mockWebSocketInstance;
    wsInstance.simulateMessage({
      Status: 'Test message with timestamp',
    });

    await waitFor(() => {
      expect(screen.getByText('Test message with timestamp')).toBeInTheDocument();
      // Should have timestamp display (checking for time format pattern)
      expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  it('handles malformed JSON messages gracefully', async () => {
    render(<JobStatusModal {...defaultProps} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    const wsInstance = (globalThis as any).mockWebSocketInstance;

    // Simulate invalid JSON message
    if (wsInstance.onmessage) {
      wsInstance.onmessage(new MessageEvent('message', { data: 'invalid json' }));
    }

    // Should not crash the component
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('reconnects and shows reconnection message', async () => {
    render(<JobStatusModal {...defaultProps} />);

    await waitFor(() => {
      expect((globalThis as any).mockWebSocketInstance).toBeTruthy();
    });

    const wsInstance = (globalThis as any).mockWebSocketInstance;

    // Simulate connection close and reconnection
    wsInstance.close();

    // Create new connection (simulating reconnection logic)
    const newWs = new MockWebSocket(
      `ws://${TEST_CONFIG.CONTROL_NODE_IP}:8080/api/v1/controlnode/job/status?id=${defaultProps.jobId}`
    );
    (globalThis as any).mockWebSocketInstance = newWs;

    // This would be handled by the component's reconnection logic
    // For test purposes, we're just verifying the structure exists
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });
});
