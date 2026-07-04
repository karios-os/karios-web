// Mock for @karios-monorepo/shared-state
export const useAppState = () => ({
  state: {
    iso: {
      isoList: [],
      loading: false,
      error: null,
    },
  },
  dispatch: jest.fn(),
  dataCenters: [],
  fetchVMs: jest.fn(),
  fetchVMsForServer: jest.fn(),
  setMetricsViewingPanel: jest.fn(),
  // ISO related functions
  fetchIsoList: jest.fn(),
  uploadIso: jest.fn(),
  downloadIso: jest.fn(),
  deleteIso: jest.fn(),
  // Add any other functions that might be needed
});
