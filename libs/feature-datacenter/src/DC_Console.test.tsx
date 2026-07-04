import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DC_Console from './DC_Console';

// Mock the shared state hook
const mockUseDataCenter = jest.fn();

jest.mock('@karios-monorepo/shared-state', () => ({
  useDataCenter: () => mockUseDataCenter(),
}));

describe('DC_Console', () => {
  const mockDataCenterState = {
    selectedNode: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDataCenter.mockReturnValue(mockDataCenterState);
  });

  it('renders console container', () => {
    render(<DC_Console />);

    const container = screen.getByTestId('console-container');
    expect(container).toHaveClass('w-full', 'h-screen', 'border-none', 'mt-3');
  });

  it.skip('renders iframe with fallback URL when no console URL is available', () => {
    render(<DC_Console />);

    const iframe = screen.getByTitle('Data Center Console');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'http://192.168.116.134:6080/vnc.html');
  });

  it('renders iframe when console URL is available', () => {
    const mockStateWithConsoleUrl = {
      selectedNode: {
        consoleUrl: 'http://localhost:6080/vnc.html',
      },
    };

    mockUseDataCenter.mockReturnValue(mockStateWithConsoleUrl);

    render(<DC_Console />);

    const iframe = screen.getByTitle('Data Center Console');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'http://localhost:6080/vnc.html');
  });

  it.skip('updates iframe src when console URL changes', () => {
    const { rerender } = render(<DC_Console />);

    // Initially shows fallback iframe
    const initialIframe = screen.getByTitle('Data Center Console');
    expect(initialIframe).toBeInTheDocument();
    expect(initialIframe).toHaveAttribute('src', 'http://192.168.116.134:6080/vnc.html');

    // Update state to include console URL
    const mockStateWithConsoleUrl = {
      selectedNode: {
        consoleUrl: 'http://localhost:6080/vnc.html',
      },
    };

    mockUseDataCenter.mockReturnValue(mockStateWithConsoleUrl);
    rerender(<DC_Console />);

    const iframe = screen.getByTitle('Data Center Console');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'http://localhost:6080/vnc.html');
  });

  it.skip('handles selectedNode being null', () => {
    mockUseDataCenter.mockReturnValue({
      selectedNode: null,
    });

    render(<DC_Console />);

    const iframe = screen.getByTitle('Data Center Console');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'http://192.168.116.134:6080/vnc.html');
  });

  it.skip('handles selectedNode without consoleUrl', () => {
    mockUseDataCenter.mockReturnValue({
      selectedNode: {
        ip: '192.168.1.100',
        // no consoleUrl property
      },
    });

    render(<DC_Console />);

    const iframe = screen.getByTitle('Data Center Console');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'http://192.168.116.134:6080/vnc.html');
  });
});
