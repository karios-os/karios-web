// API service for landing page specific API calls
import { ActionTypes } from './actionTypes';
import api from './interceptor';
import envConfig from '../../../../runtime-config';

// Fetch node top metrics info
export const fetchNodeTopInfo = async (serverIp, dispatch) => {
  dispatch({ type: ActionTypes.FETCH_NODE_TOP_INFO_START });
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${serverIp}${envConfig().CONTROL_NODE_IP.PORT}/api/v1/metrics/node/top/info`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch node top info');
    }

    const data = await response.json();
    dispatch({ type: ActionTypes.FETCH_NODE_TOP_INFO_SUCCESS, payload: data });
    return data;
  } catch (error) {
    dispatch({ type: ActionTypes.FETCH_NODE_TOP_INFO_FAILURE, payload: error.message });
    return null;
  }
};
