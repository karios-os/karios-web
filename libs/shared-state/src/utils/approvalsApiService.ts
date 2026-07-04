import api from './interceptor';
import { ActionTypes } from './actionTypes';
import envConfig from '../../../../runtime-config';
import { logger } from './logger';

// Types for activity log data based on the API response
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

export interface ApprovalsResponse {
  logs: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface FetchApprovalsOptions {
  page?: number;
  limit?: number;
}

/**
 * Fetch approvals/activity logs with REQUEST component type
 */
export const fetchApprovals = async (
  dispatch: any,
  host: string,
  options: FetchApprovalsOptions = {}
) => {
  try {
    dispatch({ type: ActionTypes.FETCH_APPROVALS_START });

    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    // Build query parameters - always filter for REQUEST component type
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    params.append('component_type', 'REQUEST');

    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const url = `${envConfig().PROTOCOL}://${host}${controlNodeConfig.PORT}/api/v1/observability/activity-logs?${params.toString()}`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch approvals: ${response.status} ${response.statusText}`);
    }

    const data: ApprovalsResponse = await response.json();

    dispatch({
      type: ActionTypes.FETCH_APPROVALS_SUCCESS,
      payload: {
        events: data.logs || [],
        totalCount: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / (data.limit || limit)),
        page: Math.floor((data.offset || 0) / (data.limit || limit)) + 1,
        limit: data.limit || limit,
      },
    });

    return data;
  } catch (error) {
    logger.error('Error fetching approvals:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch approvals';

    dispatch({
      type: ActionTypes.FETCH_APPROVALS_FAILURE,
      payload: errorMessage,
    });

    throw error;
  }
};

/**
 * Approve an event/request
 */
export const approveEvent = async (dispatch: any, host: string, eventId: number) => {
  try {
    dispatch({
      type: ActionTypes.APPROVE_EVENT_START,
      payload: { eventId },
    });

    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const url = `${envConfig().PROTOCOL}://${host}${controlNodeConfig.PORT}/api/v1/approveEvent?eventId=${eventId}`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to approve event: ${response.status} ${response.statusText}`);
    }

    dispatch({
      type: ActionTypes.APPROVE_EVENT_SUCCESS,
      payload: { eventId },
    });

    return response;
  } catch (error) {
    logger.error('Error approving event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to approve event';

    dispatch({
      type: ActionTypes.APPROVE_EVENT_FAILURE,
      payload: { eventId, error: errorMessage },
    });

    throw error;
  }
};

/**
 * Reject an event/request
 */
export const rejectEvent = async (dispatch: any, host: string, eventId: number) => {
  try {
    dispatch({
      type: ActionTypes.REJECT_EVENT_START,
      payload: { eventId },
    });

    const controlNodeConfig = envConfig().CONTROL_NODE_IP;
    const url = `${envConfig().PROTOCOL}://${host}${controlNodeConfig.PORT}/api/v1/rejectEvent?eventId=${eventId}`;

    const response = await api.fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to reject event: ${response.status} ${response.statusText}`);
    }

    dispatch({
      type: ActionTypes.REJECT_EVENT_SUCCESS,
      payload: { eventId },
    });

    return response;
  } catch (error) {
    logger.error('Error rejecting event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject event';

    dispatch({
      type: ActionTypes.REJECT_EVENT_FAILURE,
      payload: { eventId, error: errorMessage },
    });

    throw error;
  }
};

/**
 * Set pagination for approvals
 */
export const setApprovalsPagination = (
  dispatch: any,
  pagination: { page: number; totalPages: number; totalCount: number; limit: number }
) => {
  dispatch({
    type: ActionTypes.SET_APPROVALS_PAGINATION,
    payload: pagination,
  });
};
