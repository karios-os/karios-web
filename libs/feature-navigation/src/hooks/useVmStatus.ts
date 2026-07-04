import { useCallback, useRef, useEffect, useState } from 'react';

interface UseVmStatusProps {
  refreshingVms: Record<string, boolean>;
  vmActionStatuses: Record<string, any>;
  setVmActionStatuses: (statuses: Record<string, any>) => void;
}

interface TransitionDelayState {
  timestamp: number;
  status: any;
  waitingForNewResponse: boolean;
}

/**
 * useVmStatus Hook
 * Provides utilities for determining VM status colors and transition states
 */
export const useVmStatus = ({
  refreshingVms,
  vmActionStatuses,
  setVmActionStatuses,
}: UseVmStatusProps) => {
  // Track transition delay timers and states
  const transitionDelayRef = useRef<Record<string, TransitionDelayState>>({});
  const transitionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Force re-render when transition delay expires
  const [, setTransitionUpdate] = useState(0);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(transitionTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);
  /**
   * Helper function to get VM color based on WebSocket action status
   */
  const getVmStatusColor = useCallback(
    (vmName: string, vmState: string): string => {
      const actionStatus = vmActionStatuses[vmName];
      const transitionDelay = transitionDelayRef.current[vmName];

      // Check for migrating state first - highest priority
      if (vmState === 'migrating') {
        return 'bg-blue-500'; // Blue for migrating
      }

      // If there's an active WebSocket action status
      if (actionStatus) {
        // If a new action comes in while waiting for response, clear the old transition delay
        if (transitionDelay?.waitingForNewResponse) {
          delete transitionDelayRef.current[vmName];
        }

        // If action is not final, show amber (transitioning state)
        if (!actionStatus.is_final) {
          return 'bg-amber-500'; // Amber for transitioning
        }

        // If action is final and no error, keep showing amber for 3 seconds
        if (actionStatus.is_final && !actionStatus.error) {
          // If we haven't started the delay yet, start it
          if (!transitionDelay) {
            transitionDelayRef.current[vmName] = {
              timestamp: Date.now(),
              status: actionStatus,
              waitingForNewResponse: false,
            };

            // Set a 3-second timer to clear the delay
            if (transitionTimersRef.current[vmName]) {
              clearTimeout(transitionTimersRef.current[vmName]);
            }
            transitionTimersRef.current[vmName] = setTimeout(() => {
              // Mark that we're waiting for a new response but keep showing amber
              transitionDelayRef.current[vmName].waitingForNewResponse = true;
              delete transitionTimersRef.current[vmName];
              // Force re-render
              setTransitionUpdate((prev) => prev + 1);
            }, 3000);

            // Show amber during the 3-second transition period
            return 'bg-amber-500'; // Amber for transitioning
          }

          // Check if 3 seconds have passed
          const elapsed = Date.now() - transitionDelay.timestamp;
          if (elapsed < 3000) {
            // Still in transition period, show amber
            return 'bg-amber-500'; // Amber for transitioning
          }

          // 3 seconds have passed, keep showing amber until new response comes
          if (transitionDelay.waitingForNewResponse) {
            return 'bg-amber-500'; // Continue showing amber while waiting for new response
          }
        }

        // If there's an error, fall back to current VM state
        if (actionStatus.error) {
          // Clear the action status since it errored
          setVmActionStatuses((prev) => {
            const updated = { ...prev };
            delete updated[vmName];
            return updated;
          });
          // Also clear any transition delay
          delete transitionDelayRef.current[vmName];
          if (transitionTimersRef.current[vmName]) {
            clearTimeout(transitionTimersRef.current[vmName]);
            delete transitionTimersRef.current[vmName];
          }
        }

        // If we're waiting for new response, don't fall through to vmState - keep showing amber
        if (transitionDelay?.waitingForNewResponse) {
          return 'bg-amber-500'; // Keep showing amber while waiting
        }
      }

      // Default behavior: use current VM state from WebSocket
      const isTransitioning = refreshingVms[vmName];
      if (isTransitioning) {
        return 'bg-amber-500'; // Amber for transitioning
      }

      // Normalize state - handle both 'Running'/'Stopped' and 'running'/'stopped'
      const normalizedState = vmState ? vmState.toLowerCase().trim() : '';

      if (normalizedState === 'running' || normalizedState === 'started') {
        return 'bg-green-500'; // Green for running
      } else if (normalizedState === 'stopped' || normalizedState === 'stop') {
        return 'bg-red-500'; // Red for stopped
      }

      // Default to gray for unknown states
      return 'bg-gray-400';
    },
    [vmActionStatuses, refreshingVms, setVmActionStatuses, setTransitionUpdate]
  );

  /**
   * Helper function to check if VM is in any transition state
   */
  const isVmInAnyTransition = useCallback(
    (vmName: string, vmState?: string): boolean => {
      // Check for migrating state first - blocks all actions
      if (vmState === 'migrating') {
        return true;
      }

      // Check WebSocket action status
      const actionStatus = vmActionStatuses[vmName];
      if (actionStatus && !actionStatus.is_final) {
        return true;
      }

      // Check if we're in transition delay period (3 seconds after final status)
      const transitionDelay = transitionDelayRef.current[vmName];
      if (transitionDelay) {
        const elapsed = Date.now() - transitionDelay.timestamp;
        if (elapsed < 3000) {
          return true;
        }
      }

      // Fall back to legacy refreshing state
      return refreshingVms[vmName] === true;
    },
    [vmActionStatuses, refreshingVms]
  );

  return {
    getVmStatusColor,
    isVmInAnyTransition,
  };
};

export default useVmStatus;
