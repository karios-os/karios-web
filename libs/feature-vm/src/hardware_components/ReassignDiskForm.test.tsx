// import React from 'react';
// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import '@testing-library/jest-dom';
// import ReassignDiskForm from './ReassignDiskForm';
// import { useVm, useAppState, api } from '@karios-monorepo/shared-state';

// // Mock the shared-state module
// jest.mock('@karios-monorepo/shared-state', () => ({
//   useVm: jest.fn(),
//   useAppState: jest.fn(),
//   api: {
//     fetch: jest.fn(),
//   },
// }));

// const mockUseVm = useVm as jest.MockedFunction<typeof useVm>;
// const mockUseAppState = useAppState as jest.MockedFunction<typeof useAppState>;
// const mockApiFetch = api.fetch as jest.MockedFunction<typeof api.fetch>;

// // Mock window.alert
// const mockAlert = jest.fn();
// global.alert = mockAlert;

// const mockConsoleError = jest.fn();

// describe('ReassignDiskForm Component', () => {
//   const mockOnClose = jest.fn();
//   const mockGetVmInfo = jest.fn();

//   const mockDisk = {
//     number: 1,
//     emulation: 'virtio-blk',
//     'system-path': '/dev/zvol/pool1/vm-disk-001',
//   };

//   const mockSelectedVm = {
//     name: 'test-vm',
//     datastore: 'test-datastore',
//   };

//   const mockVmDetails = {
//     datastore: 'target-datastore',
//   };

//   const mockDataCenters = [
//     {
//       servers: [
//         {
//           ip: '192.168.1.100',
//           name: 'server1',
//           vms: [
//             { name: 'vm1', datastore: 'ds1' },
//             { name: 'vm2', datastore: 'ds2' },
//             { name: 'target-vm', datastore: 'ds3' },
//           ],
//         },
//         {
//           ip: '192.168.1.101',
//           name: 'server2',
//           vms: [
//             { name: 'vm3', datastore: 'ds4' },
//             { name: 'another-vm', datastore: 'ds5' },
//           ],
//         },
//       ],
//     },
//   ];

//   const mockState = {
//     selectedServer: {
//       ip: '192.168.1.100',
//       name: 'test-server',
//       vms: [],
//     },
//   };

//   beforeEach(() => {
//     jest.clearAllMocks();

//     mockUseVm.mockReturnValue({
//       dataCenters: mockDataCenters,
//       selectedVm: mockSelectedVm,
//       setSelectedVm: jest.fn(),
//       fetchVMs: jest.fn(),
//     });

//     mockUseAppState.mockReturnValue({
//       state: mockState,
//       dispatch: jest.fn(),
//       storage: {},
//       datastores: [],
//       fetchStoragePools: jest.fn(),
//       fetchDatastores: jest.fn(),
//       fetchVmDisks: jest.fn(),
//       attachDisk: jest.fn(),
//       setDiskFormField: jest.fn(),
//     } as any);

//     // Default successful API response
//     mockApiFetch.mockResolvedValue({
//       ok: true,
//       json: async () => ({ success: true }),
//     } as Response);
//   });

//   it('renders the ReassignDiskForm component with all form fields', () => {
//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Check for the actual elements that exist in the component
//     expect(screen.getByText('Disk Number')).toBeInTheDocument();
//     expect(screen.getByText('1')).toBeInTheDocument();
//     expect(screen.getByText('Emulation')).toBeInTheDocument();
//     expect(screen.getByText('virtio-blk')).toBeInTheDocument();
//     expect(screen.getByPlaceholderText('Type VM name to search...')).toBeInTheDocument();
//     expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
//     expect(screen.getByRole('button', { name: /reassign/i })).toBeInTheDocument();
//   });

//   it('initializes with selected server from global state', () => {
//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Component should initialize with the server from global state
//     expect(mockUseAppState).toHaveBeenCalled();
//   });

//   it('sets default server when no server is selected in global state', () => {
//     mockUseAppState.mockReturnValue({
//       state: { selectedServer: null },
//       dispatch: jest.fn(),
//       storage: {},
//       datastores: [],
//       fetchStoragePools: jest.fn(),
//       fetchDatastores: jest.fn(),
//       fetchVmDisks: jest.fn(),
//       attachDisk: jest.fn(),
//       setDiskFormField: jest.fn(),
//     } as any);

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Component should set a default server
//     expect(screen.getByText('Disk Number')).toBeInTheDocument();
//   });

//   it('handles VM search and filters VMs correctly only from current server', () => {
//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'vm' } });

//     // Should show filtered VMs only from the current server (excluding the selected VM)
//     expect(screen.getByText('vm1')).toBeInTheDocument();
//     expect(screen.getByText('vm2')).toBeInTheDocument();

//     // vm3 should not be present as it's on a different server
//     expect(screen.queryByText('vm3')).not.toBeInTheDocument();

