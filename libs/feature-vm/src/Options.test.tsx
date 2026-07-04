import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import Options from './Options';

// Mock the OsInstallation component
jest.mock('./Option_OsInstallation', () => {
  return function OsInstallation() {
    return React.createElement(
      'div',
      { 'data-testid': 'os-installation' },
      'OS Installation Component'
    );
  };
});

describe('Options Component', () => {
  it('renders Options component', () => {
    render(React.createElement(Options));
    expect(document.body).toBeInTheDocument();
  });

  it('renders with correct container styling', () => {
    const { container } = render(React.createElement(Options));
    const optionsDiv = container.querySelector('.p-4');
    expect(optionsDiv).toBeInTheDocument();
  });

  it('includes OsInstallation component', () => {
    const { getByTestId } = render(React.createElement(Options));
    expect(getByTestId('os-installation')).toBeInTheDocument();
  });
});
