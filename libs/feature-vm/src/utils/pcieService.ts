import { toast } from 'react-toastify';
import {
  attachPcieDevices as attachPcieDevicesAPI,
  fetchPciSliceableInfo,
  updateVmHardware,
} from '@karios-monorepo/shared-state';

export interface PcieDeviceGroup {
  key: string;
  category: string;
  vendor: string;
  vendor_id: string;
  funcs: any[];
  allBdfs: string[];
  isIntegrated: boolean;
  deviceKey?: string;
  isNetworkFunction?: boolean;
  inUseBy?: string[];
  isAvailable?: boolean;
  isActive?: boolean;
}

/**
 * Build PCIe attachment payload from selected device groups
 */
export const buildPciePayload = (selectedGroups: PcieDeviceGroup[]) => {
  const processedGroups = selectedGroups.map((group) => {
    if (group.isNetworkFunction && group.deviceKey) {
      const sameDeviceFunctions = selectedGroups
        .filter((g) => g.isNetworkFunction && g.deviceKey === group.deviceKey)
        .flatMap((g) => g.funcs);

      return {
        ...group,
        funcs: sameDeviceFunctions,
        allBdfs: sameDeviceFunctions.map((fn: any) => fn.bdf),
      };
    }
    return group;
  });

  const uniqueGroups = processedGroups.filter((group, index, self) => {
    if (group.isNetworkFunction && group.deviceKey) {
      return (
        index === self.findIndex((g) => g.isNetworkFunction && g.deviceKey === group.deviceKey)
      );
    }
    return true;
  });

  return {
    action: 'attach',
    ppt_groups: uniqueGroups.map((group: any) => ({
      category: group.category,
      vendor: group.vendor,
      vendor_id: group.vendor_id,
      funcs: group.funcs.reduce((acc: any, func: any) => {
        acc[func.bdf] = {
          name: func.name,
          bdf: func.bdf,
          vendor_id: func.vendor_id || group.vendor_id || '',
          device_id: func.device_id || '',
          vendor: func.vendor || group.vendor || '',
          device: func.device || '',
          class_hex: func.class_hex || '',
          class: func.class || '',
          subclass: func.subclass || '',
          guest_vms: func.guest_vms || [],
        };
        return acc;
      }, {}),
    })),
  };
};

/**
 * Attach PCIe devices to a VM
 */
export const attachPcieDevices = async (
  serverAddress: string,
  vmName: string,
  selectedGroups: PcieDeviceGroup[],
  datastore: string
) => {
  const payload = buildPciePayload(selectedGroups);
  const result = await attachPcieDevicesAPI(serverAddress, vmName, payload, datastore);
  toast.success(
    `${selectedGroups.length} PCIe device${selectedGroups.length !== 1 ? 's' : ''} attached to ${vmName}!`
  );
  return result;
};

/**
 * Detach PCIe device from VM
 */
export const detachPcieDevice = async (
  serverAddress: string,
  vmName: string,
  group: PcieDeviceGroup,
  bdf: string,
  datastore: string
) => {
  const category = group.category;
  let funcsToDetach = group.funcs;

  if (category === 'network') {
    funcsToDetach = group.funcs.filter((func: any) => func.bdf === bdf);
  }

  const payload = {
    action: 'detach',
    ppt_groups: [
      {
        category: group.category,
        vendor: group.vendor,
        vendor_id: group.vendor_id,
        funcs: funcsToDetach.reduce((acc: any, func: any) => {
          acc[func.bdf] = {
            name: func.name,
            bdf: func.bdf,
            vendor_id: func.vendor_id || group.vendor_id || '',
            device_id: func.device_id || '',
            vendor: func.vendor || group.vendor || '',
            device: func.device || '',
            class_hex: func.class_hex || '',
            class: func.class || '',
            subclass: func.subclass || '',
            guest_vms: func.guest_vms || [],
          };
          return acc;
        }, {}),
      },
    ],
  };

  const result = await attachPcieDevicesAPI(serverAddress, vmName, payload, datastore);
  toast.success('PCIe device detached successfully!');
  return result;
};

/**
 * Check if a function is a Physical Function with existing Virtual Functions
 */
