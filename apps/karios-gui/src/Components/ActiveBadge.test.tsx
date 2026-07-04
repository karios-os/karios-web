import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActiveBadge from './ActiveBadge';

describe('ActiveBadge Component', () => {
  it('should render "Active" when active prop is "yes"', () => {
    render(<ActiveBadge active="yes" />);

    const badge = screen.getByText('Active');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should render "Inactive" when active prop is not "yes"', () => {
    render(<ActiveBadge active="no" />);

    const badge = screen.getByText('Inactive');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should apply custom className when provided', () => {
    const customClass = 'custom-test-class';
    render(<ActiveBadge active="yes" className={customClass} />);

    const badge = screen.getByText('Active');
    expect(badge).toHaveClass(customClass);
  });

  it('should have default styling classes', () => {
    render(<ActiveBadge active="yes" />);

    const badge = screen.getByText('Active');
    expect(badge).toHaveClass('text-xs', 'px-2', 'py-1', 'rounded-full');
  });
});
