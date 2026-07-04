import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClientStorage from './ClientStorage';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Simple mocks that allow us to test all branches
jest.mock('./components/S3Storage', () => {
  return function MockS3Storage({ onStorageTypeChange, currentStorageType }: any) {
    return (
      <div data-testid="s3-storage">
        S3 Storage - {currentStorageType}
        <button data-testid="to-iscsi" onClick={() => onStorageTypeChange('iscsi')}>
          To iSCSI
        </button>
      </div>
    );
  };
});

jest.mock('./components/MooseFSStorage', () => {
  return function MockMooseFSStorage({ onStorageTypeChange, currentStorageType }: any) {
    return (
      <div data-testid="moosefs-storage">
        MooseFS Storage - {currentStorageType}
        <button data-testid="to-s3" onClick={() => onStorageTypeChange('s3')}>
          To S3
        </button>
        <button data-testid="to-nfs" onClick={() => onStorageTypeChange('nfs')}>
          To NFS
        </button>
      </div>
    );
  };
});

jest.mock('./components/iSCSIStorage', () => {
  return function MockISCSIStorage({ onStorageTypeChange, currentStorageType }: any) {
    return (
      <div data-testid="iscsi-storage">
        iSCSI Storage - {currentStorageType}
        <button data-testid="to-smb" onClick={() => onStorageTypeChange('smb')}>
          To SMB
        </button>
      </div>
    );
  };
});

jest.mock('./components/NFSStorage', () => {
  return function MockNFSStorage({ onStorageTypeChange, currentStorageType }: any) {
    return (
      <div data-testid="nfs-storage">
        NFS Storage - {currentStorageType}
        <button data-testid="to-seaweed" onClick={() => onStorageTypeChange('seaweed')}>
          To Seaweed
        </button>
      </div>
    );
  };
});

jest.mock('./components/SMBStorage', () => {
  return function MockSMBStorage({ onStorageTypeChange, currentStorageType }: any) {
    return (
      <div data-testid="smb-storage">
        SMB Storage - {currentStorageType}
        <button data-testid="to-unknown" onClick={() => onStorageTypeChange('unknown')}>
          To Unknown
        </button>
      </div>
    );
  };
});

jest.mock('./components/seaweedStorage', () => {
  return {
    SeaweedStorage: function MockSeaweedStorage({ onStorageTypeChange, currentStorageType }: any) {
      return (
        <div data-testid="seaweed-storage">
          SeaweedFS Storage - {currentStorageType}
          <button data-testid="to-moosefs" onClick={() => onStorageTypeChange('moosefs')}>
            To MooseFS
          </button>
        </div>
      );
    },
  };
});

