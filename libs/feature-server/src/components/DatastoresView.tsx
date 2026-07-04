import React from 'react';
import { Coin, Trash } from 'iconsax-react';

interface DatastoresViewProps {
  datastores: Array<{
    name: string;
    path: string;
    type?: string;
    used?: string;
    available?: string;
  }>;
  canManage: boolean;
  onDeleteDatastore: (datastoreName: string) => void;
}

export default function DatastoresView({
  datastores,
  canManage,
  onDeleteDatastore,
}: DatastoresViewProps) {
  return (
    <div className="p-2 sm:p-3 rounded-lg">
      <h3 className="text-lg sm:text-2xl font-semibold text-black flex items-center mb-2 gap-2">
        <Coin size={24} color="#000000" /> Datastores
      </h3>
      {datastores.length > 0 && (
        <div className="space-y-2">
          {datastores.map((datastore, index) => (
            <div
              key={index}
              className="border border-gray-100 bg-white rounded-lg text-black p-3 sm:p-5"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-0">
                <div className="flex flex-col flex-grow">
                  <span className="font-medium text-base sm:text-lg">{datastore.name}</span>
                  <span className="text-sm sm:text-md mt-2">Path: {datastore.path}</span>
                  {datastore.type && (
                    <span className="text-sm text-gray-600 mt-1">Type: {datastore.type}</span>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4 mt-3">
                    {datastore.used && (
                      <span className="text-sm text-gray-700">
                        <span className="font-medium">Used:</span> {datastore.used}
                      </span>
                    )}
                    {datastore.available && (
                      <span className="text-sm text-gray-700">
                        <span className="font-medium">Available:</span> {datastore.available}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    className="bg-red-700 text-white px-2 py-2 rounded hover:bg-red-800 mt-2 md:mt-0"
                    onClick={() => onDeleteDatastore(datastore.name)}
                  >
                    <Trash size={24} color="#FFFFFF" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
