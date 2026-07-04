import React, { useState, useEffect } from 'react';
import envConfig from '../../../../../runtime-config';
import { logger } from '../../../../shared-state/src/utils/logger';
import Tooltip from '../../../../shared-state/src/widgets/Tooltip';

interface DnsZoneDropdownProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  helpText?: string;
  className?: string;
  disabled?: boolean;
  autoFetch?: boolean; // Auto-fetch DNS zones on mount
}

export const DnsZoneDropdown: React.FC<DnsZoneDropdownProps> = ({
  value,
  onChange,
  label = 'DNS Zone',
  required = false,
  helpText = 'DNS zone for automatic domain registration',
  className = '',
  disabled = false,
  autoFetch = true,
}) => {
  const [dnsZones, setDnsZones] = useState<Array<{ name: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const fetchDnsZones = async () => {
    setIsLoading(true);
    try {
      const serverIp = envConfig().CONTROL_NODE_IP.URL;
      const port = envConfig().CONTROL_NODE_IP.PORT;

      if (!serverIp) {
        logger.warn('Server IP not available for DNS zones fetch');
        setDnsZones([]);
        return;
      }

      const url = `${envConfig().PROTOCOL}://${serverIp}${port}/api/v1/ipam/dns/zones?status=active`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const zones = data.zones || [];
        setDnsZones(zones);
      } else {
        logger.error('Failed to fetch DNS zones', { status: response.status });
        setDnsZones([]);
      }
    } catch (error) {
      logger.error('Error fetching DNS zones', error);
      setDnsZones([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchDnsZones();
    }
  }, [autoFetch]);

  return (
    <div className={className}>
      <div className="flex items-center gap-1 mb-2">
        <label htmlFor="dnsZone" className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <Tooltip
          text="DNS zones are domain namespaces used for organizing and managing DNS records. They define the scope of authority for domain name resolution and enable automatic registration of subdomains within your infrastructure."
          position="right"
          iconSize={16}
          iconColor="#6b7280"
        />
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (dnsZones.length === 0) {
              fetchDnsZones();
            }
            setIsOpen(!isOpen);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-karios-blue focus:border-transparent text-left bg-white flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled || isLoading}
        >
          <span className={value ? 'text-gray-900' : 'text-gray-500'}>
            {isLoading ? 'Loading DNS zones...' : value ? value : 'Select DNS Zone'}
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {dnsZones.length === 0 ? (
              <div className="px-3 py-2 text-gray-500 text-sm">No DNS zones are available.</div>
            ) : (
              dnsZones.map((zone) => (
                <button
                  key={zone.name}
                  type="button"
                  onClick={() => {
                    onChange(zone.name);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                    value === zone.name ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                  }`}
                >
                  {zone.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {helpText && <p className="mt-1 text-xs md:text-sm text-gray-600">{helpText}</p>}
    </div>
  );
};
