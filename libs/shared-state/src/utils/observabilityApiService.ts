// API service for observability services management
import { ActionTypes } from './actionTypes';
import api from './interceptor';
import envConfig from '../../../../runtime-config';
import { logger } from './logger';

// Interface for observability services status
export interface ObservabilityServiceStatus {
  grafana: boolean;
  node_exporter: boolean;
  prometheus: boolean;
}

// Fetch observability services status
export const fetchObservabilityServicesStatus = async (
  serverIp: string,
  dispatch: any
): Promise<ObservabilityServiceStatus> => {
  dispatch({ type: ActionTypes.FETCH_OBSERVABILITY_STATUS_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/services/status`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch observability services status: ${response.status}`);
    }

    const data = await response.json();
    dispatch({ type: ActionTypes.FETCH_OBSERVABILITY_STATUS_SUCCESS, payload: data });
    return data;
  } catch (error) {
    logger.error('Error fetching observability services status:', error);
    dispatch({
      type: ActionTypes.FETCH_OBSERVABILITY_STATUS_FAILURE,
      payload:
        error instanceof Error ? error.message : 'Failed to fetch observability services status',
    });
    throw error;
  }
};

// Start observability service
export const startObservabilityService = async (
  serverIp: string,
  serviceName: 'grafana' | 'prometheus' | 'node_exporter',
  dispatch: any
): Promise<any> => {
  dispatch({ type: ActionTypes.START_OBSERVABILITY_SERVICE_START, payload: serviceName });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/service/${serviceName}/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to start ${serviceName} service: ${response.status}`);
    }

    const responseData = await response.json();

    dispatch({ type: ActionTypes.START_OBSERVABILITY_SERVICE_SUCCESS, payload: serviceName });
    return responseData;
  } catch (error) {
    logger.error(`Error starting ${serviceName} service:`, error);
    dispatch({
      type: ActionTypes.START_OBSERVABILITY_SERVICE_FAILURE,
      payload: {
        service: serviceName,
        error: error instanceof Error ? error.message : `Failed to start ${serviceName} service`,
      },
    });
    throw error;
  }
};

// Stop observability service
export const stopObservabilityService = async (
  serverIp: string,
  serviceName: 'grafana' | 'prometheus' | 'node_exporter',
  dispatch: any
): Promise<any> => {
  dispatch({ type: ActionTypes.STOP_OBSERVABILITY_SERVICE_START, payload: serviceName });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/service/${serviceName}/stop`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to stop ${serviceName} service: ${response.status}`);
    }

    const responseData = await response.json();

    dispatch({ type: ActionTypes.STOP_OBSERVABILITY_SERVICE_SUCCESS, payload: serviceName });
    return responseData;
  } catch (error) {
    logger.error(`Error stopping ${serviceName} service:`, error);
    dispatch({
      type: ActionTypes.STOP_OBSERVABILITY_SERVICE_FAILURE,
      payload: {
        service: serviceName,
        error: error instanceof Error ? error.message : `Failed to stop ${serviceName} service`,
      },
    });
    throw error;
  }
};

// Restart observability service
export const restartObservabilityService = async (
  serverIp: string,
  serviceName: 'grafana' | 'prometheus' | 'node_exporter',
  dispatch: any
): Promise<any> => {
  dispatch({ type: ActionTypes.RESTART_OBSERVABILITY_SERVICE_START, payload: serviceName });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/service/${serviceName}/restart`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to restart ${serviceName} service: ${response.status}`);
    }

    const responseData = await response.json();

    dispatch({ type: ActionTypes.RESTART_OBSERVABILITY_SERVICE_SUCCESS, payload: serviceName });
    return responseData;
  } catch (error) {
    logger.error(`Error restarting ${serviceName} service:`, error);
    dispatch({
      type: ActionTypes.RESTART_OBSERVABILITY_SERVICE_FAILURE,
      payload: {
        service: serviceName,
        error: error instanceof Error ? error.message : `Failed to restart ${serviceName} service`,
      },
    });
    throw error;
  }
};

// Launch Grafana dashboard
export const launchGrafanaDashboard = async (
  serverIp: string,
  dispatch: any
): Promise<{ dashboard_url: string; status: string }> => {
  dispatch({ type: ActionTypes.LAUNCH_GRAFANA_DASHBOARD_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/grafana/launch-dashboard`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to launch Grafana dashboard: ${response.status}`);
    }

    const responseData = await response.json();

    dispatch({
      type: ActionTypes.LAUNCH_GRAFANA_DASHBOARD_SUCCESS,
      payload: responseData.dashboard_url,
    });
    return responseData;
  } catch (error) {
    logger.error('Error launching Grafana dashboard:', error);
    dispatch({
      type: ActionTypes.LAUNCH_GRAFANA_DASHBOARD_FAILURE,
      payload: error instanceof Error ? error.message : 'Failed to launch Grafana dashboard',
    });
    throw error;
  }
};

// Fetch observability events
export const fetchObservabilityEvents = async (
  dispatch: any,
  serverIp: string,
  options: any = {}
): Promise<any> => {
  dispatch({ type: ActionTypes.FETCH_OBSERVABILITY_EVENTS_START });
  try {
    const { filters = {}, page = 1, limit = 50 } = options;
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/events?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch observability events: ${response.status}`);
    }

    const data = await response.json();
    dispatch({ type: ActionTypes.FETCH_OBSERVABILITY_EVENTS_SUCCESS, payload: data });
    return data;
  } catch (error) {
    logger.error('Error fetching observability events:', error);
    dispatch({
      type: ActionTypes.FETCH_OBSERVABILITY_EVENTS_FAILURE,
      payload: error instanceof Error ? error.message : 'Failed to fetch observability events',
    });
    throw error;
  }
};

// Fetch component types
export const fetchComponentTypes = async (dispatch: any, serverIp: string): Promise<string[]> => {
  dispatch({ type: ActionTypes.FETCH_COMPONENT_TYPES_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/component-types`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch component types: ${response.status}`);
    }

    const data = await response.json();
    dispatch({ type: ActionTypes.FETCH_COMPONENT_TYPES_SUCCESS, payload: data });
    return data;
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
export const approveObservabilityEvent = async (
  dispatch: any,
  serverIp: string,
  eventId: number
): Promise<any> => {
  dispatch({ type: ActionTypes.APPROVE_EVENT_START, payload: eventId });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/events/${eventId}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to approve event: ${response.status}`);
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
export const rejectObservabilityEvent = async (
  dispatch: any,
  serverIp: string,
  eventId: number
): Promise<any> => {
  dispatch({ type: ActionTypes.REJECT_EVENT_START, payload: eventId });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/observability/events/${eventId}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to reject event: ${response.status}`);
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

// Update observability filters
export const updateObservabilityFilters = (dispatch: any, filters: any): void => {
  dispatch({ type: ActionTypes.UPDATE_OBSERVABILITY_FILTERS, payload: filters });
};

// Set observability pagination
export const setObservabilityPagination = (dispatch: any, paginationData: any): void => {
  dispatch({ type: ActionTypes.SET_OBSERVABILITY_PAGINATION, payload: paginationData });
};
