import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ServerFirewall from './ServerFirewall';

// Mock the Monaco Editor
jest.mock('@monaco-editor/react', () => {
  return function MockMonacoEditor({ value, onChange, onMount }: any) {
    React.useEffect(() => {
      if (onMount) {
        const mockEditor = {
          getModel: jest.fn(() => ({
            getLineContent: jest.fn(() => 'pass in all'),
            getLineMaxColumn: jest.fn(() => 20),
          })),
        };
        const mockMonaco = {
          languages: {
            register: jest.fn(),
            setMonarchTokensProvider: jest.fn(),
          },
          editor: {
            setModelLanguage: jest.fn(),
            setModelMarkers: jest.fn(),
          },
          MarkerSeverity: {
            Error: 8,
          },
        };
        onMount(mockEditor, mockMonaco);
      }
    }, [onMount]);

    return (
      <textarea
        data-testid="monaco-editor"
        value={value || ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={{ width: '100%', height: '400px' }}
      />
    );
  };
});

// Mock the hooks
const mockPermissions = { NETWORK_MANAGE: true };
const mockSelectedServer = { ip: '192.168.1.1' };
const mockFirewall = {
  loading: false,
  rules: 'pass in all\nblock out all',
  originalRules: 'pass in all\nblock out all',
  revertCountdown: null,
  isCancellingRevert: false,
  notification: null,
  id: null,
};

const mockFirewallActions = {
  fetchFirewallRules: jest.fn(),
  updateFirewallRules: jest.fn(),
  cancelFirewallRevert: jest.fn(),
  setFirewallNotification: jest.fn(),
  setFirewallRevertCountdown: jest.fn(),
  setFirewallId: jest.fn(),
};

jest.mock('@karios-monorepo/shared-state', () => ({
  usePermissions: jest.fn(),
  useServer: jest.fn(),
  useFirewall: jest.fn(),
}));

// Mock clipboard API
const mockWriteText = jest.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('ServerFirewall Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirewallActions.fetchFirewallRules.mockResolvedValue('pass in all\nblock out all');
    mockWriteText.mockClear();

    // Set up default mock implementations
    const { usePermissions, useServer, useFirewall } = require('@karios-monorepo/shared-state');
    usePermissions.mockReturnValue({ permissions: mockPermissions });
    useServer.mockReturnValue({ selectedServer: mockSelectedServer });
    useFirewall.mockReturnValue({
      firewall: mockFirewall,
      ...mockFirewallActions,
    });
  });

  // Test 1: Component renders with proper permissions
  test('renders firewall component when user has NETWORK_MANAGE permission', () => {
    render(<ServerFirewall />);

    expect(screen.getByText('Packet Filter Rules')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    // Check for buttons by their SVG content since they only contain icons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2); // Cancel, Save (Copy button is commented out)
  });

  // Test 2: Component doesn't render without permissions
  test('does not render firewall component when user lacks NETWORK_MANAGE permission', () => {
    const { usePermissions } = require('@karios-monorepo/shared-state');
    usePermissions.mockReturnValue({ permissions: { NETWORK_MANAGE: false } });

    render(<ServerFirewall />);

    expect(screen.queryByText('Packet Filter Rules')).not.toBeInTheDocument();
  });

  // Test 3: Loading state display
  test('displays loading state when firewall is loading', () => {
    const { useFirewall } = require('@karios-monorepo/shared-state');
    useFirewall.mockReturnValue({
      firewall: { ...mockFirewall, loading: true },
      ...mockFirewallActions,
    });

    render(<ServerFirewall />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Packet Filter Rules')).not.toBeInTheDocument();
  });

  // Test 4: Fetches firewall rules on mount
  test.skip('fetches firewall rules when component mounts with selected server', async () => {
    render(<ServerFirewall />);

    await waitFor(() => {
      expect(mockFirewallActions.fetchFirewallRules).toHaveBeenCalledWith('192.168.1.1');
    });
  });

  // Test 5: Text editing and change detection
  test.skip('detects changes when user edits firewall rules', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(editor, 'pass in all\npass out tcp port 443');

    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });
  });

  // Test 6: Copy to clipboard functionality
  test.skip('copies firewall rules to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    // Find the copy button by its position (second button with no text)
    const buttons = screen.getAllByRole('button', { name: '' });
    const copyButton = buttons[0]; // First icon-only button should be copy
    await user.click(copyButton);

    // The copy functionality triggers a notification
    await waitFor(
      () => {
        expect(mockFirewallActions.setFirewallNotification).toHaveBeenCalledWith({
          message: 'Copied!',
          type: 'success',
        });
      },
      { timeout: 2000 }
    );
  });

  // Test 7: Save functionality with validation
  test.skip('validates critical ports before saving firewall rules', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    // Edit rules to remove critical ports
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(editor, 'block in all\nblock out all');

    // Find the save button by its position (second button with no text, after copy)
    const buttons = screen.getAllByRole('button', { name: '' });
    const saveButton = buttons[1]; // Second icon-only button should be save
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockFirewallActions.setFirewallNotification).toHaveBeenCalledWith({
        message: expect.stringContaining(
          'Please add the following ports into the pass default ruleset'
        ),
        type: 'error',
      });
    });
  });

  // Test 8: Cancel changes functionality
  test.skip('cancels changes and reverts to original rules', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    // Make changes
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(editor, 'pass in all\npass out tcp port 443');

    // Cancel changes
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(editor).toHaveValue('pass in all\nblock out all');
      expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
    });
  });

  // Test 9: Revert countdown functionality
  test('displays revert countdown and confirm button when countdown is active', () => {
    const { useFirewall } = require('@karios-monorepo/shared-state');
    useFirewall.mockReturnValue({
      firewall: { ...mockFirewall, revertCountdown: 30, id: 'test-id' },
      ...mockFirewallActions,
    });

    render(<ServerFirewall />);

    expect(screen.getByText(/Changes will revert in:/)).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm changes/i })).toBeInTheDocument();
  });

  // Test 10: Confirm changes functionality
  test.skip('confirms firewall changes when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const { useFirewall } = require('@karios-monorepo/shared-state');
    useFirewall.mockReturnValue({
      firewall: { ...mockFirewall, revertCountdown: 30, id: 'test-id' },
      ...mockFirewallActions,
    });

    mockFirewallActions.cancelFirewallRevert.mockResolvedValue({ success: true });

    render(<ServerFirewall />);

    const confirmButton = screen.getByRole('button', { name: /confirm changes/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockFirewallActions.cancelFirewallRevert).toHaveBeenCalledWith(
        '192.168.1.1',
        'test-id'
      );
    });
  });

  // Test 11: Successful save operation
  test.skip('successfully saves firewall rules and updates state', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    // Mock successful API response
    mockFirewallActions.updateFirewallRules.mockResolvedValue({ id: 'new-firewall-id' });

    // Edit rules with valid critical ports
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(
      editor,
      'pass in all\npass out tcp port 22\npass out tcp port 80\npass out tcp port 443\npass out tcp port 8080\npass out tcp port 8081'
    );

    // Find the save button and click it
    const buttons = screen.getAllByRole('button', { name: '' });
    const saveButton = buttons[1]; // Second icon-only button should be save
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockFirewallActions.updateFirewallRules).toHaveBeenCalledWith(
        '192.168.1.1',
        expect.any(String)
      );
      expect(mockFirewallActions.setFirewallId).toHaveBeenCalledWith('new-firewall-id');
    });
  });

  // Test 12: API error handling with error markers
  test.skip('handles API errors and displays error markers', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    // Mock API error response with line number
    mockFirewallActions.updateFirewallRules.mockResolvedValue({
      error: 'pf.conf.new:5: syntax error',
    });

    // Edit rules with valid critical ports
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(
      editor,
      'pass in all\npass out tcp port 22\npass out tcp port 80\npass out tcp port 443\npass out tcp port 8080\npass out tcp port 8081'
    );

    // Find the save button and click it
    const buttons = screen.getAllByRole('button', { name: '' });
    const saveButton = buttons[1];
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockFirewallActions.updateFirewallRules).toHaveBeenCalled();
      expect(mockFirewallActions.setFirewallNotification).toHaveBeenCalledWith({
        message: 'pf.conf.new:5: syntax error',
        type: 'error',
      });
    });
  });

  // Test 13: Generic error handling in try-catch block
  test.skip('handles generic errors during save operation', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    // Mock API to throw an error
    mockFirewallActions.updateFirewallRules.mockRejectedValue(
      new Error('Network connection failed')
    );

    // Edit rules with valid critical ports
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(
      editor,
      'pass in all\npass out tcp port 22\npass out tcp port 80\npass out tcp port 443\npass out tcp port 8080\npass out tcp port 8081'
    );

    // Find the save button and click it
    const buttons = screen.getAllByRole('button', { name: '' });
    const saveButton = buttons[1];
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockFirewallActions.updateFirewallRules).toHaveBeenCalled();
      expect(mockFirewallActions.setFirewallNotification).toHaveBeenCalledWith({
        message: 'Network connection failed',
        type: 'error',
      });
    });
  });

  // Test 14: Generic error handling with non-Error object
  test.skip('handles non-Error exceptions during save operation', async () => {
    const user = userEvent.setup();
    render(<ServerFirewall />);

    // Mock API to throw a non-Error object
    mockFirewallActions.updateFirewallRules.mockRejectedValue('String error');

    // Edit rules with valid critical ports
    const editor = screen.getByTestId('monaco-editor');
    await user.clear(editor);
    await user.type(
      editor,
      'pass in all\npass out tcp port 22\npass out tcp port 80\npass out tcp port 443\npass out tcp port 8080\npass out tcp port 8081'
    );

    // Find the save button and click it
    const buttons = screen.getAllByRole('button', { name: '' });
    const saveButton = buttons[1];
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockFirewallActions.updateFirewallRules).toHaveBeenCalled();
      expect(mockFirewallActions.setFirewallNotification).toHaveBeenCalledWith({
        message: 'An error occurred while updating firewall rules.',
        type: 'error',
      });
    });
  });
});
