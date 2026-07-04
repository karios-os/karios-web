import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders waiting status with yellow styling', () => {
    render(<StatusBadge status="Waiting" />);
    const badge = screen.getByText('Waiting');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('renders connected status with green styling', () => {
    render(<StatusBadge status="Connected" />);
    const badge = screen.getByText('Connected');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('renders disconnected status with red styling', () => {
    render(<StatusBadge status="Disconnected" />);
    const badge = screen.getByText('Disconnected');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('renders unknown status with gray styling', () => {
    render(<StatusBadge status="Unknown" />);
    const badge = screen.getByText('Unknown');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('handles case insensitive status', () => {
    render(<StatusBadge status="WAITING" />);
    const badge = screen.getByText('WAITING');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('applies custom className', () => {
    render(<StatusBadge status="Connected" className="custom-class" />);
    const badge = screen.getByText('Connected');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('custom-class');
  });
});
