import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import envConfig from '../../../runtime-config';
import { useAppState, useServer } from '@karios-monorepo/shared-state';
import { createComponentLogger } from '../../shared-state/src/utils/logger';
import Tab from '../../shared-state/src/widgets/Tab';
import SupportBundleTab from './components/SupportBundleTab';
import ObservabilityTab from './components/ObservabilityTab';

// Simple Support Bundle UI and logic: trigger generate -> poll status -> enable download
export default function SupportBundle() {
  const logger = createComponentLogger('SupportBundle');

  // Tab state
  const [activeTab, setActiveTab] = useState<'support-bundle' | 'observability-services'>(
    'support-bundle'
  );

  // Support Bundle state
  const [password, setPassword] = useState('');
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Idle');

  // Password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPasswordSelectionOpen, setIsPasswordSelectionOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [tempConfirm, setTempConfirm] = useState('');
  const [tempError, setTempError] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  // Shared state hooks
  const { selectedServer } = useServer();
  const { state, dispatch } = useAppState();

  // Observability services state
  const observabilityServices = state['observabilityServices'] || {
    loading: false,
    error: null,
    status: { grafana: false, node_exporter: false, prometheus: false },
    serviceLoading: { grafana: false, node_exporter: false, prometheus: false },
    serviceErrors: { grafana: null, node_exporter: null, prometheus: null },
    dashboardUrl: null,
    dashboardLoading: false,
    dashboardError: null,
  };

  // Base URLs following the same pattern used elsewhere
  const apiBase = useMemo(() => {
    const { PROTOCOL, CONTROL_NODE_IP } = envConfig();
    const URL = CONTROL_NODE_IP?.URL || window.location.hostname;
    return `${PROTOCOL}://${URL}:/api/v1/support/bundle`;
  }, []);

  const statusUrl = useCallback((id: string) => `${apiBase}/status/${id}`, [apiBase]);
  const downloadUrl = useCallback((id: string) => `${apiBase}/download/${id}`, [apiBase]);
  const generateUrl = useMemo(() => `${apiBase}/generate`, [apiBase]);

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  // Fetch observability services status when switching to that tab
  useEffect(() => {
    if (activeTab === 'observability-services' && selectedServer?.ip) {
      fetchObservabilityStatus();
    }
  }, [activeTab, selectedServer?.ip, selectedServer?.fqdn]);

  // Observability services API functions
  const fetchObservabilityStatus = useCallback(async () => {
    if (!selectedServer?.ip) return;

    try {
      const { fetchObservabilityServicesStatus } =
        await import('../../shared-state/src/utils/observabilityApiService');
      const serverAddress = selectedServer?.fqdn || selectedServer.ip;
      await fetchObservabilityServicesStatus(serverAddress, dispatch);
    } catch (error) {
      logger.error('Failed to fetch observability services status:', error);
    }
  }, [selectedServer?.ip, selectedServer?.fqdn, dispatch]);

  const handleServiceAction = useCallback(
    async (serviceName: 'grafana' | 'prometheus' | 'node_exporter', action: 'start' | 'stop') => {
      if (!selectedServer?.ip) return;

      try {
        const { startObservabilityService, stopObservabilityService } =
          await import('../../shared-state/src/utils/observabilityApiService');

        const serverAddress = selectedServer?.fqdn || selectedServer.ip;
        let response;
        switch (action) {
          case 'start':
            response = await startObservabilityService(serverAddress, serviceName, dispatch);
            break;
          case 'stop':
            response = await stopObservabilityService(serverAddress, serviceName, dispatch);
            break;
        }

        // Show success message if available
        if (response && response.output) {
          logger.debug(`${serviceName} ${action} completed successfully`);
        }

        // Status will be updated through normal polling or manual refresh
        // Removed automatic refresh to prevent unwanted UI updates
      } catch (error) {
        logger.error(`Failed to ${action} ${serviceName} service:`, error);
      }
    },
    [selectedServer?.ip, selectedServer?.fqdn, dispatch, fetchObservabilityStatus]
  );

  // Launch Dashboard handler
  const handleLaunchDashboard = useCallback(async () => {
    if (!selectedServer?.ip) return;

    try {
      const { launchGrafanaDashboard } =
        await import('../../shared-state/src/utils/observabilityApiService');
      const serverAddress = selectedServer?.fqdn || selectedServer.ip;
      await launchGrafanaDashboard(serverAddress, dispatch);
      // URL will be saved in state and displayed below the button
    } catch (error) {
      logger.error('Failed to launch Grafana dashboard:', error);
    }
  }, [selectedServer?.ip, selectedServer?.fqdn, dispatch]);

  // Monitor service status and clear dashboard URL when any service goes down
  useEffect(() => {
    const allServicesRunning =
      observabilityServices.status.grafana === true &&
      observabilityServices.status.node_exporter === true &&
      observabilityServices.status.prometheus === true;

    // If any service is not running and we have a dashboard URL, clear it
    if (!allServicesRunning && observabilityServices.dashboardUrl) {
      // Import ActionTypes to use the proper action type
      import('../../shared-state/src/utils/actionTypes').then(({ ActionTypes }) => {
        dispatch({ type: ActionTypes.LAUNCH_GRAFANA_DASHBOARD_SUCCESS, payload: null });
      });
    }
  }, [observabilityServices.status, observabilityServices.dashboardUrl, dispatch]);

  const inferReadyFromResponse = (data: any): boolean => {
    if (!data) return false;
    if (typeof data.ready === 'boolean') return data.ready;
    if (typeof data.status === 'string') {
      const status = data.status.toLowerCase();
      return (
        status === 'ready' ||
        status === 'completed' ||
        status === 'success' ||
        status === 'finished'
      );
    }
    if (typeof data.state === 'string') {
      const state = data.state.toLowerCase();
      return (
        state === 'ready' || state === 'completed' || state === 'success' || state === 'finished'
      );
    }
    return false;
  };

  const extractBundleId = (data: any): string | null => {
    if (!data) return null;
    if (typeof data.job_id === 'string') return data.job_id;
    if (typeof data.id === 'string') return data.id;
    if (typeof data.bundleId === 'string') return data.bundleId;
    if (typeof data.uuid === 'string') return data.uuid;
    return null;
  };

  const startPolling = useCallback(
    (id: string) => {
      clearPolling();
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          setStatusText('Checking status...');
          const url = statusUrl(id);
          const res = await fetch(url, { method: 'GET' });
          if (!res.ok) {
            throw new Error(`Status check failed (${res.status})`);
          }
          const data = await res.json().catch(() => ({}));

          // Check for API errors first
          if (data.error && data.error !== '') {
            throw new Error(data.error);
          }

          const ready = inferReadyFromResponse(data);
          if (ready) {
            setIsReady(true);
            setStatusText('Ready to download');
            setIsGenerating(false);
            clearPolling();
          } else {
            // Use the actual status from API, with fallback
            const statusText =
              typeof data.status === 'string'
                ? data.status.charAt(0).toUpperCase() + data.status.slice(1).replace(/_/g, ' ')
                : typeof data.state === 'string'
                  ? data.state.charAt(0).toUpperCase() + data.state.slice(1).replace(/_/g, ' ')
                  : 'In Progress';
            setStatusText(statusText);
          }
        } catch (err: any) {
          setErrorMessage(err?.message || 'Failed to check status');
          clearPolling();
          setIsGenerating(false);
        }
      }, 3000);
    },
    [clearPolling, statusUrl]
  );

  const onGenerate = useCallback(
    async (overridePassword?: string) => {
      setErrorMessage(null);
      setIsReady(false);
      setIsDownloaded(false);
      setIsGenerating(true);
      setStatusText('Triggering generation...');
      setBundleId(null);
      clearPolling();

      // Use override password when provided (from modal), else use stored state
      const currentPassword = overridePassword ?? password;
      // Clear stored password for UX and security
      setPassword('');

      try {
        const res = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: currentPassword }),
        });
        if (!res.ok) {
          let serverMsg = '';
          try {
            const errJson = await res.json();
            serverMsg = errJson?.message || errJson?.error || '';
          } catch {
            // ignore
          }
          throw new Error(serverMsg || `Generate failed (${res.status})`);
        }
        const data = await res.json().catch(() => ({}));
        const id = extractBundleId(data) || data?.data?.id || data?.data?.bundleId || null;
        if (!id) {
          throw new Error('No job_id returned by server');
        }
        setBundleId(id);
        setStatusText('Generation started. Polling status...');
        startPolling(id);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to trigger generation');
        setIsGenerating(false);
      }
    },
    [clearPolling, generateUrl, password, startPolling]
  );

  const onDownload = useCallback(async () => {
    if (!bundleId) return;
    setErrorMessage(null);
    setIsDownloading(true);
    setStatusText('Downloading...');
    try {
      const res = await fetch(downloadUrl(bundleId), { method: 'GET' });
      if (!res.ok) {
        throw new Error(`Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `support-bundle-${bundleId}.7z`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStatusText('Downloaded');
      setIsDownloaded(true);

      // Reset to fresh state after download
      setTimeout(() => {
        setPassword('');
        setBundleId(null);
        setIsGenerating(false);
        setIsReady(false);
        setIsDownloading(false);
        setIsDownloaded(false);
        setErrorMessage(null);
        setStatusText('Idle');
        clearPolling();
      }, 2000); // Show "Downloaded" for 2 seconds then reset
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  }, [bundleId, downloadUrl, clearPolling]);

  const handleButtonClick = () => {
    if (isReady && !isDownloaded) {
      onDownload();
    } else if (!isGenerating && !isDownloaded) {
      if (isPasswordModalOpen) {
        // This should not happen since password modal handles its own submit
        // But keeping for backwards compatibility
        const validationError = validatePassword(tempPassword, tempConfirm);
        if (validationError) {
          setTempError(validationError);
          return;
        }
        setTempError(null);
        setIsPasswordModalOpen(false);
        onGenerate(tempPassword);
      } else if (!isPasswordSelectionOpen) {
        // Show password selection modal
        handleOpenPasswordSelection();
      }
    }
  };

  // Validate password: alphanumeric only, at least 5 chars, at least one letter, and confirm match
  const validatePassword = (passwordValue: string, confirmValue: string): string | null => {
    if (!passwordValue) return 'Password is required';
    const alnumOnly = /^[A-Za-z0-9]+$/;
    if (!alnumOnly.test(passwordValue)) return 'Use only letters and numbers';
    if (passwordValue.length < 5) return 'At least 5 characters required';
    if (!/[A-Za-z]/.test(passwordValue)) return 'Include at least one letter';
    if (confirmValue !== undefined && passwordValue !== confirmValue)
      return 'Passwords do not match';
    return null;
  };

  const handleCancelPassword = () => {
    setIsPasswordModalOpen(false);
    setTempError(null);
    setTempPassword('');
    setTempConfirm('');
  };

  // Password Selection Modal Handlers
  const handleOpenPasswordSelection = () => {
    setIsPasswordSelectionOpen(true);
    setTempPassword('');
    setTempConfirm('');
    setTempError(null);
  };

  const handleSelectManualPassword = () => {
    setIsPasswordSelectionOpen(false);
    setIsPasswordModalOpen(true);
    setTempPassword('');
    setTempConfirm('');
    setTempError(null);
  };

  const handleSelectAutoPassword = (generatedPassword: string) => {
    setIsPasswordSelectionOpen(false);
    // Skip the confirmation modal and directly use the generated password
    onGenerate(generatedPassword);
  };

  const handleCancelPasswordSelection = () => {
    setIsPasswordSelectionOpen(false);
    setTempPassword('');
    setTempConfirm('');
    setTempError(null);
  };


  // Tab options
  const tabOptions = [
    { value: 'support-bundle', label: 'Support Bundle' },
    { value: 'observability-services', label: 'Observability Services' },
  ];

  // Support Bundle password modal handlers
  const handlePasswordSubmit = () => {
    const validationError = validatePassword(tempPassword, tempConfirm);
    if (validationError) {
      setTempError(validationError);
      return;
    }
    setTempError(null);
    setIsPasswordModalOpen(false);
    onGenerate(tempPassword);
  };

  const handlePasswordErrorClear = () => {
    setTempError(null);
  };

  // Render Observability Services tab content
  return (
    <div className="p-4">
      {/* Rest will be updated below */}
      {/* Tab Navigation */}
      <Tab
        value={activeTab}
        options={tabOptions}
        onChange={(value) => setActiveTab(value as 'support-bundle' | 'observability-services')}
        className="mb-6"
      />

      {/* Tab Content */}
      {activeTab === 'support-bundle' ? (
        <SupportBundleTab
          isPasswordSelectionOpen={isPasswordSelectionOpen}
          onPasswordSelectionCancel={handleCancelPasswordSelection}
          onSelectManualPassword={handleSelectManualPassword}
          onSelectAutoPassword={handleSelectAutoPassword}
          isPasswordModalOpen={isPasswordModalOpen}
          password={tempPassword}
          confirmPassword={tempConfirm}
          passwordError={tempError}
          isGenerating={isGenerating}
          isReady={isReady}
          isDownloading={isDownloading}
          isDownloaded={isDownloaded}
          errorMessage={errorMessage}
          statusText={statusText}
          onPasswordChange={setTempPassword}
          onConfirmPasswordChange={setTempConfirm}
          onPasswordSubmit={handlePasswordSubmit}
          onPasswordCancel={handleCancelPassword}
          onPasswordErrorClear={handlePasswordErrorClear}
          onButtonClick={handleButtonClick}
        />
      ) : (
        <ObservabilityTab
          observabilityServices={observabilityServices}
          onRetry={fetchObservabilityStatus}
          onServiceAction={handleServiceAction}
          onLaunchDashboard={handleLaunchDashboard}
        />
      )}
    </div>
  );
}
