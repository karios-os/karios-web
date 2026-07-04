import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SuccessBadge from './SuccessBadge';

describe('SuccessBadge Component', () => {
  it('should render "Success" text', () => {
    render(<SuccessBadge />);

    const successText = screen.getByText('Success');
    expect(successText).toBeInTheDocument();
  });

  it('should apply default styling classes', () => {
    render(<SuccessBadge />);

    const badge = screen.getByText('Success').closest('div');
    expect(badge).toHaveClass('flex', 'items-center', 'justify-center');
  });

  it('should apply custom className when provided', () => {
    const customClass = 'custom-success-class';
    render(<SuccessBadge className={customClass} />);

    const badge = screen.getByText('Success').closest('div');
    expect(badge).toHaveClass(customClass);
  });

  it('should maintain default classes when custom className is provided', () => {
    const customClass = 'custom-success-class';
    render(<SuccessBadge className={customClass} />);

    const badge = screen.getByText('Success').closest('div');
    expect(badge).toHaveClass('flex', 'items-center', 'justify-center', customClass);
  });
});
