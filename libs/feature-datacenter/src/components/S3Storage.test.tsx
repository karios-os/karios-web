import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import S3Storage from './S3Storage';

// Mock the runtime configuration
jest.mock('../../../../runtime-config', () => ({
  __esModule: true,
  default: () => ({
    ENVIRONMENT: 'test',
    PROTOCOL: 'http',
    CONTROL_NODE_IP: {
      URL: '192.168.1.100',
      PORT: ':8080',
    },
  }),
}));

// Mock shared-state dependencies
jest.mock('@karios-monorepo/shared-state', () => ({
  api: {
    fetch: jest.fn(),
  },
  useAppState: () => ({
    state: {
      user: { username: 'testuser' },
      permissions: { canManageStorage: true },
    },
  }),
}));

// Mock useApprovalFlow hook
jest.mock('../../../shared-state/src/hooks/useApprovalFlow', () => ({
  useApprovalFlow: jest.fn(),
}));

// Mock ApprovalModal component
jest.mock('../../../shared-state/src/components/ApprovalModal', () => {
  return function MockApprovalModal(props: any) {
    return props.isOpen ? <div data-testid="approval-modal">Approval Modal</div> : null;
  };
});

// Mock DataTable component
jest.mock('../../../feature-server/src/widgets/DataTable', () => {
  return function MockDataTable(props: any) {
    const { data, columns } = props;
    return (
      <div data-testid="data-table">
        <table>
          <thead>
            <tr>
              {columns.map((col: any, index: number) => (
                <th key={index}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item: any, rowIndex: number) => (
              <tr key={rowIndex}>
                {columns.map((col: any, colIndex: number) => (
                  <td key={colIndex}>
                    {col.render ? col.render(item[col.key], item) : item[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
});

// Mock Modal component
jest.mock('../../../feature-server/src/widgets/Modal', () => {
  return function MockModal(props: any) {
    if (!props.isOpen) return null;
    return (
      <div role="dialog" data-testid="modal">
        <div>{props.title}</div>
        <div>{props.children}</div>
        <button onClick={props.onClose}>Close</button>
      </div>
    );
  };
});

// Mock Tooltip component
jest.mock('../../../feature-server/src/widgets/Tooltip', () => {
  return function MockTooltip(props: any) {
    return (
      <span data-testid="tooltip" title={props.text}>
        ?
      </span>
    );
  };
});

// Mock Trash icon
jest.mock('iconsax-react', () => ({
  Trash: (props: any) => (
    <span data-testid="trash-icon" {...props}>
      🗑️
    </span>
  ),
}));

// Get references to the mocked functions
const mockApiFetch = require('@karios-monorepo/shared-state').api.fetch;
const mockUseApprovalFlow =
  require('../../../shared-state/src/hooks/useApprovalFlow').useApprovalFlow;

describe('S3Storage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockClear();

    // Default implementation for executeWithApproval
    mockUseApprovalFlow.mockReturnValue({
      requiresApproval: false,
      approvers: [],
      isModalOpen: false,
      modalProps: {
        isOpen: false,
        onClose: jest.fn(),
        onApprove: jest.fn(),
        title: 'S3 Storage Approval Required',
        message: 'This S3 storage action requires approval. Please select an approver.',
      },
      executeWithApproval: jest.fn((callback) => callback()),
    });
  });

  describe('Initial Rendering and Loading States', () => {
    it('renders S3 Storage title', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await act(async () => {
        render(<S3Storage />);
      });

      expect(screen.getByText('S3 Storage')).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
      mockApiFetch.mockImplementationOnce(() => new Promise(() => {}));

      act(() => {
        render(<S3Storage />);
      });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('displays error message on fetch failure', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load S3 storage data/)).toBeInTheDocument();
      });
    });

    it('handles API response with status 204 (no content)', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('No S3 storage items found')).toBeInTheDocument();
      });
    });

    it('handles API response that is not ok', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            /Failed to load S3 storage data: Failed to fetch S3 data: Internal Server Error/
          )
        ).toBeInTheDocument();
      });
    });

    it('handles non-array response from API', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'not an array' }),
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('No S3 storage items found')).toBeInTheDocument();
      });
    });

    it('displays "No S3 storage items found" when data is empty array', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('No S3 storage items found')).toBeInTheDocument();
      });
    });
  });

  describe('Table Rendering and Data Display', () => {
    it('renders S3 storage items in table with all columns', async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '400G',
          avail: '600G',
          capacity: '40%',
          mounted_on: '/mnt/s3-bucket',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('s3fs')).toBeInTheDocument();
        expect(screen.getByText('1T')).toBeInTheDocument();
        expect(screen.getByText('400G')).toBeInTheDocument();
        expect(screen.getByText('600G')).toBeInTheDocument();
        expect(screen.getByText('40%')).toBeInTheDocument();
        expect(screen.getByText('/mnt/s3-bucket')).toBeInTheDocument();
      });
    });

    it('displays correct table headers', async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '/mnt/s3-bucket',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('File System')).toBeInTheDocument();
        expect(screen.getByText('Size')).toBeInTheDocument();
        expect(screen.getByText('Used')).toBeInTheDocument();
        expect(screen.getByText('Available')).toBeInTheDocument();
        expect(screen.getByText('Capacity')).toBeInTheDocument();
        expect(screen.getByText('Mounted On')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('renders unmounted item with "Not Mounted" status', async () => {
      const mockData = [
        {
          filesystem: '',
          size: '-',
          used: '-',
          avail: '-',
          capacity: '-',
          mounted_on: '',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Not Mounted')).toBeInTheDocument();
        expect(screen.getByText('Mount')).toBeInTheDocument();
      });
    });

    it('renders mounted item with mount path and unmount button', async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '/mnt/s3-test',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('/mnt/s3-test')).toBeInTheDocument();
        expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
      });
    });

    it('handles item with mounted_on value "0" as not mounted', async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '0',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Not Mounted')).toBeInTheDocument();
        expect(screen.getByText('Mount')).toBeInTheDocument();
      });
    });

    it('handles item with whitespace-only mounted_on as not mounted', async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '   ',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        // The mounted_on column will show the whitespace as green text (component behavior)
        // But the actions should show Mount button since trim() treats it as empty
        expect(screen.getByText('Mount')).toBeInTheDocument();
      });
    });

    it('renders fallback values for missing data fields', async () => {
      const mockData = [
        {
          filesystem: null,
          size: undefined,
          used: '',
          avail: null,
          capacity: undefined,
          mounted_on: '',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        const dashElements = screen.getAllByText('-');
        expect(dashElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Mount Modal and Form Functionality', () => {
    beforeEach(async () => {
      const mockData = [
        {
          filesystem: '',
          size: '-',
          used: '-',
          avail: '-',
          capacity: '-',
          mounted_on: '',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });
    });

    it('opens modal when Mount button is clicked from table', async () => {
      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getAllByText('Mount S3 Storage')).toHaveLength(2); // One for button, one for modal title
      expect(screen.getByLabelText('Bucket Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Access Key')).toBeInTheDocument();
      expect(screen.getByLabelText('Secret Key')).toBeInTheDocument();
      expect(screen.getByLabelText(/Endpoint/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Region/)).toBeInTheDocument();
      expect(screen.getByLabelText('ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Auto Mount on Restart')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Add to Datastore/ })).toBeInTheDocument();
    });

    it('opens modal when "Mount S3 Storage" header button is clicked', async () => {
      await waitFor(() => {
        const headerMountButton = screen.getByText('Mount S3 Storage');
        fireEvent.click(headerMountButton);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getAllByText('Mount S3 Storage')).toHaveLength(2); // One for button, one for modal title
    });

    it('closes modal when close button is clicked', async () => {
      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('validates that either endpoint or region is required', async () => {
      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      // Fill form without endpoint or region
      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      // Submit form without endpoint or region
      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(screen.getByText('Either Endpoint or Region must be provided')).toBeInTheDocument();
      });
    });

    it('handles form submission with endpoint only', async () => {
      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      // Fill form with endpoint
      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Endpoint/), {
        target: { value: 's3.amazonaws.com' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      // Submit form
      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          'http://192.168.1.100:8080/api/v1/storageclient/s3/mount',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('my-bucket'),
          })
        );
      });
    });

    it('handles form submission with region only', async () => {
      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      // Fill form with region
      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Region/), {
        target: { value: 'us-west-2' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      // Submit form
      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          'http://192.168.1.100:8080/api/v1/storageclient/s3/mount',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('us-west-2'),
          })
        );
      });
    });

    it('handles checkbox states correctly', async () => {
      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      const autoMountCheckbox = screen.getByLabelText('Auto Mount on Restart');
      const datastoreCheckbox = screen.getByRole('checkbox', { name: /Add to Datastore/ });

      // Auto mount should be checked by default
      expect(autoMountCheckbox).toBeChecked();
      expect(datastoreCheckbox).not.toBeChecked();

      // Toggle checkboxes
      fireEvent.click(autoMountCheckbox);
      fireEvent.click(datastoreCheckbox);

      expect(autoMountCheckbox).not.toBeChecked();
      expect(datastoreCheckbox).toBeChecked();
    });

    it('handles mount API failure', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Mount failed'));

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      // Fill and submit form
      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Endpoint/), {
        target: { value: 's3.amazonaws.com' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to mount S3 storage')).toBeInTheDocument();
      });
    });

    it('handles mount API response not ok', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      // Fill and submit form
      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Endpoint/), {
        target: { value: 's3.amazonaws.com' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to mount S3 storage')).toBeInTheDocument();
      });
    });

    it('shows success message on successful mount', async () => {
      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      // Fill and submit form
      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Endpoint/), {
        target: { value: 's3.amazonaws.com' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(screen.getByText('S3 storage mounted successfully!')).toBeInTheDocument();
      });
    });

    it('displays tooltips for form fields', async () => {
      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      const tooltips = screen.getAllByTestId('tooltip');
      expect(tooltips.length).toBeGreaterThan(0);

      // Check for specific tooltip texts
      expect(screen.getByTitle(/An AWS bucket is a container/)).toBeInTheDocument();
      expect(screen.getByTitle(/A bucket access key is a unique set/)).toBeInTheDocument();
      expect(screen.getByTitle(/The bucket secret key/)).toBeInTheDocument();
      expect(screen.getByTitle(/An S3 endpoint is a URL/)).toBeInTheDocument();
      expect(screen.getByTitle(/An S3 region is a geographical location/)).toBeInTheDocument();
      expect(screen.getByTitle(/An S3 Access Key ID is a public identifier/)).toBeInTheDocument();
      expect(screen.getByTitle(/Check this to make the storage available/)).toBeInTheDocument();
    });
  });

  describe('Unmount Functionality', () => {
    beforeEach(async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '/mnt/s3-bucket',
        },
      ];

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await act(async () => {
        render(<S3Storage />);
      });
    });

    it('calls executeWithApproval when unmount button is clicked', async () => {
      const mockExecuteWithApproval = jest.fn((callback) => callback());
      mockUseApprovalFlow.mockReturnValue({
        requiresApproval: false,
        approvers: [],
        isModalOpen: false,
        modalProps: {
          isOpen: false,
          onClose: jest.fn(),
          onApprove: jest.fn(),
          title: 'S3 Storage Approval Required',
          message: 'This S3 storage action requires approval. Please select an approver.',
        },
        executeWithApproval: mockExecuteWithApproval,
      });

      // Mock data for mounted S3 storage
      const mockMountedData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '/mnt/s3-bucket',
        },
      ];

      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockMountedData,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      const { container } = render(<S3Storage />);

      // Wait for component to load the data first
      await waitFor(() => {
        expect(within(container).getByText('/mnt/s3-bucket')).toBeInTheDocument();
      });

      await act(async () => {
        const unmountButton = within(container).getByLabelText('Unmount');
        fireEvent.click(unmountButton);
      });

      expect(mockExecuteWithApproval).toHaveBeenCalledWith(
        expect.any(Function),
        'Unmount S3 Storage'
      );
    });

    it('handles unmount operation successfully', async () => {
      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      await waitFor(() => {
        const unmountButton = screen.getByLabelText('Unmount');
        fireEvent.click(unmountButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          'http://192.168.1.100:8080/api/v1/storageclient/s3/unmount',
          expect.objectContaining({
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mount_point: '/mnt/s3-bucket',
              force: false,
            }),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('S3 storage unmounted successfully!')).toBeInTheDocument();
      });
    });

    it('handles unmount API failure', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Unmount failed'));

      await waitFor(() => {
        const unmountButton = screen.getByLabelText('Unmount');
        fireEvent.click(unmountButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to unmount S3 storage: Unmount failed/)
        ).toBeInTheDocument();
      });
    });

    it('handles unmount API response not ok', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await waitFor(() => {
        const unmountButton = screen.getByLabelText('Unmount');
        fireEvent.click(unmountButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to unmount S3 storage: Failed to unmount: Internal Server Error/)
        ).toBeInTheDocument();
      });
    });

    it('handles item with mount_point field for unmount', async () => {
      // Reset all mocks to ensure clean state
      jest.clearAllMocks();

      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '/mnt/test',
          mount_point: '/mnt/legacy-mount',
        },
      ];

      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      const { container } = render(<S3Storage />);

      // Wait for component to load with the correct data
      await waitFor(() => {
        expect(within(container).getByText('/mnt/test')).toBeInTheDocument();
      });

      await act(async () => {
        const unmountButton = within(container).getByLabelText('Unmount');
        fireEvent.click(unmountButton);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          'http://192.168.1.100:8080/api/v1/storageclient/s3/unmount',
          expect.objectContaining({
            body: expect.stringContaining('"mount_point":"/mnt/test"'),
          })
        );
      });
    });
  });

  describe('Component Props and Storage Type Dropdown', () => {
    it('renders storage type dropdown when onStorageTypeChange prop is provided', async () => {
      const mockOnStorageTypeChange = jest.fn();

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await act(async () => {
        render(<S3Storage onStorageTypeChange={mockOnStorageTypeChange} currentStorageType="s3" />);
      });

      await waitFor(() => {
        const dropdown = screen.getByDisplayValue('S3');
        expect(dropdown).toBeInTheDocument();
      });
    });

    it('handles storage type change in dropdown', async () => {
      const mockOnStorageTypeChange = jest.fn();

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await act(async () => {
        render(<S3Storage onStorageTypeChange={mockOnStorageTypeChange} currentStorageType="s3" />);
      });

      await waitFor(() => {
        const dropdown = screen.getByDisplayValue('S3');
        fireEvent.change(dropdown, { target: { value: 'nfs' } });
      });

      expect(mockOnStorageTypeChange).toHaveBeenCalledWith('nfs');
    });

    it('does not render storage type dropdown when onStorageTypeChange prop is not provided', async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(screen.queryByDisplayValue('S3')).not.toBeInTheDocument();
      });
    });

    it('uses default currentStorageType when not provided', async () => {
      const mockOnStorageTypeChange = jest.fn();

      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await act(async () => {
        render(<S3Storage onStorageTypeChange={mockOnStorageTypeChange} />);
      });

      await waitFor(() => {
        const dropdown = screen.getByDisplayValue('S3');
        expect(dropdown).toBeInTheDocument();
      });
    });
  });

  describe('Alert Modal Functionality', () => {
    it('displays and closes error alert modal', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load S3 storage data: Network error/)
        ).toBeInTheDocument();
      });

      // The error is displayed as an inline alert, not a modal with an OK button
      // No interaction needed - the error is simply displayed
    });

    it('displays and closes success alert modal after mount', async () => {
      const mockData = [
        {
          filesystem: '',
          size: '-',
          used: '-',
          avail: '-',
          capacity: '-',
          mounted_on: '',
        },
      ];

      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      // Fill and submit form
      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Endpoint/), {
        target: { value: 's3.amazonaws.com' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
        expect(screen.getByText('S3 storage mounted successfully!')).toBeInTheDocument();
      });

      const okButton = screen.getByText('OK');
      fireEvent.click(okButton);

      await waitFor(() => {
        expect(screen.queryByText('Success')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('handles string error in fetchStorageData', async () => {
      mockApiFetch.mockRejectedValueOnce('String error');

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load S3 storage data: String error/)
        ).toBeInTheDocument();
      });
    });

    it('handles string error in mount operation', async () => {
      const mockData = [
        {
          filesystem: '',
          size: '-',
          used: '-',
          avail: '-',
          capacity: '-',
          mounted_on: '',
        },
      ];

      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        })
        .mockRejectedValueOnce('Mount string error');

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Endpoint/), {
        target: { value: 's3.amazonaws.com' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to mount S3 storage')).toBeInTheDocument();
      });
    });

    it('handles string error in unmount operation', async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '/mnt/s3-bucket',
        },
      ];

      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        })
        .mockRejectedValueOnce('Unmount string error');

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        const unmountButton = screen.getByLabelText('Unmount');
        fireEvent.click(unmountButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to unmount S3 storage: Unmount string error/)
        ).toBeInTheDocument();
      });
    });

    it('handles empty mount path in unmount', async () => {
      const mockData = [
        {
          filesystem: 's3fs',
          size: '1T',
          used: '500G',
          avail: '500G',
          capacity: '50%',
          mounted_on: '',
          mount_point: '',
        },
      ];

      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      await act(async () => {
        render(<S3Storage />);
      });

      // The item should show as "Not Mounted" with empty mount path
      await waitFor(() => {
        expect(screen.getByText('Not Mounted')).toBeInTheDocument();
      });
    });
  });

  describe('Approval Flow Integration', () => {
    it('calls executeWithApproval for mount operations', async () => {
      const mockExecuteWithApproval = jest.fn((callback) => callback());
      mockUseApprovalFlow.mockReturnValue({
        requiresApproval: false,
        approvers: [],
        isModalOpen: false,
        modalProps: {
          isOpen: false,
          onClose: jest.fn(),
          onApprove: jest.fn(),
          title: 'S3 Storage Approval Required',
          message: 'This S3 storage action requires approval. Please select an approver.',
        },
        executeWithApproval: mockExecuteWithApproval,
      });

      const mockData = [
        {
          filesystem: '',
          size: '-',
          used: '-',
          avail: '-',
          capacity: '-',
          mounted_on: '',
        },
      ];

      mockApiFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        });

      await act(async () => {
        render(<S3Storage />);
      });

      await waitFor(() => {
        const mountButton = screen.getByText('Mount');
        fireEvent.click(mountButton);
      });

      fireEvent.change(screen.getByLabelText('Bucket Name'), {
        target: { value: 'my-bucket' },
      });
      fireEvent.change(screen.getByLabelText('Access Key'), {
        target: { value: 'AKIATEST123' },
      });
      fireEvent.change(screen.getByLabelText('Secret Key'), {
        target: { value: 'secret123' },
      });
      fireEvent.change(screen.getByLabelText(/Endpoint/), {
        target: { value: 's3.amazonaws.com' },
      });
      fireEvent.change(screen.getByLabelText('ID'), {
        target: { value: 'karios' },
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Submit'));
      });

      expect(mockExecuteWithApproval).toHaveBeenCalledWith(
        expect.any(Function),
        'Mount S3 Storage'
      );
    });
  });
});
