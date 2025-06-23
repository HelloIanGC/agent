import { config } from './config.js';
import { ErrorCode } from './types.js';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  error?: Error;
  userId?: string;
  requestId?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    this.logLevel = this.parseLogLevel(config.server.logLevel);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private formatLog(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = LogLevel[entry.level];
    const message = entry.message;

    let logString = `[${timestamp}] ${level}: ${message}`;

    if (entry.requestId) {
      logString += ` [RequestID: ${entry.requestId}]`;
    }

    if (entry.userId) {
      logString += ` [UserID: ${entry.userId}]`;
    }

    if (entry.context) {
      logString += ` Context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      logString += `\nError: ${entry.error.message}\nStack: ${entry.error.stack}`;
    }

    return logString;
  }

  private log(level: LogLevel, message: string, context?: any, error?: Error, requestId?: string, userId?: string): void {
    if (level <= this.logLevel) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        error,
        requestId,
        userId
      };

      const logString = this.formatLog(entry);

      switch (level) {
        case LogLevel.ERROR:
          console.error(logString);
          break;
        case LogLevel.WARN:
          console.warn(logString);
          break;
        case LogLevel.INFO:
          console.info(logString);
          break;
        case LogLevel.DEBUG:
          console.debug(logString);
          break;
      }
    }
  }

  public error(message: string, context?: any, error?: Error, requestId?: string, userId?: string): void {
    this.log(LogLevel.ERROR, message, context, error, requestId, userId);
  }

  public warn(message: string, context?: any, requestId?: string, userId?: string): void {
    this.log(LogLevel.WARN, message, context, undefined, requestId, userId);
  }

  public info(message: string, context?: any, requestId?: string, userId?: string): void {
    this.log(LogLevel.INFO, message, context, undefined, requestId, userId);
  }

  public debug(message: string, context?: any, requestId?: string, userId?: string): void {
    this.log(LogLevel.DEBUG, message, context, undefined, requestId, userId);
  }

  // Specific logging methods for common scenarios
  public toolCall(toolName: string, status: 'start' | 'success' | 'error', context?: any, requestId?: string): void {
    const message = `Tool ${toolName} ${status}`;
    if (status === 'error') {
      this.error(message, context, undefined, requestId);
    } else {
      this.info(message, context, requestId);
    }
  }

  public websocketEvent(event: string, clientId?: string, context?: any): void {
    this.debug(`WebSocket ${event}`, { ...context, clientId });
  }

  public securityEvent(event: string, details: any, requestId?: string): void {
    this.warn(`Security event: ${event}`, details, requestId);
  }

  public performanceLog(operation: string, duration: number, context?: any, requestId?: string): void {
    this.info(`Performance: ${operation} took ${duration}ms`, context, requestId);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();