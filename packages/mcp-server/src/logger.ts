import { ErrorCode } from './types.js';
import winston from 'winston';
import path from 'path';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  toolName?: string;
  error?: string;
  [key: string]: any;
}

class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, context));
    }
  }

  // Method to log errors with specific error codes
  logError(code: ErrorCode, message: string, context?: LogContext): void {
    this.error(`[${code}] ${message}`, context);
  }
}

// Export both the class and singleton instance
export { Logger };
export const logger = Logger.getInstance();

// Communication logger for frontend-backend communication
const commLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.printf((info: any) => {
      const { timestamp, level, message, ...meta } = info;
      const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'communication.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3
    })
  ]
});

// Helper function to log communication events
export const logComm = {
  userRequest: (input: string): void => {
    commLogger.info('📥 USER REQUEST', { input });
  },

  aiMessage: (content: string, metadata?: any): void => {
    commLogger.info('🤖 AI MESSAGE', { content, metadata });
  },

  toolCall: (toolName: string, args: any, toolCallId: string): void => {
    commLogger.info('🔧 TOOL CALL', { toolName, args, toolCallId });
  },

  toolResult: (toolCallId: string, success: boolean, result: any, error?: string): void => {
    commLogger.info('✅ TOOL RESULT', { toolCallId, success, result, error });
  },

  frontendExecution: (type: 'query' | 'operation', id: string, code: string, validate?: string): void => {
    commLogger.info('⚡ FRONTEND EXECUTION', {
      type,
      id,
      code: code.length > 200 ? code.substring(0, 200) + '...' : code,
      fullCode: code,
      validate
    });
  },

  frontendResult: (type: 'query' | 'operation', id: string, success: boolean, result: any, error?: string): void => {
    commLogger.info('📤 FRONTEND RESULT', { type, id, success, result, error });
  },

  error: (context: string, error: string, details?: any): void => {
    commLogger.error('❌ ERROR', { context, error, details });
  }
};