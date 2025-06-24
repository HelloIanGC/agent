import { Logger as BaseLogger } from '../logger.js';

/**
 * 改进的日志工具 - 替换分散的console.log
 */
export class DevLogger {
  private static instance: DevLogger;
  private baseLogger: BaseLogger;
  private isDevelopment: boolean;

  private constructor() {
    this.baseLogger = BaseLogger.getInstance();
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
  public aiDecision(message: string, context?: any, requestId?: string): void {
    if (this.isDevelopment) {
      this.baseLogger.info(`[AI Decision] ${message}`, context, requestId);
    }
  }

  /**
   * Context7操作日志
   */
  public context7(message: string, context?: any, requestId?: string): void {
    if (this.isDevelopment) {
      this.baseLogger.info(`[Context7] ${message}`, context, requestId);
    }
  }

  /**
   * WebSocket操作日志
   */
  public websocket(message: string, context?: any, requestId?: string): void {
    if (this.isDevelopment) {
      this.baseLogger.info(`[WebSocket] ${message}`, context, requestId);
    }
  }

  /**
   * 代码生成日志
   */
  public codeGeneration(message: string, context?: any, requestId?: string): void {
    if (this.isDevelopment) {
      this.baseLogger.info(`[Code Gen] ${message}`, context, requestId);
    }
  }

  /**
   * 执行结果日志
   */
  public execution(message: string, context?: any, requestId?: string): void {
    if (this.isDevelopment) {
      this.baseLogger.info(`[Execution] ${message}`, context, requestId);
    }
  }

  /**
   * 调试日志（仅开发环境）
   */
  public debug(message: string, context?: any, requestId?: string): void {
    if (this.isDevelopment) {
      this.baseLogger.debug(message, context, requestId);
    }
  }

  /**
   * 警告日志
   */
  public warn(message: string, context?: any, requestId?: string): void {
    this.baseLogger.warn(message, context, requestId);
  }

  /**
   * 错误日志
   */
  public error(message: string, context?: any, error?: Error, requestId?: string): void {
    this.baseLogger.error(message, context, error, requestId);
  }

  /**
   * 性能日志
   */
  public performance(operation: string, duration: number, context?: any, requestId?: string): void {
    if (this.isDevelopment) {
      this.baseLogger.performanceLog(operation, duration, context, requestId);
    }
  }

  /**
   * 替换console.log的便捷方法
   */
  public log(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      this.baseLogger.info(message, args.length > 0 ? args : undefined);
    }
  }
}