// API service for observability events management
import { ActionTypes } from './actionTypes';
import api from './interceptor';
import envConfig from '../../../../runtime-config';
import { logger } from './logger';

// Interface for activity log data
export interface ActivityLog {
  id: number;
  roles: string;
  username: string;
  vm_name: string;
  activity: string;
  ip: string;
  status: string;
  component_type: string;
  start_time: string;
  end_time: string;
}

// Interface for events response
export interface EventsResponse {
  logs: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

// Interface for filters
export interface EventFilters {
  event_type: string;
  priority: string;
  status: string;
  component_type: string;
}

// Fetch observability events/activity logs
export const fetchObservabilityActivityLogs = async (
  dispatch: any,
  serverIp: string,
  options: {
    limit?: number;
    offset?: number;
    filters?: Partial<EventFilters>;
  } = {}
): Promise<EventsResponse> => {
  dispatch({ type: ActionTypes.FETCH_OBSERVABILITY_EVENTS_START });
  try {
    const { limit = 10, offset = 0, filters = {} } = options;

    // Build query parameters
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    if (filters.event_type && filters.event_type !== 'all') {
      params.append('event_type', filters.event_type);
    }
    if (filters.priority && filters.priority !== 'all') {
      params.append('priority', filters.priority);
    }
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    if (filters.component_type && filters.component_type !== 'all') {
      params.append('component_type', filters.component_type);
    }

    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const url = `${envConfig().PROTOCOL}://${serverIp}${controlNodeConfig.PORT}/api/v1/observability/activity-logs?${params.toString()}`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const eventsData = {
      logs: data.logs || [],
      total: data.total || 0,
      limit: data.limit || limit,
      offset: data.offset || offset,
    };

    dispatch({
      type: ActionTypes.FETCH_OBSERVABILITY_EVENTS_SUCCESS,
      payload: {
        events: eventsData.logs,
        totalCount: eventsData.total,
        totalPages: Math.ceil(eventsData.total / eventsData.limit),
        currentPage: Math.floor(eventsData.offset / eventsData.limit) + 1,
      },
    });

    return eventsData;
  } catch (error) {
    logger.error('Error fetching observability events:', error);
    dispatch({
      type: ActionTypes.FETCH_OBSERVABILITY_EVENTS_FAILURE,
      payload: error instanceof Error ? error.message : 'Failed to fetch observability events',
    });
    throw error;
  }
};

// Fetch component types for filter dropdown
export const fetchObservabilityComponentTypes = async (
  dispatch: any,
  serverIp: string
): Promise<string[]> => {
  dispatch({ type: ActionTypes.FETCH_COMPONENT_TYPES_START });
  try {
    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const url = `${envConfig().PROTOCOL}://${serverIp}${controlNodeConfig.PORT}/api/v1/observability/components`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch component types: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Deduplicate component types
    const uniqueTypes = Array.isArray(data.components)
      ? (Array.from(new Set(data.components)) as string[])
      : [];

    dispatch({ type: ActionTypes.FETCH_COMPONENT_TYPES_SUCCESS, payload: uniqueTypes });
    return uniqueTypes;
  } catch (error) {
    logger.error('Error fetching component types:', error);
    dispatch({
      type: ActionTypes.FETCH_COMPONENT_TYPES_FAILURE,
      payload: error instanceof Error ? error.message : 'Failed to fetch component types',
    });
    throw error;
  }
};

// Approve observability event
export const approveObservabilityActivityEvent = async (
  dispatch: any,
  serverIp: string,
  eventId: number
): Promise<any> => {
  dispatch({ type: ActionTypes.APPROVE_EVENT_START, payload: eventId });
  try {
    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const url = `${envConfig().PROTOCOL}://${serverIp}${controlNodeConfig.PORT}/api/v1/approveEvent?eventId=${eventId}`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to approve event: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    dispatch({ type: ActionTypes.APPROVE_EVENT_SUCCESS, payload: eventId });
    return data;
  } catch (error) {
    logger.error('Error approving event:', error);
    dispatch({
      type: ActionTypes.APPROVE_EVENT_FAILURE,
      payload: {
        eventId,
        error: error instanceof Error ? error.message : 'Failed to approve event',
      },
    });
    throw error;
  }
};

// Reject observability event
export const rejectObservabilityActivityEvent = async (
  dispatch: any,
  serverIp: string,
  eventId: number
): Promise<any> => {
  dispatch({ type: ActionTypes.REJECT_EVENT_START, payload: eventId });
  try {
    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const url = `${envConfig().PROTOCOL}://${serverIp}${controlNodeConfig.PORT}/api/v1/rejectEvent?eventId=${eventId}`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to reject event: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    dispatch({ type: ActionTypes.REJECT_EVENT_SUCCESS, payload: eventId });
    return data;
  } catch (error) {
    logger.error('Error rejecting event:', error);
    dispatch({
      type: ActionTypes.REJECT_EVENT_FAILURE,
      payload: {
        eventId,
        error: error instanceof Error ? error.message : 'Failed to reject event',
      },
    });
    throw error;
  }
};

// Update observability activity log filters
export const updateObservabilityActivityFilters = (
  dispatch: any,
  filters: Partial<EventFilters>
): void => {
  dispatch({ type: ActionTypes.UPDATE_OBSERVABILITY_FILTERS, payload: filters });
};

// Set observability activity log pagination
export const setObservabilityActivityPagination = (dispatch: any, paginationData: any): void => {
  dispatch({ type: ActionTypes.SET_OBSERVABILITY_PAGINATION, payload: paginationData });
};
