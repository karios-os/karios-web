import React, { useState, useMemo, useEffect } from 'react';
import { ServerDropdown } from '@karios-monorepo/shared-ui';
import { useAppState } from '@karios-monorepo/shared-state';
import S3Storage from './components/S3Storage';
import MooseFSStorage from './components/MooseFSStorage';
import ISCSIStorage from './components/iSCSIStorage';
import NFSStorage from './components/NFSStorage';
import SMBStorage from './components/SMBStorage';

//fallback form data for any other storage types not yet separated
interface StorageFormData {
  id: string;
  server?: string;
  port?: string;
  directory?: string;
  auto_mount_on_restart: boolean;
  add_to_datastore: boolean;
}

const Storage: React.FC = () => {
  const { state } = useAppState();
  const [storageType, setStorageType] = useState<string>('moosefs');
  const [selectedServer, setSelectedServer] = useState<{ip: string; fqdn?: string; name: string} | null>(null);

  // Get available servers from the datacenter state
  const servers = useMemo(() => {
    const dataCenters = state.dataCenters || [];
    const serverList = dataCenters.flatMap(
      (dc) =>
        dc.servers?.map((server) => ({
          ip: server.ip || '',
          fqdn: server.fqdn || '',
          name: server.name || '',
        })) || []
    );
    return serverList;
  }, [state.dataCenters]);

  // Set the default selected server on component mount
  useEffect(() => {
    if (!selectedServer && servers.length > 0) {
      setSelectedServer(servers[0]);
    }
  }, [servers, selectedServer]);


  return (
    <>

      {storageType === 's3' && selectedServer && (
        <S3Storage
          selectedServer={selectedServer}
          onStorageTypeChange={(newStorageType: string) => setStorageType(newStorageType)}
          currentStorageType={storageType}
        />
      )}

      {storageType === 'moosefs' && selectedServer && (
        <MooseFSStorage
          selectedServer={selectedServer}
          onStorageTypeChange={(newStorageType: string) => setStorageType(newStorageType)}
          currentStorageType={storageType}
        />
      )}

      {storageType === 'iscsi' && selectedServer && (
        <ISCSIStorage
          selectedServer={selectedServer}
          onStorageTypeChange={(newStorageType: string) => setStorageType(newStorageType)}
          currentStorageType={storageType}
        />
      )}

      {storageType === 'nfs' && selectedServer && (
        <NFSStorage
          selectedServer={selectedServer}
          onStorageTypeChange={(newStorageType: string) => setStorageType(newStorageType)}
          currentStorageType={storageType}
        />
      )}

      {storageType === 'smb' && selectedServer && (
        <SMBStorage
          selectedServer={selectedServer}
          onStorageTypeChange={(newStorageType: string) => setStorageType(newStorageType)}
          currentStorageType={storageType}
        />
      )}

      {/* Fallback for other storage types */}
      {!['s3', 'moosefs', 'iscsi', 'nfs', 'smb'].includes(storageType) && (
        <div className="text-center py-8 text-gray-500">
          Storage type &quot;{storageType}&quot; not yet supported.
        </div>
      )}
    </>
  );
};

export default Storage;
