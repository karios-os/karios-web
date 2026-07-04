// DataCenter ISO API Service - API calls for ISO management via control node
import { ActionTypes } from './actionTypes';
import envConfig from '../../../../runtime-config';
import api from './interceptor';
import { logger } from './logger';

//new iso
export const fetchDcIsoList = async (dispatch) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  // Safely dispatch events if dispatch is a function
  if (typeof dispatch === 'function') {
    dispatch({ type: ActionTypes.FETCH_ISO_LIST_START });
  }
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/compute/vms/iso`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ISO list: ${response.statusText}`);
    }

    const data = await response.json();
    const isoList = data.isos || [];

    // Safely dispatch events if dispatch is a function
    if (typeof dispatch === 'function') {
      dispatch({ type: ActionTypes.FETCH_ISO_LIST_SUCCESS, payload: isoList });
    }
    return isoList;
  } catch (error) {
    logger.error('Error fetching ISO list:', error);
    // Safely dispatch events if dispatch is a function
    if (typeof dispatch === 'function') {
      dispatch({ type: ActionTypes.FETCH_ISO_LIST_FAILURE, payload: error.message });
    }
    return { error: error.message };
  }
};

//new iso
export const downloadDcIso = async (isoUrl, dispatch) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  try {
    // Get authentication token from local storage
    const authToken = localStorage.getItem('accessToken');

    if (!authToken) {
      logger.error('Authentication token is missing');
      throw new Error('Authentication token is missing. Please log in again.');
    }

    const response = await fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/compute/vms/iso/download`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ iso_url: isoUrl }),
      }
    );

    if (!response.ok) {
      // Try to get the error message from the response
      let errorMessage = 'Failed to download ISO';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Only call fetchDcIsoList if dispatch is a function
    if (typeof dispatch === 'function') {
      await fetchDcIsoList(dispatch);
    }
    return true;
  } catch (error) {
    logger.error('Error downloading ISO:', error);
    throw error;
  }
};

/**
 * Upload an ISO file to the control node
 * @param {File} file - The ISO file to upload
 * @param {Object} dispatch - Redux dispatch function
 * @param {string} isoType - Type of ISO ('local' or 'cloud-init')
 * @returns {Promise<boolean>} - Returns true if upload was successful
 */
//new iso
export const uploadDcIso = async (file, dispatch, isoType = 'local') => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', isoType); // Add ISO type to the form data

    // Get authentication token from local storage
    const authToken = localStorage.getItem('accessToken');

    if (!authToken) {
      logger.error('Authentication token is missing');
      throw new Error('Authentication token is missing. Please log in again.');
    }

    const response = await fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/compute/vms/iso/upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }

      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload ISO');
      } catch {
        throw new Error(`Failed to upload ISO: ${response.statusText}`);
      }
    }

    // Only call fetch functions if dispatch is a function
    if (typeof dispatch === 'function') {
      await fetchDcIsoList(dispatch);

      // Also fetch cloud images if this was a cloud image upload
      if (isoType === 'cloud-init') {
        await fetchDcCloudImages(dispatch);
      }
    }
    return true;
  } catch (error) {
    logger.error('Error uploading ISO:', error);
    throw error;
  }
};

//new iso
export const deleteDcIso = async (isoName, dispatch, isCloudImage = false) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  try {
    const payload = {
      iso: isoName,
      is_cloud_image: isCloudImage,
    };

    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/compute/vms/iso/delete`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      // Try to get the error message from the response
      let errorMessage = 'Failed to delete ISO';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Only call fetchDcIsoList if dispatch is a function
    if (typeof dispatch === 'function') {
      await fetchDcIsoList(dispatch);
    }
    return true;
  } catch (error) {
    logger.error('Error deleting ISO:', error);
    throw error;
  }
};