export const isPhysicalFunctionWithExistingVfs = (
  func: any,
  deviceKey: string,
  pcieSliceable: any
): boolean => {
  if (!pcieSliceable || !func) return false;

  const deviceSliceData = pcieSliceable[deviceKey];
  if (!deviceSliceData) return false;

  const bdfSliceData = deviceSliceData[func.bdf];
  if (!bdfSliceData) return false;

  return bdfSliceData.sriov_support === 'PF' && (bdfSliceData.vfs || []).length > 0;
};

/**
 * Group PCIe devices by their category and availability
 */
export const groupPcieDevices = (pcieInventory: any, selectedVmName: string) => {
  const groups: any = {};

  Object.entries(pcieInventory || {}).forEach(([deviceKey, info]: any) => {
    const category = info?.category;
    const vendor = info?.vendor;
    const vendor_id = info?.vendor_id;
    const funcs = info?.funcs || {};
    const funcArray = Object.values(funcs);

    if (category === 'network') {
      const hasAnyIntegratedFunction = funcArray.some((fn: any) => fn.is_integrated === true);

      funcArray.forEach((fn: any) => {
        const functionKey = `${deviceKey}_${(fn as any).bdf}`;
        const isActive = (fn as any).is_active !== false;
        groups[functionKey] = {
          key: functionKey,
          category,
          vendor,
          vendor_id,
          funcs: [fn],
          allBdfs: [(fn as any).bdf],
          isIntegrated: hasAnyIntegratedFunction,
          isAvailable: ((fn as any).guest_vms || []).length === 0,
          inUseBy: (fn as any).guest_vms || [],
          deviceKey: deviceKey,
          isNetworkFunction: true,
          isActive: isActive,
        };
      });
    } else {
      groups[deviceKey] = {
        key: deviceKey,
        category,
        vendor,
        vendor_id,
        funcs: funcArray,
        allBdfs: funcArray.map((fn: any) => fn.bdf),
        isIntegrated: funcArray.some((fn: any) => fn.is_integrated === true),
        isAvailable: funcArray.every((fn: any) => (fn.guest_vms || []).length === 0),
        inUseBy: [...new Set(funcArray.flatMap((fn: any) => fn.guest_vms || []))].filter(
          (vm) => vm
        ),
        isNetworkFunction: false,
        isActive: true,
      };
    }
  });

  return Object.values(groups);
};

/**
 * Get grouped attached PCIe devices for a specific VM
 */
export const getAttachedPcieDevices = (pcieInventory: any, vmName: string): PcieDeviceGroup[] => {
  if (!pcieInventory || !vmName) return [];

  const groups: Record<string, PcieDeviceGroup> = {};

  Object.entries(pcieInventory).forEach(([deviceKey, info]: any) => {
    const category = info?.category;
    const vendor = info?.vendor;
    const vendor_id = info?.vendor_id;
    const funcs = info?.funcs || {};

    const attachedFuncs = Object.values(funcs).filter(
      (fn: any) => fn.guest_vms && fn.guest_vms.includes(vmName)
    );

    if (attachedFuncs.length > 0) {
      if (category === 'network') {
        attachedFuncs.forEach((fn: any) => {
          const functionKey = `${deviceKey}_${fn.bdf}`;
          groups[functionKey] = {
            key: functionKey,
            category,
            vendor,
            vendor_id,
            funcs: [
              {
                ...fn,
                vendor: fn.vendor || vendor,
                device: fn.device || '',
              },
            ],
            allBdfs: [fn.bdf],
            isIntegrated: fn.is_integrated === true,
            deviceKey: deviceKey,
            isNetworkFunction: true,
          };
        });
      } else {
        groups[deviceKey] = {
          key: deviceKey,
          category,
          vendor,
          vendor_id,
          funcs: attachedFuncs.map((fn: any) => ({
            ...fn,
            vendor: fn.vendor || vendor,
            device: fn.device || '',
          })),
          allBdfs: attachedFuncs.map((fn: any) => fn.bdf),
          isIntegrated: attachedFuncs.some((fn: any) => fn.is_integrated === true),
          isNetworkFunction: false,
        };
      }
    }
  });

  return Object.values(groups);
};
