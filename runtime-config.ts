// Runtime configuration utility
// This replaces the build-time env.config.ts for runtime environment variables

declare global {
  interface Window {
    __KARIOS_CONFIG__: {
      ENVIRONMENT: string;
      CONTROL_NODE_IP: {
        URL: string;
        PORT: string;
        LICENSE_URL: string;
      };
      SECURITY_PORT: string;
      UPDATES_API: {
        URL: string;
        PORT: string;
      };
      PROVISIONING_API: {
        URL: string;
        PORT: string;
      };
      LICENSE_PORT: string;
      NOTIFICATION_PORT: string;
      LIQUID_COOLING: {
        URL: string;
        PORT: string;
        SENSOR_URL: string;
        SENSOR_PORT: string;
      };
      VNC_PORT: string;
      PROMETHEUS_PORT: string;
      PROTOCOL: string;
      WS_PROTOCOL: string;
      ENABLE_LC: boolean;
      ENABLE_VXLAN: boolean;
      ENABLE_SEAWEED: boolean;
      SDN: {
        URL: string;
        PORT: string;
      };
      DEBUG: boolean;
      ENABLE_SDN: boolean;
    };
  }
}

export interface RuntimeConfig {
  ENVIRONMENT: string;
  CONTROL_NODE_IP: {
    URL: string;
    PORT: string;
    LICENSE_URL: string;
  };
  SECURITY_PORT: string;
  UPDATES_API: {
    URL: string;
    PORT: string;
  };
  PROVISIONING_API: {
    URL: string;
    PORT: string;
  };

  LICENSE_PORT: string;
  NOTIFICATION_PORT: string;
  LIQUID_COOLING: {
    URL: string;
    PORT: string;
    SENSOR_URL: string;
    SENSOR_PORT: string;
  };
  VNC_PORT: string;
  PROMETHEUS_PORT: string;
  PROTOCOL: string;
  WS_PROTOCOL: string;
  ENABLE_LC: boolean;
  ENABLE_VXLAN: boolean;
  ENABLE_SEAWEED: boolean;
  SDN: {
    URL: string;
    PORT: string;
  };
  DEBUG: boolean;
  ENABLE_SDN: boolean;
}

/**
 * Get runtime configuration from window object
 * Falls back to default values if config is not loaded
 */
export const getRuntimeConfig = (): RuntimeConfig => {
  // Check if the config is loaded from config.js
  if (window.__KARIOS_CONFIG__) {
    return {
      ...window.__KARIOS_CONFIG__,
    };
  }

  // Fallback to default values if config is not loaded
  return {
    ENVIRONMENT: 'development',
    CONTROL_NODE_IP: {
      URL: 'localhost',
      PORT: ':8080',
      LICENSE_URL: 'localhost',
    },
    SECURITY_PORT: '',
    UPDATES_API: {
      URL: 'localhost',
      PORT: '',
    },
    PROVISIONING_API: {
      URL: 'localhost',
      PORT: '',
    },
    LICENSE_PORT: '8069',
    NOTIFICATION_PORT: '8068',
    LIQUID_COOLING: {
      URL: 'localhost',
      PORT: ':8080',
      SENSOR_URL: 'localhost',
      SENSOR_PORT: ':3004',
    },
    VNC_PORT: ':6080',
    PROMETHEUS_PORT: ':9090',
    PROTOCOL: 'http',
    WS_PROTOCOL: 'ws',
    ENABLE_LC: true,
    ENABLE_VXLAN: true,
    ENABLE_SEAWEED: true,
    SDN: {
      URL: '',
      PORT: '',
    },
    DEBUG: false,
    ENABLE_SDN: false,
  };
};

/**
 * Get a specific config value with optional fallback
 */
export const getConfigValue = <K extends keyof RuntimeConfig>(
  key: K,
  fallback?: RuntimeConfig[K]
): RuntimeConfig[K] => {
  const config = getRuntimeConfig();
  return config[key] || fallback || ('' as any);
};

// Export default function that matches the original env.config.ts interface
const envConfig = (): RuntimeConfig => {
  return getRuntimeConfig();
};

export default envConfig;
