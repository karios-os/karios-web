import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export interface RedirectionReturn {
  redirectToK8sProvisioning: (reason: string) => void;
  redirectToControlCenter: (reason: string) => void;
  redirectTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  cleanupRedirectTimeout: () => void;
}

export function useRedirection(
  isRedirecting: boolean,
  setIsRedirecting: (value: boolean) => void,
  setActiveSection: (section: 'control-center' | 'clusters' | null) => void,
  setIsPinned: (value: boolean) => void,
  updateSidebarState: (state: 'hidden' | 'small' | 'expanded') => void
): RedirectionReturn {
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const redirectToK8sProvisioning = useCallback(
    (reason: string) => {
      if (isRedirecting) {
        return;
      }
      setIsRedirecting(true);

      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }

      redirectTimeoutRef.current = setTimeout(() => {
        setActiveSection('clusters');
        setIsPinned(true);
        updateSidebarState('expanded');
        navigate('/k8s-provisioning');

        setTimeout(() => {
          setIsRedirecting(false);
        }, 100);
      }, 300);
    },
    [isRedirecting, setIsRedirecting, setActiveSection, setIsPinned, updateSidebarState, navigate]
  );

  const redirectToControlCenter = useCallback(
    (reason: string) => {
      if (isRedirecting) {
        return;
      }
      setIsRedirecting(true);

      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }

      redirectTimeoutRef.current = setTimeout(() => {
        setActiveSection(null);
        setIsPinned(false);
        updateSidebarState('hidden');
        navigate('/');

        setTimeout(() => {
          setIsRedirecting(false);
        }, 100);
      }, 300);
    },
    [isRedirecting, setIsRedirecting, setActiveSection, setIsPinned, updateSidebarState, navigate]
  );

  const cleanupRedirectTimeout = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
  }, []);

  return {
    redirectToK8sProvisioning,
    redirectToControlCenter,
    redirectTimeoutRef,
    cleanupRedirectTimeout,
  };
}
