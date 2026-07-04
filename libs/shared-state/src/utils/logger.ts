import envConfig from '../../../../runtime-config';

/**
 * Log levels for different types of messages
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SENSITIVE = 'SENSITIVE', // For sensitive information that should only show in debug mode
}

/**
 * Color mappings for different log levels in browser console
 */
const LOG_COLORS = {
  [LogLevel.DEBUG]: '#6B7280', // Gray
  [LogLevel.INFO]: '#3B82F6', // Blue
  [LogLevel.WARN]: '#F59E0B', // Yellow
  [LogLevel.ERROR]: '#EF4444', // Red
  [LogLevel.SENSITIVE]: '#8B5CF6', // Purple
};

/**
 * Interface for log context/metadata
 */
export interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

/**
 * Timestamp format options
 */
export enum TimestampFormat {
  ISO = 'iso', // 2025-10-28T14:30:45.123Z
  LOCAL = 'local', // 2025-10-28 14:30:45.123
  TIME_ONLY = 'time', // 14:30:45.123
  RELATIVE = 'relative', // +1.234s (relative to logger creation)
}

/**
 * Centralized Logger Class
 * Controls console logging based on debug configuration flag
 */
class Logger {
  private isDebugEnabled: boolean = false;
  private context: LogContext = {};
  private timestampFormat: TimestampFormat = TimestampFormat.LOCAL;
  private startTime: number = Date.now();

  constructor(timestampFormat: TimestampFormat = TimestampFormat.LOCAL) {
    this.timestampFormat = timestampFormat;
    this.updateDebugState();
  }

  /**
   * Update debug state from runtime configuration
   */
  private updateDebugState(): void {
    try {
      const config = envConfig();
      this.isDebugEnabled = config.DEBUG || false;
    } catch (error) {
      // Fallback to false if config is not available
      this.isDebugEnabled = false;
    }
  }

  /**
   * Set global context that will be included in all log messages
   */
  public setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear specific context keys or all context
   */
  public clearContext(keys?: string[]): void {
    if (keys) {
      keys.forEach((key) => delete this.context[key]);
    } else {
      this.context = {};
    }
  }

  /**
   * Generate formatted timestamp based on configured format
   */
  private getTimestamp(): string {
    const now = new Date();

    switch (this.timestampFormat) {
      case TimestampFormat.ISO:
        return now.toISOString();

      case TimestampFormat.LOCAL: {
        // Format: 2025-10-28 14:30:45.123
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
      }

      case TimestampFormat.TIME_ONLY: {
        // Format: 14:30:45.123
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
      }

      case TimestampFormat.RELATIVE: {
        // Format: +1.234s (relative to logger creation)
        const elapsed = (Date.now() - this.startTime) / 1000;
        return `+${elapsed.toFixed(3)}s`;
      }

      default:
        return now.toISOString();
    }
  }

  /**
   * Format log message with timestamp, level, and context
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.getTimestamp();
    const combinedContext = { ...this.context, ...context };
    const contextStr =
      Object.keys(combinedContext).length > 0
        ? ` | Context: ${JSON.stringify(combinedContext)}`
        : '';

    return `[${timestamp}] [${level}]${contextStr} ${message}`;
  }

  /**
   * Check if a log should be shown based on level and debug settings
   */
  private shouldLog(level: LogLevel): boolean {
    // Always show ERROR and WARN messages
    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      return true;
    }

    // Show INFO, DEBUG and SENSITIVE messages only if debug is enabled
    if (
      level === LogLevel.INFO ||
      level === LogLevel.DEBUG ||
      level === LogLevel.SENSITIVE
    ) {
      return this.isDebugEnabled;
    }

    return false;
  }

  /**
   * Get the appropriate console method based on log level
   */
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.DEBUG:
      case LogLevel.SENSITIVE:
      default:
        return console.log;
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, context?: LogContext): void {
    // Refresh debug state each time (in case config changed)
    this.updateDebugState();

    if (!this.shouldLog(level)) {
      return;
    }

    const consoleMethod = this.getConsoleMethod(level);
    const formattedMessage = this.formatMessage(level, message, context);
    const color = LOG_COLORS[level];

    if (data !== undefined) {
      consoleMethod(`%c${formattedMessage}`, `color: ${color}; font-weight: bold;`, data);
    } else {
      consoleMethod(`%c${formattedMessage}`, `color: ${color}; font-weight: bold;`);
    }
  }

  /**
   * Debug level logging - only shows when DEBUG flag is true
   */
  public debug(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  /**
   * Info level logging - shows by default
   */
  public info(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  /**
   * Warning level logging - always shows
   */
  public warn(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  /**
   * Error level logging - always shows
   */
  public error(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  /**
   * Sensitive logging - only shows when DEBUG flag is true
   * Use this for logging sensitive information like API keys, passwords, etc.
   */
  public sensitive(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.SENSITIVE, message, data, context);
  }

  /**
   * Set timestamp format for this logger
   */
  public setTimestampFormat(format: TimestampFormat): void {
    this.timestampFormat = format;
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: LogContext): Logger {
    const childLogger = new Logger(this.timestampFormat);
    childLogger.setContext({ ...this.context, ...context });
    childLogger.startTime = this.startTime; // Inherit start time for relative timestamps
    return childLogger;
  }

  /**
   * Get current debug state
   */
  public get debugEnabled(): boolean {
    this.updateDebugState();
    return this.isDebugEnabled;
  }
}

// Create and export singleton instance
export const logger = new Logger();

// Export Logger class for creating child loggers if needed
export { Logger };

// Convenience exports for common usage patterns
export const createComponentLogger = (
  componentName: string,
  timestampFormat?: TimestampFormat
): Logger => {
  const childLogger = logger.child({ component: componentName });
  if (timestampFormat) {
    childLogger.setTimestampFormat(timestampFormat);
  }
  return childLogger;
};

export const createActionLogger = (
  action: string,
  component?: string,
  timestampFormat?: TimestampFormat
): Logger => {
  const childLogger = logger.child({ action, component });
  if (timestampFormat) {
    childLogger.setTimestampFormat(timestampFormat);
  }
  return childLogger;
};

// Create loggers with specific timestamp formats
export const createRelativeLogger = (context: LogContext = {}): Logger => {
  const relativeLogger = new Logger(TimestampFormat.RELATIVE);
  relativeLogger.setContext(context);
  return relativeLogger;
};

export const createTimeOnlyLogger = (context: LogContext = {}): Logger => {
  const timeLogger = new Logger(TimestampFormat.TIME_ONLY);
  timeLogger.setContext(context);
  return timeLogger;
};

export const createISOLogger = (context: LogContext = {}): Logger => {
  const isoLogger = new Logger(TimestampFormat.ISO);
  isoLogger.setContext(context);
  return isoLogger;
};

// Legacy console.log replacement - gradually replace these
export const debugLog = (message: string, data?: any): void => {
  logger.debug(message, data);
};

export const sensitiveLog = (message: string, data?: any): void => {
  logger.sensitive(message, data);
};
