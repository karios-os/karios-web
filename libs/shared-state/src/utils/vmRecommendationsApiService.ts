// VM Recommendations API Service
import { ActionTypes } from './actionTypes';
import { VMRecommendation } from '../types/AppState.types';
import api from './interceptor';
import { logger } from './logger';
import envConfig from '../../../../runtime-config';

/**
 * Fetch VM recommendations for a specific node
 * @param nodeIp - The IP address of the node to get recommendations for
 * @param startDate - Start date in ISO format
 * @param endDate - End date in ISO format
 * @param dispatch - Redux dispatch function
 * @returns Promise<VMRecommendation[]>
 */
export const fetchVMRecommendations = async (
  nodeIp: string,
  startDate: string,
  endDate: string,
  dispatch?: any
): Promise<VMRecommendation[]> => {
  if (dispatch) {
    dispatch({ type: ActionTypes.FETCH_VM_RECOMMENDATIONS_START });
  }

  try {
    // Use a fixed server IP for the API call, but nodeIp as the node_ip parameter
    // const serverIP = '192.168.116.132'; // Fixed server IP for API endpoint
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/recommendations/vmstats/recommend?start=${startDate}&end=${endDate}&node_ip=${nodeIp}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch VM recommendations: ${response.statusText}`);
    }

    const data = await response.json();
    const vmRecommendations = Array.isArray(data) ? data : [];

    if (dispatch) {
      dispatch({
        type: ActionTypes.FETCH_VM_RECOMMENDATIONS_SUCCESS,
        payload: vmRecommendations,
      });
    }

    return vmRecommendations;
  } catch (error) {
    logger.error('Error fetching VM recommendations', error);
    if (dispatch) {
      dispatch({
        type: ActionTypes.FETCH_VM_RECOMMENDATIONS_FAILURE,
        payload: error.message,
      });
    }
    throw error;
  }
};

/**
 * Get level color class for UI styling
 * @param level - The recommendation level
 * @returns CSS class string
 */
export const getLevelColorClass = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'normal':
      return 'text-green-600';
    case 'high':
      return 'text-yellow-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

/**
 * Get action color class for UI styling
 * @param action - The recommendation action
 * @returns CSS class string
 */
export const getActionColorClass = (action: string): string => {
  switch (action.toLowerCase()) {
    case 'migrate':
      return 'text-red-600';
    case 'scale':
      return 'text-blue-600';
    case 'optimize':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
};
