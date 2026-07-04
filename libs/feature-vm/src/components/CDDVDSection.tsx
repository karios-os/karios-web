import React, { FC, JSX } from 'react';
import { FaCompactDisc, FaDatabase } from 'react-icons/fa';
import { IoIosAttach } from 'react-icons/io';
import { Export } from 'iconsax-react';
import { api, Card } from '@karios-monorepo/shared-state';
import { toast } from 'react-toastify';
import AttachDriveForm from '../hardware_components/AttachDrive';
import { Modal } from '@karios-monorepo/shared-state';
import envConfig from '../../../../runtime-config';

interface CDDVDSectionProps {
  vmDetails: any;
  selectedVm: any;
  selectedServer: any;
  attachDrive: boolean;
  setAttachDrive: (value: boolean) => void;
  setVmDetails: (details: any) => void;
  getVmInfo: (retry?: boolean, reason?: string) => Promise<void>;
}

const CDDVDSection: FC<CDDVDSectionProps> = ({
  vmDetails,
  selectedVm,
  selectedServer,
  attachDrive,
  setAttachDrive,
  setVmDetails,
  getVmInfo,
}): JSX.Element => {
  const titleExtra = (
    <button
      onClick={() => setAttachDrive(true)}
      className="text-karios-green hover:text-green-700 text-sm flex items-center justify-center font-medium transition-colors"
    >
      <IoIosAttach size="20" className="mr-2" /> Attach
    </button>
  );

  return (
    <Card
      title="CD/DVD Drive"
      icon={FaCompactDisc}
      iconColor="#f59e0b"
      iconSize={24}
      titleExtra={ titleExtra }
      className="border border-gray-200 rounded-lg min-w-0 order-4"
    >
      <div className="bg-white rounded-lg p-3 sm:p-4 space-y-3 overflow-y-auto max-h-[250px]">
        <Modal
          isOpen={attachDrive}
          onClose={() => setAttachDrive(false)}
          title="Attach CD/DVD Drive"
        >
          <AttachDriveForm
            setVmDetails={setVmDetails}
            refreshVmDetails={getVmInfo}
            onClose={() => setAttachDrive(false)}
            vmDetails={vmDetails}
          />
        </Modal>

        {vmDetails['virtual-disk']?.some((disk) => disk['system-path']?.endsWith('.iso')) && (
          <div>
            <h3 className="text-lg font-medium mb-2">Attached Drives</h3>
            {vmDetails['virtual-disk']
              .filter((disk) => disk['system-path']?.endsWith('.iso'))
              .map((disk, index) => (
                <div
                  key={index}
                  className="flex flex-row items-center justify-between border border-gray-200 p-4 rounded-lg gap-4 bg-white hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-3 flex-grow min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg flex-shrink-0 border border-gray-200">
                      <FaDatabase size={18} color="#9CA3AF" />
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={disk['system-path']}
                      className="flex-grow text-sm border border-gray-200 rounded-md py-2 px-3 bg-white min-w-0"
                    />
                  </div>
                  <button
                    className="bg-karios-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center justify-center font-medium transition-colors whitespace-nowrap"
                    onClick={async () => {
                      const payload = {
                        datastore: vmDetails.datastore || 'default',
                        vmname: selectedVm.name,
                        disk_no: disk.number,
                      };
                      try {
                        const res = await api.fetch(
                          `${envConfig().PROTOCOL}://${selectedServer?.fqdn || selectedServer.ip}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/storage/zfs/vm/detach_disk`,
                          {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          }
                        );

                        if (!res.ok) throw new Error('Detach failed');

                        toast.success(`Detached ISO from VM ${selectedVm.name} successfully`);

                        // Use getVmInfo from shared-state instead of direct API call - ensures single point of management
                        await getVmInfo(true, 'iso_detached');
                      } catch (err) {
                        toast.error('Failed to detach ISO.');
                      }
                    }}
                  >
                    <Export size="20" variant="Bold" className="mr-2" color="#ffffff" />
                    Detach
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default CDDVDSection;