describe('ClientStorage Component - Complete Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  // Test 1: Default MooseFS rendering (covers line ~46-50)
  it('renders MooseFS storage by default', () => {
    render(<ClientStorage />);
    expect(screen.getByTestId('moosefs-storage')).toBeInTheDocument();
  });

  // Test 2: S3 storage rendering (covers line ~38-42)
  it('renders S3 storage when state is changed to s3', async () => {
    render(<ClientStorage />);

    // Navigate to S3
    await act(async () => {
      screen.getByTestId('to-s3').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('s3-storage')).toBeInTheDocument();
    });
  });

  // Test 3: iSCSI storage rendering (covers line ~54-58)
  it('renders iSCSI storage when state is changed to iscsi', async () => {
    render(<ClientStorage />);

    // Navigate to S3 first, then to iSCSI
    await act(async () => {
      screen.getByTestId('to-s3').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('s3-storage')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-iscsi').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('iscsi-storage')).toBeInTheDocument();
    });
  });

  // Test 4: NFS storage rendering (covers line ~62-66)
  it('renders NFS storage when state is changed to nfs', async () => {
    render(<ClientStorage />);

    // Navigate to NFS
    await act(async () => {
      screen.getByTestId('to-nfs').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('nfs-storage')).toBeInTheDocument();
    });
  });

  // Test 5: SMB storage rendering (covers line ~70-74)
  it('renders SMB storage when state is changed to smb', async () => {
    render(<ClientStorage />);

    // Navigate through the chain to SMB
    await act(async () => {
      screen.getByTestId('to-s3').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('s3-storage')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-iscsi').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('iscsi-storage')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-smb').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('smb-storage')).toBeInTheDocument();
    });
  });

  // Test 6: Seaweed storage rendering (covers line ~78-82)
  it('renders Seaweed storage when state is changed to seaweed', async () => {
    render(<ClientStorage />);

    // Navigate to Seaweed through NFS
    await act(async () => {
      screen.getByTestId('to-nfs').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('nfs-storage')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-seaweed').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('seaweed-storage')).toBeInTheDocument();
    });
  });

  // Test 7: Fallback message for unsupported storage types (covers line ~85-89)
  it('displays fallback message for unsupported storage types', async () => {
    render(<ClientStorage />);

    // Navigate through the chain to trigger unknown storage type
    await act(async () => {
      screen.getByTestId('to-s3').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('s3-storage')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-iscsi').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('iscsi-storage')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-smb').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('smb-storage')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-unknown').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Storage type "unknown" not yet supported.')).toBeInTheDocument();
    });
  });

  // Test 8: Complete navigation cycle to ensure all branches are covered
  it('navigates through all storage types in a complete cycle', async () => {
    render(<ClientStorage />);

    // Complete cycle: moosefs -> s3 -> iscsi -> smb -> unknown -> fallback
    // Then: moosefs -> nfs -> seaweed -> moosefs

    // Initial state
    expect(screen.getByTestId('moosefs-storage')).toBeInTheDocument();

    // moosefs -> s3
    await act(async () => {
      screen.getByTestId('to-s3').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('s3-storage')).toBeInTheDocument();
    });

    // s3 -> iscsi
    await act(async () => {
      screen.getByTestId('to-iscsi').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('iscsi-storage')).toBeInTheDocument();
    });

    // iscsi -> smb
    await act(async () => {
      screen.getByTestId('to-smb').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('smb-storage')).toBeInTheDocument();
    });

    // smb -> unknown (fallback)
    await act(async () => {
      screen.getByTestId('to-unknown').click();
    });
    await waitFor(() => {
      expect(screen.getByText('Storage type "unknown" not yet supported.')).toBeInTheDocument();
    });

    // Now test the other path: Start fresh to test nfs -> seaweed
    const { unmount } = render(<ClientStorage />);

    // moosefs -> nfs
    await act(async () => {
      screen.getByTestId('to-nfs').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('nfs-storage')).toBeInTheDocument();
    });

    // nfs -> seaweed
    await act(async () => {
      screen.getByTestId('to-seaweed').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('seaweed-storage')).toBeInTheDocument();
    });

    // seaweed -> moosefs (complete cycle)
    await act(async () => {
      screen.getByTestId('to-moosefs').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('moosefs-storage')).toBeInTheDocument();
    });

    unmount();
  });

  // Test 9: Edge cases and state consistency
  it('maintains state consistency throughout navigation', async () => {
    render(<ClientStorage />);

    // Verify that currentStorageType prop is correctly passed
    expect(screen.getByText('MooseFS Storage - moosefs')).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId('to-s3').click();
    });
    await waitFor(() => {
      expect(screen.getByText('S3 Storage - s3')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId('to-iscsi').click();
    });
    await waitFor(() => {
      expect(screen.getByText('iSCSI Storage - iscsi')).toBeInTheDocument();
    });
  });

  // Test 10: Comprehensive branch coverage verification
  it('achieves 100% branch coverage by testing all conditional paths', async () => {
    // This test specifically targets the remaining uncovered lines
    const { rerender } = render(<ClientStorage />);

    // Test all 6 storage type conditions + 1 fallback condition
    const storageTypes = ['moosefs', 's3', 'iscsi', 'nfs', 'smb', 'seaweed', 'unknown'];

    // Since we can't directly set the state, we'll use our navigation system
    // to ensure all branches are hit

    let currentComponent = screen.getByTestId('moosefs-storage');
    expect(currentComponent).toBeInTheDocument();

    // Navigate to S3 (tests s3 branch)
    await act(async () => {
      screen.getByTestId('to-s3').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('s3-storage')).toBeInTheDocument();
    });

    // Navigate to iSCSI (tests iscsi branch)
    await act(async () => {
      screen.getByTestId('to-iscsi').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('iscsi-storage')).toBeInTheDocument();
    });

    // Navigate to SMB (tests smb branch)
    await act(async () => {
      screen.getByTestId('to-smb').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('smb-storage')).toBeInTheDocument();
    });

    // Navigate to unknown (tests fallback branch)
    await act(async () => {
      screen.getByTestId('to-unknown').click();
    });
    await waitFor(() => {
      expect(screen.getByText('Storage type "unknown" not yet supported.')).toBeInTheDocument();
    });

    // All 6 storage type branches + 1 fallback branch have been covered!
    // The NFS and Seaweed branches are covered in previous tests
  });
});
