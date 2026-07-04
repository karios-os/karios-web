import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from './summary';

// Mock the shared-state module
jest.mock('@karios-monorepo/shared-state', () => ({
  useVm: jest.fn(),
}));

const { useVm } = require('@karios-monorepo/shared-state');

describe('Dashboard Component', () => {
  beforeEach(() => {
    useVm.mockReturnValue({
      selectedVm: { name: 'test-vm', id: '123' },
      setSelectedVm: jest.fn(),
      vms: [],
      setVms: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with not available message when no panelUrl', () => {
    render(React.createElement(Dashboard));
    expect(screen.getByText('not available')).toBeInTheDocument();
  });

  it('renders grafana iframe when panelUrl is provided', () => {
    const panelUrl = 'http://localhost:3000/dashboard';
    render(React.createElement(Dashboard, { panelUrl }));

    const iframe = screen.getByTitle('Grafana Dashboard');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', panelUrl);
  });

  it('iframe has correct dimensions and properties', () => {
    const panelUrl = 'http://test.com/panel';
    render(React.createElement(Dashboard, { panelUrl }));

    const iframe = screen.getByTitle('Grafana Dashboard');
    expect(iframe).toHaveAttribute('width', '100%');
    expect(iframe).toHaveAttribute('height', '800');
    expect(iframe).toHaveAttribute('allowFullScreen');
    expect(iframe).toHaveAttribute('allow', 'fullscreen');
  });

  it('renders dashboard container with correct styling', () => {
    const result = render(React.createElement(Dashboard));
    const dashboardDiv = result.container.querySelector('.flex.flex-col.items-center.min-h-screen');
    expect(dashboardDiv).toBeInTheDocument();
  });

  it('uses selectedVm from hook', () => {
    render(React.createElement(Dashboard));
    expect(useVm).toHaveBeenCalled();
  });
});
