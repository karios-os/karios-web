import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../../shared-state/src/widgets/Modal';
import { logger } from '../../../shared-state/src/utils/logger';
import envConfig from '../../../../runtime-config';

interface StatusLog {
  id: number;
  message: string;
  timestamp: string;
  isSystemMessage?: boolean;
  isError?: boolean;
}

interface SideroWebSocketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SideroWebSocketModal({ isOpen, onClose }: SideroWebSocketModalProps) {
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const logCounterRef = useRef<number>(0);

  const handleClose = () => {
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      socketRef.current.close(1000, 'User closed modal');
    }
    socketRef.current = null;
    setIsConnected(false);
    onClose();
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [statusLogs]);

  useEffect(() => {
    if (isOpen && (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED)) {
      // Clear previous logs when opening
      setStatusLogs([]);
      setIsConnected(false);
      setConnectionAttempts(0);
      logCounterRef.current = 0;

      // Connect to Sidero WebSocket
      const wsUrl = `${envConfig().WS_PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/compute/k8s/keycloak/setup`;

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            let message: any;

            // Handle both JSON and plain text messages
            try {
              message = JSON.parse(event.data);
            } catch {
              // If it's not JSON, treat it as plain text
              message = { status: event.data, message: event.data };
            }

            // Add the new status to the logs
            const messageText = message.message || message.status || message.Status || event.data;
            if (messageText) {
              logCounterRef.current += 1;
              setStatusLogs((prev) => [
                ...prev,
                {
                  id: logCounterRef.current,
                  message: messageText,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
            }

            // Check for disconnected status and auto-close modal
            const lowerMessage = String(messageText).toLowerCase();
            if (
              lowerMessage.includes('disconnected') ||
              lowerMessage.includes('connection closed')
            ) {
              setTimeout(() => {
                handleClose();
              }, 2000); // Close after 2 seconds to show the disconnected message
            }
          } catch (error) {
            logger.error('Error parsing Sidero WebSocket message', error);
            logCounterRef.current += 1;
            setStatusLogs((prev) => [
              ...prev,
              {
                id: logCounterRef.current,
                message: `Error processing message: ${error.message}`,
                timestamp: new Date().toLocaleTimeString(),
                isError: true,
              },
            ]);
          }
        };

        ws.onerror = (error) => {
          logger.error('Sidero WebSocket error', error);
          logCounterRef.current += 1;
          setStatusLogs((prev) => [
            ...prev,
            {
              id: logCounterRef.current,
              message: `⚠️ Connection error: Unable to connect to Sidero setup service`,
              timestamp: new Date().toLocaleTimeString(),
              isError: true,
            },
          ]);
        };

        ws.onclose = (event) => {
          setIsConnected(false);
          socketRef.current = null;
        };
      } catch (error) {
        logger.error('Error creating Sidero WebSocket', error);
        logCounterRef.current += 1;
        setStatusLogs((prev) => [
          ...prev,
          {
            id: logCounterRef.current,
            message: `❌ Failed to establish connection: ${error.message}`,
            timestamp: new Date().toLocaleTimeString(),
            isError: true,
          },
        ]);
      }
    }

    // Cleanup WebSocket when modal closes or component unmounts
    return () => {
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close(1000, 'Modal closed');
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Sidero Setup Monitor" width="700px">
      <div className="space-y-4">
        {/* Connection Status Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Sidero Setup Service</span>
            </div>
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

        {/* WebSocket Messages Container */}
        <div
          ref={scrollContainerRef}
          className="border border-gray-300 rounded-lg p-4 bg-black text-green-400 max-h-96 overflow-y-auto"
          style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
        >
          <div className="text-sm space-y-2">
            {statusLogs.length === 0 ? (
              <div className="text-gray-500 italic">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Waiting for Sidero setup messages...</span>
                </div>
              </div>
            ) : (
              statusLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex flex-col ${
                    log.isError
                      ? 'text-red-400'
                      : log.isSystemMessage
                        ? 'text-cyan-400'
                        : 'text-green-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-gray-500 text-xs mt-0.5 font-mono whitespace-nowrap">
                      {log.timestamp}
                    </span>
                    <span className="flex-1 break-words">{log.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-purple-800">
            <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
            <span>Real-time monitoring active</span>
          </div>
          <div className="text-xs text-purple-600">Messages: {statusLogs.length}</div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-3">
          <button
            onClick={() => {
              setStatusLogs([]);
              logCounterRef.current = 0;
              logCounterRef.current += 1;
              setStatusLogs((prev) => [
                ...prev,
                {
                  id: logCounterRef.current,
                  message: `🔄 Log cleared by user`,
                  timestamp: new Date().toLocaleTimeString(),
                  isSystemMessage: true,
                },
              ]);
            }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Clear Log
          </button>

          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
