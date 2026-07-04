// import React from 'react';
// import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// import '@testing-library/jest-dom';
// import CreateZPool from './createZpool';

// // Mock dependencies
// jest.mock('@karios-monorepo/shared-state', () => ({
//   usePermissions: jest.fn(),
//   useAppState: jest.fn(),
// }));

// jest.mock('../../../shared-state/src/utils/interceptor', () => ({
//   fetch: jest.fn(),
// }));

// // Mock window.alert and window.confirm
// const mockAlert = jest.fn();
// const mockConfirm = jest.fn();
// global.alert = mockAlert;
// global.confirm = mockConfirm;

// const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// const mockUsePermissions = require('@karios-monorepo/shared-state').usePermissions as jest.Mock;
// const mockUseAppState = require('@karios-monorepo/shared-state').useAppState as jest.Mock;
// const mockApi = require('../../../shared-state/src/utils/interceptor') as { fetch: jest.Mock };

// describe('CreateZPool', () => {
//   const mockSetCreatingZpool = jest.fn();
//   const mockFetchAvailableDisks = jest.fn();
//   const mockFetchStoragePools = jest.fn();

//   const mockExistingPools = [
//     { NAME: 'existingpool1' },
//     { NAME: 'existingpool2' },
//   ];

//   const mockAvailableDisks = [
//     { name: 'da0', mediasize: '1TB' },
//     { name: 'da1', mediasize: '1TB' },
//     { name: 'da2', mediasize: '2TB' },
//     { name: 'da3', mediasize: '1TB' },
//   ];

//   const mockSelectedServer = {
//     ip: '192.168.1.100',
//     name: 'test-server',
//   };

//   const defaultProps = {
//     existingPools: mockExistingPools,
//     setCreatingZpool: mockSetCreatingZpool,
//     fetchAvailableDisks: mockFetchAvailableDisks,
//     fetchStoragePools: mockFetchStoragePools,
//   };

//   beforeEach(() => {
//     jest.clearAllMocks();

//     mockUsePermissions.mockReturnValue({
//       permissions: { ZFS_MANAGE: true },
//     });

//     mockUseAppState.mockReturnValue({
//       state: { selectedServer: mockSelectedServer },
//     });

//     // Mock the API call for fetching available disks
//     mockApi.fetch.mockResolvedValue({
//       ok: true,
//       json: async () => ({ available: mockAvailableDisks }),
//     });
//   });

//   afterEach(() => {
//     mockConsoleError.mockClear();
//   });

//   // Test 1: Component renders correctly when user has permissions
//   it('renders all form elements when user has ZFS_MANAGE permission', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       expect(screen.getByRole('heading', { name: 'Create ZPool' })).toBeInTheDocument();
//       expect(screen.getByPlaceholderText('Enter pool name')).toBeInTheDocument();
//       expect(screen.getByText('Select RAID Type:')).toBeInTheDocument();
//       expect(screen.getByText('Available Disks:')).toBeInTheDocument();
//       expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
//       expect(screen.getByRole('button', { name: 'Create ZPool' })).toBeInTheDocument();
//     });
//   });

//   // Test 2: Component does not render when user lacks permissions
//   it('does not render when user lacks ZFS_MANAGE permission', () => {
//     mockUsePermissions.mockReturnValue({
//       permissions: { ZFS_MANAGE: false },
//     });

//     render(<CreateZPool {...defaultProps} />);

//     expect(screen.queryByText('Create ZPool')).not.toBeInTheDocument();
//     expect(screen.queryByPlaceholderText('Enter pool name')).not.toBeInTheDocument();
//   });

//   // Test 3: Pool name input updates correctly
//   it('updates pool name when user types in input field', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const input = screen.getByPlaceholderText('Enter pool name');
//       fireEvent.change(input, { target: { value: 'testpool' } });
//       expect(input).toHaveValue('testpool');
//     });
//   });

//   // Test 4: RAID type selection works correctly
//   it('updates RAID type when user selects different option', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const raidz2Radio = screen.getByDisplayValue('raidz2');
//       fireEvent.click(raidz2Radio);
//       expect(raidz2Radio).toBeChecked();
//     });
//   });

