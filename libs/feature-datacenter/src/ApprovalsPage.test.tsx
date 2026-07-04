// libs/feature-datacenter/src/ApprovalsPage.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApprovalsPage from './ApprovalsPage';

// Mock the ApprovalsComponent since we're testing the wrapper
jest.mock('./ApprovalsComponent', () => {
  return function MockApprovalsComponent({ host }: { host: string }) {
    return <div data-testid="approvals-component">ApprovalsComponent with host: {host}</div>;
  };
});

describe('ApprovalsPage', () => {
  it('renders ApprovalsComponent with correct host prop', () => {
    const testHost = 'test-host.example.com';
    const { getByTestId } = render(<ApprovalsPage host={testHost} />);

    expect(getByTestId('approvals-component')).toBeInTheDocument();
    expect(getByTestId('approvals-component')).toHaveTextContent(
      `ApprovalsComponent with host: ${testHost}`
    );
  });

  it('passes different host values correctly', () => {
    const host1 = 'server1.example.com';
    const host2 = 'server2.example.com';

    const { getByTestId, rerender } = render(<ApprovalsPage host={host1} />);
    expect(getByTestId('approvals-component')).toHaveTextContent(
      `ApprovalsComponent with host: ${host1}`
    );

    rerender(<ApprovalsPage host={host2} />);
    expect(getByTestId('approvals-component')).toHaveTextContent(
      `ApprovalsComponent with host: ${host2}`
    );
  });

  it('renders with empty host string', () => {
    const { getByTestId } = render(<ApprovalsPage host="" />);

    expect(getByTestId('approvals-component')).toBeInTheDocument();
    expect(getByTestId('approvals-component')).toHaveTextContent('ApprovalsComponent with host:');
  });
});
