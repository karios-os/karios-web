import { logger } from '../../utils/logger';
import envConfig from '../../../../../runtime-config';

/**
 * Dell Firmware Service
 * Handles Dell BIOS firmware update operations using shared-state architecture
 */

// Helper function to get authorization headers
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Dell BIOS Update Request Interface
 */
export interface DellBiosUpdateRequest {
  bmc_ip: string;
  image_uri: string;
}

/**
 * Dell BIOS Update Response Interface
 */
export interface DellBiosUpdateResponse {
  status: string;
  message: string;
  job_id?: string;
  task_id?: string;
}

/**
 * Trigger Dell BIOS firmware update
 *
 * API Endpoint: POST /api/v1/dell-inventory/bios/update
 *
 * Request body example:
 * {
 *   "bmc_ip": "192.168.116.47",
 *   "image_uri": "http://192.168.116.26/api/v1/inventory/bin/BIOS_973F7_LN64_2.2.1.BIN"
 * }
 */
export const triggerDellBiosUpdate = async (
  payload: DellBiosUpdateRequest
): Promise<DellBiosUpdateResponse> => {
  try {
    const baseUrl = envConfig().CONTROL_NODE_IP;
    const endpoint = `${envConfig().PROTOCOL}://${baseUrl.URL}/api/v1/dell-inventory/bios/update`;

    logger.info('Triggering Dell BIOS firmware update', {
      bmc_ip: payload.bmc_ip,
      image_uri: payload.image_uri,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        bmc_ip: payload.bmc_ip,
        image_uri: payload.image_uri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to trigger Dell BIOS update: ${response.statusText}`
      );
    }

    const data = await response.json();
    logger.info('Dell BIOS firmware update triggered successfully', {
      bmc_ip: payload.bmc_ip,
      response: data,
    });

    return data;
  } catch (error) {
    logger.error('Error triggering Dell BIOS firmware update', {
      error,
      payload,
    });
    throw error;
  }
};

/**
 * Get Dell firmware update job status
 * Track the progress of the firmware update operation
 */
export interface DellJobStatus {
  job_id: string;
  status: string;
  progress: number;
  message?: string;
  completed_at?: string;
}

/**
 * Get firmware update progress via WebSocket
 * Connects to job tracking WebSocket for real-time updates
 */
export const connectDellFirmwareUpdateWebSocket = (
  bmc_ip: string,
  job_id: string,
  onProgress: (data: any) => void,
  onError: (error: Error) => void,
  onComplete: (data: any) => void
): WebSocket | null => {
  try {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      throw new Error('No authentication token found');
    }

    // WebSocket endpoint for job tracking
    const wsEndpoint = `${envConfig().WS_PROTOCOL}://${envConfig().CONTROL_NODE_IP.URL}/api/v1/dell-inventory/job-tracking?bmc_ip=${bmc_ip}&job_id=${job_id}&token=${token}`;

    const ws = new WebSocket(wsEndpoint);

    ws.onopen = () => {
      logger.info('Dell firmware update WebSocket connected', {
        bmc_ip,
        job_id,
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        logger.debug('Dell firmware update progress received', data);
        onProgress(data);

        // Check if update is complete
        if (data.status === 'completed' || data.status === 'failed') {
          onComplete(data);
          ws.close();
        }
      } catch (error) {
        logger.error('Error parsing WebSocket message', error);
        onError(error as Error);
      }
    };

    ws.onerror = (event) => {
      const error = new Error('WebSocket connection error');
      logger.error('Dell firmware update WebSocket error', error);
      onError(error);
    };

    ws.onclose = () => {
      logger.info('Dell firmware update WebSocket closed', {
        bmc_ip,
        job_id,
      });
    };

    return ws;
  } catch (error) {
    logger.error('Error connecting Dell firmware update WebSocket', error);
    onError(error as Error);
    return null;
  }
};

/**
 * Complete firmware update workflow:
 * 1. Upload BIOS binary file
 * 2. Trigger BIOS update with image URI
 * 3. Track job progress via WebSocket
 * 4. Handle restart if needed
 */
export interface FirmwareUpdateWorkflow {
  step:
    | 'uploading'
    | 'validating'
    | 'updating'
    | 'tracking'
    | 'restarting'
    | 'completed'
    | 'failed';
  progress: number;
  message: string;
  job_id?: string;
}

/**
 * Execute complete Dell BIOS firmware update workflow
 */
export const executeDellBiosUpdateWorkflow = async (
  bmc_ip: string,
  image_uri: string,
  onProgress: (workflow: FirmwareUpdateWorkflow) => void
): Promise<DellBiosUpdateResponse> => {
  try {
    // Step 1: Validate inputs
    if (!bmc_ip || !image_uri) {
      throw new Error('Invalid parameters: bmc_ip and image_uri are required');
    }

    onProgress({
      step: 'validating',
      progress: 10,
      message: 'Validating firmware update parameters',
    });

    // Step 2: Trigger update
    onProgress({
      step: 'updating',
      progress: 20,
      message: 'Initiating BIOS firmware update on Dell server',
    });

    const updateResponse = await triggerDellBiosUpdate({
      bmc_ip,
      image_uri,
    });

    onProgress({
      step: 'tracking',
      progress: 50,
      message: 'Firmware update in progress. Tracking job status...',
      job_id: updateResponse.job_id || updateResponse.task_id,
    });

    // Step 3: Update completed (actual tracking happens via WebSocket in component)
    onProgress({
      step: 'completed',
      progress: 100,
      message: 'BIOS firmware update completed successfully',
      job_id: updateResponse.job_id || updateResponse.task_id,
    });

    logger.info('Dell BIOS firmware update workflow completed', updateResponse);
    return updateResponse;
  } catch (error) {
    logger.error('Dell BIOS firmware update workflow failed', error);
    onProgress({
      step: 'failed',
      progress: 0,
      message: `Firmware update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    throw error;
  }
};
