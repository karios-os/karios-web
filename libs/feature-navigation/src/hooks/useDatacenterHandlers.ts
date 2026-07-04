import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionTypes } from '../../../shared-state/src/utils/actionTypes';
import { DataCenter, ServerNode } from '../SideBar-types';

export interface DatacenterHandlersReturn {
  handleDcClick: (dc: DataCenter) => void;
  handleSidebarHeaderClick: (dc: DataCenter) => void;
  handleToggleDatacenterVisibility: (dcId: string) => void;
}

export function useDatacenterHandlers(
  sidebarState: 'hidden' | 'small' | 'expanded',
  updateSidebarState: (state: 'hidden' | 'small' | 'expanded') => void,
  dispatch: any,
  navigate: ReturnType<typeof useNavigate>,
  dataCenters: DataCenter[],
  openDataCenters: Record<string, boolean> | undefined,
  openServers: Record<string, boolean>,
  setNewServerDropdownSelected: (value: string | boolean | null) => void,
  setOpenServers: (state: Record<string, boolean>) => void,
  setManuallyClosedDatacenters: (setter: ((prev: Set<string>) => Set<string>) | Set<string>) => void
): DatacenterHandlersReturn {
  const handleDcClick = useCallback(
    (dc: DataCenter) => {
      dispatch({ type: ActionTypes.SET_SELECTED_DATACENTER, payload: dc });
      navigate(`/dc/${dc.id}`);
    },
    [dispatch, navigate]
  );

  const handleSidebarHeaderClick = useCallback(
    (dc: DataCenter) => {
      if (sidebarState === 'small' || sidebarState === 'hidden') {
        updateSidebarState('expanded');
        return;
      }
      handleDcClick(dc);
    },
    [sidebarState, updateSidebarState, handleDcClick]
  );

  const handleToggleDatacenterVisibility = useCallback(
    (dcId: string) => {
      if (openDataCenters && openDataCenters[dcId]) {
        setManuallyClosedDatacenters((prev) => new Set(prev.add(dcId)));
      } else {
        setManuallyClosedDatacenters((prev) => {
          const newSet = new Set(prev);
          newSet.delete(dcId);
          return newSet;
        });
      }

      dispatch({ type: ActionTypes.TOGGLE_DATACENTER_VISIBILITY, payload: dcId });

      if (openDataCenters && openDataCenters[dcId]) {
        const serversInDc = dataCenters.find((dc) => dc.id === dcId)?.servers || [];
        const serverIds = serversInDc.map((server: ServerNode) => server.id);

        const updatedOpenServers = { ...openServers };
        serverIds.forEach((id: string) => {
          delete updatedOpenServers[id];
        });

        setOpenServers(updatedOpenServers);
        setNewServerDropdownSelected(false);
      }
    },
    [
      dispatch,
      dataCenters,
      openDataCenters,
      openServers,
      setOpenServers,
      setNewServerDropdownSelected,
      setManuallyClosedDatacenters,
    ]
  );

  return {
    handleDcClick,
    handleSidebarHeaderClick,
    handleToggleDatacenterVisibility,
  };
}
