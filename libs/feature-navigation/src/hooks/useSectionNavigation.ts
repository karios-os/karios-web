import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseSectionNavigationProps {
  dataCenters?: any[];
  clusterData?: any;
  activeSection?: string;
  isTransitioning?: boolean;
  dispatch?: any;
  setShowBothOptions?: (value: boolean) => void;
  setIsTransitioning?: (value: boolean) => void;
  setIsPinned?: (value: boolean) => void;
  updateSidebarState?: (state: 'hidden' | 'small' | 'expanded') => void;
  setLastActiveSection?: (section: string) => void;
  setActiveSection?: (section: string) => void;
  setSelectedCluster?: (cluster: any) => void;
  setIsLoadingClusters?: (loading: boolean) => void;
  refreshClusterData?: (forceRefresh?: boolean) => Promise<any>;
}

const SECTION_SWITCH_DEBOUNCE_MS = 300;

export const useSectionNavigation = (props: UseSectionNavigationProps) => {
  const {
    dataCenters,
    clusterData,
    activeSection,
    isTransitioning,
    dispatch,
    setShowBothOptions,
    setIsTransitioning,
    setIsPinned,
    updateSidebarState,
    setLastActiveSection,
    setActiveSection,
    setSelectedCluster,
    setIsLoadingClusters,
    refreshClusterData,
  } = props;

  const navigate = useNavigate();
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSectionSwitchRef = useRef<number>(0);

  const handleControlCenterClick = useCallback(() => {
    // Debounce section switching
    const now = Date.now();
    if (now - lastSectionSwitchRef.current < SECTION_SWITCH_DEBOUNCE_MS) {
      return;
    }
    lastSectionSwitchRef.current = now;

    setShowBothOptions?.(false);
    setIsTransitioning?.(true);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    setIsPinned?.(true);
    updateSidebarState?.('expanded');
    setSelectedCluster?.(null);
    dispatch?.({ type: 'SET_SELECTED_VM', payload: null });

    setLastActiveSection?.('control-center');
    setActiveSection?.('control-center');

    if (dataCenters && dataCenters.length > 0) {
      const dc = dataCenters[0];
      dispatch?.({ type: 'SET_SELECTED_DATACENTER', payload: dc });
      navigate(`/dc/${dc.id}`);
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning?.(false);
    }, 50);
  }, [
    dataCenters,
    dispatch,
    navigate,
    updateSidebarState,
    setShowBothOptions,
    setIsTransitioning,
    setIsPinned,
    setSelectedCluster,
    setLastActiveSection,
    setActiveSection,
  ]);

  const handleKubernetesClick = useCallback(async () => {
    // Debounce section switching
    const now = Date.now();
    if (now - lastSectionSwitchRef.current < SECTION_SWITCH_DEBOUNCE_MS) {
      return;
    }
    lastSectionSwitchRef.current = now;

    if (activeSection === 'clusters' && !isTransitioning) {
      return;
    }

    setShowBothOptions?.(false);
    setIsTransitioning?.(true);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    setIsPinned?.(true);
    updateSidebarState?.('expanded');

    setLastActiveSection?.('clusters');
    setActiveSection?.('clusters');
    setSelectedCluster?.(null);

    if (clusterData && clusterData.clusters && clusterData.clusters.length > 0) {
      const firstCluster = clusterData.clusters[0];
      const firstClusterName = firstCluster.KubernetesClusterName;
      navigate(`/cluster/${firstClusterName}/details`);
    } else {
      navigate('/k8s-provisioning');
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning?.(false);
    }, 50);

    if (!clusterData || !clusterData.clusters || clusterData.clusters.length === 0) {
      setIsLoadingClusters?.(true);

      try {
        const data = await refreshClusterData?.();
        if (data && data.clusters && data.clusters.length > 0) {
          const currentPath = window.location.pathname;
          if (currentPath === '/k8s-provisioning') {
            const firstCluster = data.clusters[0];
            const firstClusterName = firstCluster.KubernetesClusterName;
            navigate(`/cluster/${firstClusterName}/details`);
          }
        }
      } finally {
        setIsLoadingClusters?.(false);
      }
    }
  }, [
    activeSection,
    isTransitioning,
    clusterData,
    navigate,
    setShowBothOptions,
    setIsTransitioning,
    setIsPinned,
    updateSidebarState,
    setLastActiveSection,
    setActiveSection,
    setSelectedCluster,
    setIsLoadingClusters,
    refreshClusterData,
  ]);

  return {
    handleControlCenterClick,
    handleKubernetesClick,
    transitionTimeoutRef,
  };
};
