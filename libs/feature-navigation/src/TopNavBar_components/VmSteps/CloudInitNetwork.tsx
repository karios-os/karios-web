import React from 'react';

interface CloudInitNetworkProps {
  cloudInitDomain: string;
  setCloudInitDomain: (value: string) => void;
  cloudInitIp: string;
  setCloudInitIp: (value: string) => void;
  cloudInitGateway: string;
  setCloudInitGateway: (value: string) => void;
  cloudInitNameservers: string;
  setCloudInitNameservers: (value: string) => void;
}

export default function CloudInitNetwork({
  cloudInitDomain,
  setCloudInitDomain,
  cloudInitIp,
  setCloudInitIp,
  cloudInitGateway,
  setCloudInitGateway,
  cloudInitNameservers,
  setCloudInitNameservers,
}: CloudInitNetworkProps): React.ReactElement {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-6">Network Configuration</h2>

      {/* Network Configuration (Optional) */}
      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Static Network Configuration (Optional)
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Leave all fields blank to use DHCP for automatic network configuration. If you specify an
          IP address, you must also provide gateway and nameservers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
              Domain Name
            </label>
            <input
              type="text"
              id="domain"
              value={cloudInitDomain}
              onChange={(e) => setCloudInitDomain(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
              placeholder="example.com"
            />
            <p className="mt-1 text-sm text-gray-600">Domain name for the VM (optional)</p>
          </div>

          <div className="flex flex-col">
            <label htmlFor="ipAddress" className="block text-sm font-medium text-gray-700 mb-2">
              Static IP Address
            </label>
            <input
              type="text"
              id="ipAddress"
              value={cloudInitIp}
              onChange={(e) => setCloudInitIp(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
              placeholder="192.168.1.100/24"
            />
            <p className="mt-1 text-sm text-gray-600">
              Static IP with CIDR notation (e.g., 192.168.1.100/24)
            </p>
          </div>
        </div>

        {cloudInitIp && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="flex flex-col">
              <label htmlFor="gateway" className="block text-sm font-medium text-gray-700 mb-2">
                Default Gateway *
              </label>
              <input
                type="text"
                id="gateway"
                value={cloudInitGateway}
                onChange={(e) => setCloudInitGateway(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
                placeholder="192.168.1.1"
              />
              <p className="mt-1 text-sm text-gray-600">Default gateway IP address</p>
            </div>

            <div className="flex flex-col">
              <label htmlFor="nameservers" className="block text-sm font-medium text-gray-700 mb-2">
                DNS Nameservers *
              </label>
              <input
                type="text"
                id="nameservers"
                value={cloudInitNameservers}
                onChange={(e) => setCloudInitNameservers(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-karios-blue h-11 bg-white text-gray-900 text-sm"
                placeholder="8.8.8.8,8.8.4.4"
              />
              <p className="mt-1 text-sm text-gray-600">Comma-separated list of DNS servers</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Network Configuration Options</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                • <strong>DHCP (Recommended):</strong> Leave all fields blank for automatic
                configuration
              </p>
              <p>
                • <strong>Static IP:</strong> Useful for servers that need consistent addresses
              </p>
              <p>
                • <strong>Gateway & DNS:</strong> Required when using static IP addresses
              </p>
              <p>• Popular DNS servers: 8.8.8.8, 1.1.1.1, or your organization&apos;s DNS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