//   // Test 5: Disk selection functionality
//   it('allows users to select and deselect disks', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const diskCheckbox = screen.getByDisplayValue('da0');

//       // Select disk
//       fireEvent.click(diskCheckbox);
//       expect(diskCheckbox).toBeChecked();

//       // Deselect disk
//       fireEvent.click(diskCheckbox);
//       expect(diskCheckbox).not.toBeChecked();
//     });
//   });

//   // Test 6: Close button functionality
//   it('calls setCreatingZpool when close button is clicked', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const closeButton = screen.getByRole('button', { name: 'Close' });
//       fireEvent.click(closeButton);
//       expect(mockSetCreatingZpool).toHaveBeenCalledWith(false);
//     });
//   });

//   // Test 7: Empty pool name validation
//   it('shows error alert for empty pool name', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const createButton = screen.getByRole('button', { name: 'Create ZPool' });
//       fireEvent.click(createButton);
//       expect(mockAlert).toHaveBeenCalledWith('Please enter a pool name.');
//     });
//   });

//   // Test 8: Invalid pool name validation
//   it('shows error alert for invalid pool name', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const input = screen.getByPlaceholderText('Enter pool name');
//       fireEvent.change(input, { target: { value: '123invalid' } });

//       const createButton = screen.getByRole('button', { name: 'Create ZPool' });
//       fireEvent.click(createButton);

//       expect(mockAlert).toHaveBeenCalledWith(
//         "Invalid pool name.\n\nAllowed format:\n- Must begin with a letter\n- Only letters, numbers, dashes (-), underscores (_), or dots (.) are allowed"
//       );
//     });
//   });

//   // Test 9: RAID type name collision validation
//   it('shows error alert when pool name matches RAID type', async () => {
//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const input = screen.getByPlaceholderText('Enter pool name');
//       fireEvent.change(input, { target: { value: 'raidz1' } });

//       const createButton = screen.getByRole('button', { name: 'Create ZPool' });
//       fireEvent.click(createButton);

//       expect(mockAlert).toHaveBeenCalledWith(
//         'Pool name cannot match a RAID type. Choose a unique name.'
//       );
//     });
//   });

//   // Test 10: Successful ZPool creation with mixed disk sizes warning
//   it('creates ZPool successfully after confirming mixed disk sizes', async () => {
//     mockApi.fetch
//       .mockResolvedValueOnce({
//         ok: true,
//         json: async () => ({ available: mockAvailableDisks }),
//       })
//       .mockResolvedValueOnce({
//         ok: true,
//         json: async () => ({ success: true }),
//       });

//     mockConfirm.mockReturnValue(true);

//     await act(async () => {
//       render(<CreateZPool {...defaultProps} />);
//     });

//     await waitFor(() => {
//       const input = screen.getByPlaceholderText('Enter pool name');
//       fireEvent.change(input, { target: { value: 'newpool' } });

//       // Select disks with different sizes (da0=1TB, da2=2TB)
//       const disk1 = screen.getByDisplayValue('da0');
//       const disk2 = screen.getByDisplayValue('da2');
//       fireEvent.click(disk1);
//       fireEvent.click(disk2);

//       const createButton = screen.getByRole('button', { name: 'Create ZPool' });
//       fireEvent.click(createButton);
//     });

//     // Wait for the mixed disk sizes confirmation
//     await waitFor(() => {
//       expect(mockConfirm).toHaveBeenCalledWith(
//         'Warning: Selected disks have different sizes. This may reduce performance. Do you want to continue?'
//       );
//     });

//     // Wait for the warning modal to appear and click "Yes, Create Pool"
//     await waitFor(() => {
//       const confirmButton = screen.getByRole('button', { name: 'Yes, Create Pool' });
//       fireEvent.click(confirmButton);
//     });

//     // Wait for the success alert and other side effects
//     await waitFor(() => {
//       expect(mockAlert).toHaveBeenCalledWith('ZPool created successfully!');
//       expect(mockFetchAvailableDisks).toHaveBeenCalled();
//       expect(mockFetchStoragePools).toHaveBeenCalled();
//       expect(mockSetCreatingZpool).toHaveBeenCalledWith(false);
//     });
//   });
// });
