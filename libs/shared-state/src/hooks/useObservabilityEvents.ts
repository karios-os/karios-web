import { useContext } from 'react';
import { AppStateContext } from '../AppStateContext';

export const useObservabilityEvents = () => {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useObservabilityEvents must be used within an AppStateProvider');
  }

  return {
    // State
    observabilityEvents: context.observabilityEvents,

    // Actions
    fetchObservabilityEvents: context.fetchObservabilityEvents,
    fetchComponentTypes: context.fetchComponentTypes,
    approveEvent: context.approveEvent,
    rejectEvent: context.rejectEvent,
    updateObservabilityFilters: context.updateObservabilityFilters,
    setObservabilityPagination: context.setObservabilityPagination,
  };
};
