interface VM {
  disks: Array<{ label: string; capacityGB: number }>;
  selectedDisks?: string[];
}

interface Datastore {
  name: string;
  available?: string | number;
}

export interface StorageBreakdown {
  totalNeeded: number;
  totalAvailable: number;
  remainingAfterMigration: number;
  isInsufficient: boolean;
}

// Calculate total storage needed for selected VMs and disks
export const calculateTotalStorageNeeded = (selectedVMs: VM[]): number => {
  return selectedVMs.reduce((total, vm) => {
    const selectedDiskLabels = vm.selectedDisks || [];
    const disksToCount =
      selectedDiskLabels.length > 0
        ? vm.disks.filter((disk) => selectedDiskLabels.includes(disk.label))
        : []; // If no disks selected, count NO disks (not all disks)

    const vmStorage = disksToCount.reduce((vmTotal, disk) => vmTotal + disk.capacityGB, 0);
    return total + vmStorage;
  }, 0);
};

// Get available storage for selected datastore
export const getAvailableStorage = (datastores: Datastore[], selectedDatastore: string): number => {
  const selectedDatastoreObj = datastores.find((ds) => ds.name === selectedDatastore);
  if (!selectedDatastoreObj?.available) return 0;

  // Parse available storage (handles formats like "1.56T", "500G", "2048M", etc.)
  const availableStr = selectedDatastoreObj.available.toString().trim();
  const match = availableStr.match(/^([\d.]+)\s*([KMGTB]?)(\w*)$/i);
  if (!match) return 0;

  const [, value, unit] = match;
  const numValue = parseFloat(value);

  // Convert to GB
  const multipliers: Record<string, number> = {
    '': 1, // assume GB if no unit
    B: 1e-9,
    K: 1e-6,
    M: 1e-3,
    G: 1,
    T: 1e3,
  };

  return numValue * (multipliers[unit?.toUpperCase()] || 1);
};

// Get storage breakdown for detailed display
export const getStorageBreakdown = (
  selectedVMs: VM[],
  datastores: Datastore[],
  selectedDatastore: string
): StorageBreakdown => {
  const totalNeeded = calculateTotalStorageNeeded(selectedVMs);
  const totalAvailable = getAvailableStorage(datastores, selectedDatastore);
  const remainingAfterMigration = Math.max(0, totalAvailable - totalNeeded);

  return {
    totalNeeded: totalNeeded,
    totalAvailable: totalAvailable,
    remainingAfterMigration: remainingAfterMigration,
    isInsufficient: totalNeeded > totalAvailable,
  };
};
