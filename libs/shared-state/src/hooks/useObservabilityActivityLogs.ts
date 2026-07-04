// Custom hook for observability activity logs (Notifications component)
import { useAppState } from '../AppStateContext';

export const useObservabilityActivityLogs = () => {
  const context = useAppState() as any; // Temporary any cast to bypass TypeScript issue

  // Provide safe defaults in case observabilityEvents is undefined
  const safeObservabilityEvents = context.observabilityEvents || {
    events: [],
    loading: false,
    error: null,
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    filters: {
      event_type: 'all',
      priority: 'all',
      status: 'all',
      component_type: 'all',
    },
    componentTypes: [],
    componentTypesLoading: false,
    componentTypesError: null,
    approvingEvents: new Set(),
    rejectingEvents: new Set(),
  };

  return {
    // State with safe defaults
    events: safeObservabilityEvents.events || [],
    loading: safeObservabilityEvents.loading || false,
    error: safeObservabilityEvents.error || null,
    totalCount: safeObservabilityEvents.totalCount || 0,
    totalPages: safeObservabilityEvents.totalPages || 1,
    currentPage: safeObservabilityEvents.currentPage || 1,
    filters: safeObservabilityEvents.filters || {
      event_type: 'all',
      priority: 'all',
      status: 'all',
      component_type: 'all',
    },
    componentTypes: safeObservabilityEvents.componentTypes || [],
    componentTypesLoading: safeObservabilityEvents.componentTypesLoading || false,
    componentTypesError: safeObservabilityEvents.componentTypesError || null,
    approvingEvents: safeObservabilityEvents.approvingEvents || new Set(),
    rejectingEvents: safeObservabilityEvents.rejectingEvents || new Set(),

    // Actions - access directly from context
    fetchActivityLogs: context.fetchObservabilityActivityLogs,
    fetchComponentTypes: context.fetchObservabilityComponentTypes,
    approveEvent: context.approveActivityEvent,
    rejectEvent: context.rejectActivityEvent,
    updateFilters: context.updateObservabilityActivityFilters,
    setPagination: context.setObservabilityActivityPagination,
  };
};