//     // Should exclude selected VM
//     expect(screen.queryByText('test-vm')).not.toBeInTheDocument();

//     // Should show the server information message
//     expect(screen.getByText(/Showing VMs from current server:/)).toBeInTheDocument();
//   });

//   it('handles VM selection from filtered list', async () => {
//     mockApiFetch.mockResolvedValue({
//       ok: true,
//       json: async () => ({ 'virtual-disk': [{ id: 1 }, { id: 2 }] }),
//     } as Response);

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     await waitFor(() => {
//       expect(mockApiFetch).toHaveBeenCalledWith(
//         'http://192.168.1.100:8080/api/v1/compute/vms/target-vm'
//       );
//     });

//     expect(searchInput).toHaveValue('target-vm');
//   });

//   it('handles VM details fetch failure', async () => {
//     mockApiFetch.mockResolvedValue({
//       ok: false,
//       json: async () => ({ error: 'VM not found' }),
//     } as Response);

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     await waitFor(() => {
//       expect(mockAlert).toHaveBeenCalledWith('Failed to fetch target VM details.');
//     });
//   });

//   it('handles network error during VM details fetch', async () => {
//     mockApiFetch.mockRejectedValue(new Error('Network error'));

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     await waitFor(() => {
//       expect(mockConsoleError).toHaveBeenCalledWith(
//         'Error fetching target VM details:',
//         expect.any(Error)
//       );
//       expect(mockAlert).toHaveBeenCalledWith(
//         'An error occurred while fetching target VM details.'
//       );
//     });
//   });

//   it('shows error when trying to reassign without selecting target VM', async () => {
//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const reassignButton = screen.getByRole('button', { name: /reassign/i });

//     // The button should be disabled when no target VM is selected
//     expect(reassignButton).toBeDisabled();
//   });

//   it('shows error when no server is selected', async () => {
//     mockUseAppState.mockReturnValue({
//       state: { selectedServer: null },
//       dispatch: jest.fn(),
//       storage: {},
//       datastores: [],
//       fetchStoragePools: jest.fn(),
//       fetchDatastores: jest.fn(),
//       fetchVmDisks: jest.fn(),
//       attachDisk: jest.fn(),
//       setDiskFormField: jest.fn(),
//     } as any);

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Wait for component to initialize with default server, then clear it
//     const reassignButton = screen.getByRole('button', { name: /reassign/i });

//     // Simulate no server selected scenario by directly testing the handleReassign function
//     // This would happen if selectedServer becomes null after initialization
//     fireEvent.click(reassignButton);

//     // Since we can't directly test the internal state, we test the component behavior
//     // The component should handle the case gracefully
//   });

//   it('successfully reassigns disk with valid data', async () => {
//     // Mock successful VM details fetch
//     mockApiFetch
//       .mockResolvedValueOnce({
//         ok: true,
//         json: async () => ({ 'virtual-disk': [{ id: 1 }, { id: 2 }] }),
//       } as Response)
//       // Mock successful reassign disk
//       .mockResolvedValueOnce({
//         ok: true,
//         json: async () => ({ success: true }),
//       } as Response);

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Select a target VM
//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     // Wait for the VM details fetch to complete
//     await waitFor(() => {
//       expect(mockApiFetch).toHaveBeenCalledWith(
//         'http://192.168.1.100:8080/api/v1/compute/vms/target-vm'
//       );
//     });

//     // Wait a bit more for the state to update
//     await waitFor(() => {
//       expect(searchInput).not.toBeDisabled();
//     });

//     // Click reassign
//     const reassignButton = screen.getByRole('button', { name: /reassign/i });
//     fireEvent.click(reassignButton);

//     await waitFor(() => {
//       expect(mockApiFetch).toHaveBeenCalledWith(
//         'http://192.168.1.100:8080/api/v1/storage/zfs/vm/reassign_disk',
//         {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({
//             datastore: 'test-datastore',
//             disk_dev: 'custom',
//             disk_no: 1,
//             disk_type: 'virtio-blk',
//             target_datastore: 'target-datastore',
//             target_disk_no: 2,
//             target_vmname: 'target-vm',
//             vmname: 'test-vm',
//             zvol_name: 'vm-disk-001',
//             zvol_path: 'pool1',
//           }),
//         }
//       );
//     });

//     await waitFor(() => {
//       expect(mockAlert).toHaveBeenCalledWith('Disk reassigned successfully!');
//       expect(mockGetVmInfo).toHaveBeenCalled();
//       expect(mockOnClose).toHaveBeenCalled();
//     });
//   });

//   it('handles reassign disk API failure', async () => {
//     // Mock successful VM details fetch
//     mockApiFetch
//       .mockResolvedValueOnce({
//         ok: true,
//         json: async () => ({ 'virtual-disk': [{ id: 1 }] }),
//       } as Response)
//       // Mock failed reassign disk
//       .mockResolvedValueOnce({
//         ok: false,
//         json: async () => ({ error: 'Reassignment failed' }),
//       } as Response);

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Select a target VM
//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     // Wait for the VM details fetch to complete
//     await waitFor(() => {
//       expect(mockApiFetch).toHaveBeenCalledTimes(1);
//     });

//     // Wait for the state to update
//     await waitFor(() => {
//       expect(searchInput).not.toBeDisabled();
//     });

//     // Click reassign
//     const reassignButton = screen.getByRole('button', { name: /reassign/i });
//     fireEvent.click(reassignButton);

//     await waitFor(() => {
//       expect(mockAlert).toHaveBeenCalledWith('Reassignment failed');
//     });
//   });

//   it('handles network error during disk reassignment', async () => {
//     // Mock successful VM details fetch
//     mockApiFetch
//       .mockResolvedValueOnce({
//         ok: true,
//         json: async () => ({ 'virtual-disk': [{ id: 1 }] }),
//       } as Response)
//       // Mock network error for reassign disk
//       .mockRejectedValueOnce(new Error('Network error'));

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Select a target VM
//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     // Wait for the VM details fetch to complete
//     await waitFor(() => {
//       expect(mockApiFetch).toHaveBeenCalledTimes(1);
//     });

//     // Wait for the state to update
//     await waitFor(() => {
//       expect(searchInput).not.toBeDisabled();
//     });

//     // Click reassign
//     const reassignButton = screen.getByRole('button', { name: /reassign/i });
//     fireEvent.click(reassignButton);

//     await waitFor(() => {
//       expect(mockAlert).toHaveBeenCalledWith('Network error');
//     });
//   });

//   it('handles non-Error exceptions during disk reassignment', async () => {
//     // Mock successful VM details fetch
//     mockApiFetch
//       .mockResolvedValueOnce({
//         ok: true,
//         json: async () => ({ 'virtual-disk': [{ id: 1 }] }),
//       } as Response)
//       // Mock non-Error exception for reassign disk
//       .mockRejectedValueOnce('String error');

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     // Select a target VM
//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     // Wait for the VM details fetch to complete
//     await waitFor(() => {
//       expect(mockApiFetch).toHaveBeenCalledTimes(1);
//     });

//     // Wait for the state to update
//     await waitFor(() => {
//       expect(searchInput).not.toBeDisabled();
//     });

//     // Click reassign
//     const reassignButton = screen.getByRole('button', { name: /reassign/i });
//     fireEvent.click(reassignButton);

//     await waitFor(() => {
//       expect(mockAlert).toHaveBeenCalledWith('Unknown error');
//     });
//   });

//   it('disables form elements while fetching', async () => {
//     mockApiFetch.mockImplementation(
//       () =>
//         new Promise((resolve) => {
//           // Keep the promise pending to simulate loading state
//           setTimeout(() => {
//             resolve({
//               ok: true,
//               json: async () => ({ 'virtual-disk': [] }),
//             } as Response);
//           }, 100);
//         })
//     );

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     // Check that elements are disabled during fetch
//     expect(searchInput).toBeDisabled();
//     expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
//     expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();

//     await waitFor(() => {
//       expect(searchInput).not.toBeDisabled();
//     });
//   });

//   it('handles VM selection with zero virtual disks', async () => {
//     mockApiFetch.mockResolvedValue({
//       ok: true,
//       json: async () => ({ 'virtual-disk': null }), // No virtual-disk property
//     } as Response);

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const searchInput = screen.getByPlaceholderText('Type VM name to search...');
//     fireEvent.change(searchInput, { target: { value: 'target' } });

//     const targetVmOption = screen.getByText('target-vm');
//     fireEvent.click(targetVmOption);

//     await waitFor(() => {
//       expect(mockApiFetch).toHaveBeenCalledWith(
//         'http://192.168.1.100:8080/api/v1/compute/vms/target-vm'
//       );
//     });

//     // Should handle the case where virtual-disk is null/undefined and set diskNo to 0
//     expect(searchInput).toHaveValue('target-vm');
//   });

//   it('calls onClose when cancel button is clicked', () => {
//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={mockSelectedVm}
//         vmDetails={mockVmDetails}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     const cancelButton = screen.getByRole('button', { name: /cancel/i });
//     fireEvent.click(cancelButton);

//     expect(mockOnClose).toHaveBeenCalled();
//   });

//   it('handles VM with missing datastore property', () => {
//     const vmWithoutDatastore = { name: 'test-vm' };
//     const vmDetailsWithoutDatastore = {};

//     render(
//       <ReassignDiskForm
//         disk={mockDisk}
//         selectedVm={vmWithoutDatastore}
//         vmDetails={vmDetailsWithoutDatastore}
//         onClose={mockOnClose}
//         getVmInfo={mockGetVmInfo}
//       />
//     );

//     expect(screen.getByText('Disk Number')).toBeInTheDocument();
//     // Component should handle missing datastore properties gracefully
//   });
// });
