/**
 * Test Logger Utility
 * Simple logger for Playwright tests with structured output
 */

export interface TestLogger {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  debug: (message: string) => void;
}

/**
 * Creates a test logger with a specific component name
 * @param componentName - Name of the test component for logging context
 * @returns TestLogger instance
 */
export const createTestLogger = (componentName: string): TestLogger => {
  const formatMessage = (level: string, message: string): string => {
    return `[${componentName}] ${new Date().toISOString()} - ${level}: ${message}`;
  };

  return {
    info: (message: string) => console.log(formatMessage('INFO', message)),
    error: (message: string) => console.error(formatMessage('ERROR', message)),
    warn: (message: string) => console.warn(formatMessage('WARN', message)),
    debug: (message: string) => console.debug(formatMessage('DEBUG', message)),
  };
};

/**
 * Default test logger for general use
 */
export const testLogger = createTestLogger('TestRunner');