// Fetch cloud images list from Control Node
export const fetchDcCloudImages = async (dispatch) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  // Safely dispatch events if dispatch is a function
  if (typeof dispatch === 'function') {
    dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_START });
  }
  try {
    const response = await api.fetch(
      `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/compute/vms/cloudimages`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch cloud images: ${response.statusText}`);
    }

    const data = await response.json();
    // The API returns { raws: ["image1.raw", "image2.raw"] }
    const cloudImages = data.raws || [];

    // Safely dispatch events if dispatch is a function
    if (typeof dispatch === 'function') {
      dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_SUCCESS, payload: cloudImages });
    }

    return cloudImages;
  } catch (error) {
    logger.error('Error fetching cloud images:', error);

    // Safely dispatch events if dispatch is a function
    if (typeof dispatch === 'function') {
      dispatch({ type: ActionTypes.FETCH_CLOUD_IMAGES_FAILURE, payload: error.message });
    }

    throw error;
  }
};

// Enhanced upload function with shared state integration
export const uploadDcIsoWithProgress = async (file, dispatch, isoType = 'local') => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  try {
    // Start upload
    dispatch({ type: ActionTypes.DC_ISO_UPLOAD_START });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', isoType);

    // Get authentication token from local storage
    const authToken = localStorage.getItem('accessToken');

    if (!authToken) {
      throw new Error('Authentication token is missing. Please log in again.');
    }

    // Create a custom fetch with progress tracking
    const uploadUrl = `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/compute/vms/iso/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          dispatch({
            type: ActionTypes.DC_ISO_UPLOAD_PROGRESS,
            payload: { progress: Math.min(percentComplete, 99) },
          });

          // Update message for finalization phase
          if (percentComplete > 85) {
            dispatch({
              type: ActionTypes.DC_ISO_SET_UPLOAD_MESSAGE,
              payload: { message: 'Finalizing upload...', messageType: 'info' },
            });
          }
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Complete upload
          dispatch({
            type: ActionTypes.DC_ISO_UPLOAD_PROGRESS,
            payload: { progress: 100 },
          });
          dispatch({
            type: ActionTypes.DC_ISO_SET_UPLOAD_MESSAGE,
            payload: {
              message:
                isoType === 'local'
                  ? 'ISO uploaded successfully!'
                  : 'RAW file uploaded successfully!',
              messageType: 'success',
            },
          });
          dispatch({ type: ActionTypes.DC_ISO_UPLOAD_SUCCESS });

          // Auto-clear state after success
          setTimeout(() => {
            dispatch({ type: ActionTypes.DC_ISO_CLEAR_UPLOAD_STATE });
          }, 2000);

          resolve(xhr.response);
        } else {
          const errorMsg = xhr.responseText || `Upload failed with status: ${xhr.status}`;
          dispatch({
            type: ActionTypes.DC_ISO_SET_UPLOAD_MESSAGE,
            payload: { message: errorMsg, messageType: 'error' },
          });
          dispatch({ type: ActionTypes.DC_ISO_UPLOAD_FAILURE, payload: errorMsg });
          reject(new Error(errorMsg));
        }
      });

      xhr.addEventListener('error', () => {
        const errorMsg = 'Upload failed due to network error';
        dispatch({
          type: ActionTypes.DC_ISO_SET_UPLOAD_MESSAGE,
          payload: { message: errorMsg, messageType: 'error' },
        });
        dispatch({ type: ActionTypes.DC_ISO_UPLOAD_FAILURE, payload: errorMsg });
        reject(new Error(errorMsg));
      });

      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.send(formData);
    });
  } catch (error) {
    logger.error('Error uploading ISO:', error);
    dispatch({
      type: ActionTypes.DC_ISO_SET_UPLOAD_MESSAGE,
      payload: { message: error.message, messageType: 'error' },
    });
    dispatch({ type: ActionTypes.DC_ISO_UPLOAD_FAILURE, payload: error.message });
    throw error;
  }
};

// Enhanced download function with shared state integration
export const downloadDcIsoWithProgress = async (isoUrl, dispatch) => {
  const controlNodeConfig = envConfig().CONTROL_NODE_IP;
  const controlNodeUrl = controlNodeConfig.URL;
  const controlNodePort = controlNodeConfig.PORT;

  try {
    // Start download
    dispatch({ type: ActionTypes.DC_ISO_DOWNLOAD_START });

    // Get authentication token from local storage
    const authToken = localStorage.getItem('accessToken');

    if (!authToken) {
      throw new Error('Authentication token is missing. Please log in again.');
    }

    const downloadUrl = `${envConfig().PROTOCOL}://${controlNodeUrl}${controlNodePort}/api/v1/compute/vms/iso/download`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          dispatch({
            type: ActionTypes.DC_ISO_DOWNLOAD_PROGRESS,
            payload: { progress: Math.min(percentComplete, 99) },
          });

          // Update message for finalization phase
          if (percentComplete > 85) {
            dispatch({
              type: ActionTypes.DC_ISO_SET_DOWNLOAD_MESSAGE,
              payload: { message: 'Finalizing download...', messageType: 'info' },
            });
          }
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Complete download
          dispatch({
            type: ActionTypes.DC_ISO_DOWNLOAD_PROGRESS,
            payload: { progress: 100 },
          });
          dispatch({
            type: ActionTypes.DC_ISO_SET_DOWNLOAD_MESSAGE,
            payload: { message: 'ISO downloaded successfully!', messageType: 'success' },
          });
          dispatch({ type: ActionTypes.DC_ISO_DOWNLOAD_SUCCESS });

          // Auto-clear state after success
          setTimeout(() => {
            dispatch({ type: ActionTypes.DC_ISO_CLEAR_DOWNLOAD_STATE });
          }, 2000);

          resolve(xhr.response);
        } else {
          const errorMsg = xhr.responseText || `Download failed with status: ${xhr.status}`;
          dispatch({
            type: ActionTypes.DC_ISO_SET_DOWNLOAD_MESSAGE,
            payload: { message: errorMsg, messageType: 'error' },
          });
          dispatch({ type: ActionTypes.DC_ISO_DOWNLOAD_FAILURE, payload: errorMsg });
          reject(new Error(errorMsg));
        }
      });

      xhr.addEventListener('error', () => {
        const errorMsg = 'Download failed due to network error';
        dispatch({
          type: ActionTypes.DC_ISO_SET_DOWNLOAD_MESSAGE,
          payload: { message: errorMsg, messageType: 'error' },
        });
        dispatch({ type: ActionTypes.DC_ISO_DOWNLOAD_FAILURE, payload: errorMsg });
        reject(new Error(errorMsg));
      });

      xhr.open('POST', downloadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({ iso_url: isoUrl }));
    });
  } catch (error) {
    logger.error('Error downloading ISO:', error);
    dispatch({
      type: ActionTypes.DC_ISO_SET_DOWNLOAD_MESSAGE,
      payload: { message: error.message, messageType: 'error' },
    });
    dispatch({ type: ActionTypes.DC_ISO_DOWNLOAD_FAILURE, payload: error.message });
    throw error;
  }
};
