import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../shared-state/src/widgets/Modal';
import { createComponentLogger } from '../../shared-state/src/utils/logger';
import envConfig from '../../../runtime-config';

interface StatusLog {
  id: number;
  message: string;
  timestamp: string;
  isSystemMessage?: boolean;
  isError?: boolean;
}

interface JobStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  jobType: string | null;
  title: string;
  onJobComplete?: (jobId: string) => void;
  onJobSuccess?: (jobId: string) => void; // New callback that only fires on successful completion
  bmcIp?: string;
}

export default function JobStatusModal({
  isOpen,
  onClose,
  jobId,
  jobType,
  title,
  onJobComplete,
  onJobSuccess,
  bmcIp,
}: JobStatusModalProps) {
  const logger = createComponentLogger('JobStatusModal');
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [jobFailed, setJobFailed] = useState<boolean>(false);
  const completionCallbackFiredRef = useRef<boolean>(false);
  const failureTimeoutRef = useRef<number | null>(null);
  const [failureCountdown, setFailureCountdown] = useState<number | null>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [statusLogs]);

  useEffect(() => {
    if (isOpen && jobId) {
      // Clear previous logs when opening a new job
      setStatusLogs([]);
      setIsCompleted(false);
      setIsConnected(false);
      setConnectionAttempts(0);
      setJobFailed(false);
      completionCallbackFiredRef.current = false; // Reset completion callback flag

      // Close any existing connection
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      // Connect to WebSocket for job status updates
      const authToken = localStorage.getItem('accessToken');
      const wsUrl = `${envConfig().WS_PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/controlnode/job/status?id=${jobId}&token=${authToken}`;

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          logger.debug('Job WebSocket connected', { jobId });
          setIsConnected(true);

          // Add connection status message for reconnections
          if (connectionAttempts > 0) {
            setStatusLogs((prev) => [
              ...prev,
              {
                id: Date.now(),
                message: `Reconnected to job status service`,
                timestamp: new Date().toLocaleTimeString(),
                isSystemMessage: true,
              },
            ]);
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Only process messages that match the current job_id
            if (message.job_id && message.job_id !== jobId) {
              return;
            }

            // Add the new status to the logs - note capital "Status"
            if (message.Status) {
              setStatusLogs((prev) => [
                ...prev,
                {
                  id: Date.now(),
                  message: message.Status,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
            }

            // Check if job is completed or failed - also check capital "Status"
            if (
              message.completed ||
              message.Status?.toLowerCase().includes('completed') ||
              message.Status?.toLowerCase().includes('finished') ||
              message.Status?.toLowerCase().includes('done') ||
              message.Status?.toLowerCase().includes('success') ||
              message.Status?.toLowerCase().includes('successfully') ||
              message.Status?.includes('Provisioning scripts completed successfully') ||
              message.Status?.includes('Successfully provisioned K3s worker node') ||
              message.Status?.includes('Successfully provisioned K3s master node') ||
              message.Status?.includes('Successfully provisioned K8s worker node') ||
              message.Status?.includes('Successfully provisioned') ||
              message.Status?.includes('Successfully provisioned K8s master node') ||
              message.Status?.includes('Cluster provisioned but auto-join incomplete')
            ) {
              // Special handling for FRR Router Provisioning - don't mark as completed for jail restart message
              const isFRRProvisioningJailRestart =
                jobType === 'FRR Router Provisioning' &&
                message.Status?.includes(
                  'Jail restart completed - FRR router deployment fully operational'
                );

              // Call the completion callback if provided (only once)
              if (onJobComplete && jobId && !completionCallbackFiredRef.current) {
                completionCallbackFiredRef.current = true;
                onJobComplete(jobId);
              }
              if (!isFRRProvisioningJailRestart) {
                setIsCompleted(true);
                setJobFailed(false);

                // Close WebSocket connection when job completes successfully
                if (socketRef.current) {
                  socketRef.current.close(1000, 'Job completed successfully');
                  socketRef.current = null;
                  setIsConnected(false);
                }

                // Call the completion callback if provided
                if (onJobComplete && jobId) {
                  onJobComplete(jobId);
                }

                // Call the success callback if provided (only for successful completion)
                if (onJobSuccess && jobId) {
                  onJobSuccess(jobId);
                }
              } else {
                // For FRR provisioning jail restart message, just log it without marking as completed
                logger.debug(
                  'FRR Router Provisioning jail restart completed - continuing to wait for final completion',
                  { jobId, message: message.Status }
                );
              }
            } else if (message.Status?.toLowerCase().includes('fail')) {
              setIsCompleted(true);
              setJobFailed(true);

              // Close WebSocket connection when job fails
              if (socketRef.current) {
                socketRef.current.close(1000, 'Job failed');
                socketRef.current = null;
                setIsConnected(false);
              }

              // Call the completion callback if provided (only once)
              if (onJobComplete && jobId && !completionCallbackFiredRef.current) {
                completionCallbackFiredRef.current = true;
                onJobComplete(jobId);
              }

              // Start countdown from 5 seconds
              setFailureCountdown(5);
              const countdownInterval = setInterval(() => {
                setFailureCountdown((prev) => {
                  if (prev === null || prev <= 1) {
                    clearInterval(countdownInterval);
                    return null;
                  }
                  return prev - 1;
                });
              }, 1000);

              // Set a 5-second timeout to clear cookies and close modal
              failureTimeoutRef.current = setTimeout(() => {
                logger.info('Job failed - clearing cookies and closing modal', { jobId });

                // Clear all cookies
                document.cookie.split(';').forEach((c) => {
                  document.cookie = c
                    .replace(/^ +/, '')
                    .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
                });

                // Close the modal
                handleClose();
              }, 5000) as unknown as number;
            }
          } catch (error) {
            logger.error('WebSocket message parsing failed', { jobId, error });
          }
        };

        ws.onerror = (error) => {
          setStatusLogs((prev) => [
            ...prev,
            {
              id: Date.now(),
              message: `Connection error: Unable to connect to job status service`,
              timestamp: new Date().toLocaleTimeString(),
              isError: true,
            },
          ]);
        };

        ws.onclose = (event) => {
          setIsConnected(false);

          // Only log error and attempt reconnection if it's not a manual close and job not completed
          if (event.code !== 1000 && event.code !== 1001 && !isCompleted) {
            setStatusLogs((prev) => [
              ...prev,
              {
                id: Date.now(),
                message: `Connection closed: ${event.reason || 'Server disconnected'}. Attempting to reconnect...`,
                timestamp: new Date().toLocaleTimeString(),
                isError: true,
              },
            ]);

            // Set connection attempts for reconnection message
            setConnectionAttempts((prev) => prev + 1);

            // Attempt to reconnect after a brief delay
            setTimeout(() => {
              if (isOpen && !isCompleted) {
                const newWs = new WebSocket(wsUrl);
                socketRef.current = newWs;

                // Reapply all event handlers for the new connection
                newWs.onopen = ws.onopen;
                newWs.onmessage = ws.onmessage;
                newWs.onerror = ws.onerror;
                newWs.onclose = ws.onclose;
              }
            }, 2000);
          } else if (event.code !== 1000 && event.code !== 1001) {
            // Just log disconnection if job is completed, no reconnection
            setStatusLogs((prev) => [
              ...prev,
              {
                id: Date.now(),
                message: `Connection closed: ${event.reason || 'Server disconnected'}`,
                timestamp: new Date().toLocaleTimeString(),
                isError: true,
              },
            ]);
          }
        };
      } catch (error) {
        logger.error('WebSocket creation failed', { jobId, error });
        setStatusLogs((prev) => [
          ...prev,
          {
            id: Date.now(),
            message: `Failed to establish connection: ${error.message}`,
            timestamp: new Date().toLocaleTimeString(),
            isError: true,
          },
        ]);
      }
    }

    // Cleanup WebSocket when modal closes or component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);

      // Clear the failure timeout if it exists
      if (failureTimeoutRef.current) {
        clearTimeout(failureTimeoutRef.current);
        failureTimeoutRef.current = null;
      }
    };
  }, [isOpen, jobId]);

  const handleClose = () => {
    // Clear the failure timeout if it exists
    if (failureTimeoutRef.current) {
      clearTimeout(failureTimeoutRef.current);
      failureTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    onClose();
  };

  // Create custom title with hyperlink if bmcIp is provided and valid
  const modalTitle =
    bmcIp && bmcIp !== '0.0.0.0' ? (
      <div className="flex items-center gap-2">
        <span>{title || `${jobType} Status`}</span>
        <a
          href={`${envConfig().PROTOCOL}://${bmcIp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline text-sm"
          title={`Open BMC Interface (${bmcIp})`}
        >
          BMC console
        </a>
      </div>
    ) : (
      title || `${jobType} Status`
    );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} width="600px">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Job ID: <span className="font-mono">{jobId}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            ></div>
            <span className="text-sm text-gray-600">
              {isConnected
                ? 'Connected'
                : connectionAttempts > 0
                  ? `Reconnecting... (${connectionAttempts})`
                  : 'Disconnected'}
            </span>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          data-testid="log-container"
          className="border border-gray-300 rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto"
        >
          <div className="font-mono text-sm space-y-2">
            {statusLogs.length === 0 ? (
              <div className="text-gray-500 italic">Waiting for status updates...</div>
            ) : (
              statusLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex flex-col ${
                    log.isError
                      ? 'text-red-600'
                      : log.message.toLowerCase().includes('hardware reveal completed successfully')
                        ? 'bg-green-100 text-green-800 rounded px-2 py-1'
                        : 'text-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-0.5">{log.timestamp}</span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {isCompleted && (
          <div
            className={`${jobFailed ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300'} border rounded-md p-3`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 ${jobFailed ? 'bg-red-500' : 'bg-green-500'} rounded-full`}
              ></div>
              <span className={`${jobFailed ? 'text-red-800' : 'text-green-800'} font-medium`}>
                {jobFailed
                  ? failureCountdown !== null
                    ? `Script failed - Clearing cookies and closing in ${failureCountdown}s...`
                    : 'Script failed, try again'
                  : 'Job completed successfully!'}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            {isCompleted ? 'Close' : 'Close & Continue in Background'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
