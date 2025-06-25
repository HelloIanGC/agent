import { logger } from '../logger.js';

/**
 * 改进的日志工具 - 替换分散的console.log
 */
export class DevLogger {
  private static instance: DevLogger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  public static getInstance(): DevLogger {
    if (!DevLogger.instance) {
      DevLogger.instance = new DevLogger();
    }
    return DevLogger.instance;
  }

  /**
   * AI决策日志
   */
  public aiDecision(message: string, context?: any): void {
    if (this.isDevelopment) {
      logger.info(`[AI Decision] ${message}`, context);
    }
  }

  /**
   * Context7操作日志
   */
  public context7(message: string, context?: any): void {
    if (this.isDevelopment) {
      logger.info(`[Context7] ${message}`, context);
    }
  }

  /**
   * WebSocket操作日志
   */
  public websocket(message: string, context?: any): void {
    if (this.isDevelopment) {
      logger.info(`[WebSocket] ${message}`, context);
    }
  }

  /**
   * 代码生成日志
   */
  public codeGeneration(message: string, context?: any): void {
    if (this.isDevelopment) {
      logger.info(`[Code Gen] ${message}`, context);
    }
  }

  /**
   * 执行结果日志
   */
  public execution(message: string, context?: any): void {
    if (this.isDevelopment) {
      logger.info(`[Execution] ${message}`, context);
    }
  }

  /**
   * 调试日志（仅开发环境）
   */
  public debug(message: string, context?: any): void {
    if (this.isDevelopment) {
      logger.debug(message, context);
    }
  }

  /**
   * 警告日志
   */
  public warn(message: string, context?: any): void {
    logger.warn(message, context);
  }

  /**
   * 错误日志
   */
  public error(message: string, context?: any, error?: Error): void {
    const errorContext = error ? { ...context, error: error.message, stack: error.stack } : context;
    logger.error(message, errorContext);
  }

  /**
   * 性能日志
   */
  public performance(operation: string, duration: number, context?: any): void {
    if (this.isDevelopment) {
      logger.info(`[Performance] ${operation} took ${duration}ms`, context);
    }
  }

  /**
   * 替换console.log的便捷方法
   */
  public log(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      logger.info(message, args.length > 0 ? { args } : undefined);
    }
  }
}