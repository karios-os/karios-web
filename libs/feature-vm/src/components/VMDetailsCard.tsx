import React, { FC, JSX } from 'react';
import { FaMicrochip, FaServer } from 'react-icons/fa';
import { Cpu, Folder, Ram } from 'iconsax-react';
import { AiOutlineCloudUpload } from 'react-icons/ai';
import { PiMemoryDuotone } from 'react-icons/pi';
import { MdOutlineSecurityUpdate } from 'react-icons/md';
import { Card } from '@karios-monorepo/shared-state';

interface VMDetailsCardProps {
  vmDetails: any;
  onUpdateClick: () => void;
}

const VMDetailsCard: FC<VMDetailsCardProps> = ({
  vmDetails,
  onUpdateClick,
}): JSX.Element => {
  const updateButton = 
    <button
      onClick={onUpdateClick}
      className="text-blue-500 hover:text-blue-700 text-sm flex items-center justify-center font-medium transition-colors"
    >
      <MdOutlineSecurityUpdate size={16} className="mr-2" />
      Update
    </button>

  return (
    <Card
      title="Core Configuration"
      icon={FaMicrochip}
      iconColor="#6366f1"
      iconSize={24}
      titleExtra={updateButton}
      className="border border-gray-200 rounded-lg min-w-0 order-1"
    >
      <div className="bg-white rounded-lg p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 bg-white rounded-lg p-3 flex items-center gap-3 hover:bg-white transition-colors">
            <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-lg flex-shrink-0">
              <FaServer size={20} color="#EF4444" />
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-500">Loader</p>
              <p className="text-base font-semibold text-gray-800">{vmDetails.loader}</p>
            </div>
          </div>
          <div className="border border-gray-200 bg-white rounded-lg p-3 flex items-center gap-3 hover:bg-white transition-colors">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg flex-shrink-0">
              <Cpu size={20} color="#3B82F6" />
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-500">CPU</p>
              <p className="text-base font-semibold text-gray-800">{vmDetails.cpu}</p>
            </div>
          </div>
          <div className="border border-gray-200 bg-white rounded-lg p-3 flex items-center gap-3 hover:bg-white transition-colors">
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg flex-shrink-0">
              <Folder size={20} color="#10B981" />
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-500">Datastore</p>
              <p className="text-base font-semibold text-gray-800">{vmDetails.datastore}</p>
            </div>
          </div>
          <div className="border border-gray-200 bg-white rounded-lg p-3 flex items-center gap-3 hover:bg-white transition-colors">
            <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg flex-shrink-0">
              <PiMemoryDuotone size={20} color="#A855F7" />
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-500">Memory</p>
              <p className="text-base font-semibold text-gray-800">{vmDetails.memory}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default VMDetailsCard;
