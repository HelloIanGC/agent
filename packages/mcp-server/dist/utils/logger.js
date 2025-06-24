import { Logger as BaseLogger } from '../logger.js';
/**
 * 改进的日志工具 - 替换分散的console.log
 */
export class DevLogger {
    constructor() {
        this.baseLogger = BaseLogger.getInstance();
        this.isDevelopment = process.env.NODE_ENV === 'development';
    }
    static getInstance() {
        if (!DevLogger.instance) {
            DevLogger.instance = new DevLogger();
        }
        return DevLogger.instance;
    }
    /**
     * AI决策日志
     */
    aiDecision(message, context, requestId) {
        if (this.isDevelopment) {
            this.baseLogger.info(`[AI Decision] ${message}`, context, requestId);
        }
    }
    /**
     * Context7操作日志
     */
    context7(message, context, requestId) {
        if (this.isDevelopment) {
            this.baseLogger.info(`[Context7] ${message}`, context, requestId);
        }
    }
    /**
     * WebSocket操作日志
     */
    websocket(message, context, requestId) {
        if (this.isDevelopment) {
            this.baseLogger.info(`[WebSocket] ${message}`, context, requestId);
        }
    }
    /**
     * 代码生成日志
     */
    codeGeneration(message, context, requestId) {
        if (this.isDevelopment) {
            this.baseLogger.info(`[Code Gen] ${message}`, context, requestId);
        }
    }
    /**
     * 执行结果日志
     */
    execution(message, context, requestId) {
        if (this.isDevelopment) {
            this.baseLogger.info(`[Execution] ${message}`, context, requestId);
        }
    }
    /**
     * 调试日志（仅开发环境）
     */
    debug(message, context, requestId) {
        if (this.isDevelopment) {
            this.baseLogger.debug(message, context, requestId);
        }
    }
    /**
     * 警告日志
     */
    warn(message, context, requestId) {
        this.baseLogger.warn(message, context, requestId);
    }
    /**
     * 错误日志
     */
    error(message, context, error, requestId) {
        this.baseLogger.error(message, context, error, requestId);
    }
    /**
     * 性能日志
     */
    performance(operation, duration, context, requestId) {
        if (this.isDevelopment) {
            this.baseLogger.performanceLog(operation, duration, context, requestId);
        }
    }
    /**
     * 替换console.log的便捷方法
     */
    log(message, ...args) {
        if (this.isDevelopment) {
            this.baseLogger.info(message, args.length > 0 ? args : undefined);
        }
    }
}
