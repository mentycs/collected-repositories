/**
 * Defines the available log levels.
 */
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Maps string log level names to their numeric values.
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  ERROR: LogLevel.ERROR,
  WARN: LogLevel.WARN,
  INFO: LogLevel.INFO,
  DEBUG: LogLevel.DEBUG,
};

/**
 * Gets the log level from environment variable or returns default.
 */
function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  return envLevel && envLevel in LOG_LEVEL_MAP ? LOG_LEVEL_MAP[envLevel] : LogLevel.INFO;
}

let currentLogLevel: LogLevel = getLogLevelFromEnv();

/**
 * Sets the current logging level for the application.
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Provides logging functionalities with level control.
 */
export const logger = {
  /**
   * Logs a debug message if the current log level is DEBUG or higher.
   * @param message - The message to log.
   */
  debug: (message: string) => {
    if (currentLogLevel >= LogLevel.DEBUG && !process.env.VITEST_WORKER_ID) {
      console.debug(message);
    }
  },
  /**
   * Logs an info message if the current log level is INFO or higher.
   * @param message - The message to log.
   */
  info: (message: string) => {
    if (currentLogLevel >= LogLevel.INFO && !process.env.VITEST_WORKER_ID) {
      console.log(message); // Using console.log for INFO
    }
  },
  /**
   * Logs a warning message if the current log level is WARN or higher.
   * @param message - The message to log.
   */
  warn: (message: string) => {
    if (currentLogLevel >= LogLevel.WARN && !process.env.VITEST_WORKER_ID) {
      console.warn(message);
    }
  },
  /**
   * Logs an error message if the current log level is ERROR or higher (always logs).
   * @param message - The message to log.
   */
  error: (message: string) => {
    if (currentLogLevel >= LogLevel.ERROR && !process.env.VITEST_WORKER_ID) {
      console.error(message);
    }
  },
};
