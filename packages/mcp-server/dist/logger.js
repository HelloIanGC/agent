"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
const config_js_1 = require("./config.js");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.logLevel = this.parseLogLevel(config_js_1.config.server.logLevel);
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    parseLogLevel(level) {
        switch (level.toLowerCase()) {
            case 'error': return LogLevel.ERROR;
            case 'warn': return LogLevel.WARN;
            case 'info': return LogLevel.INFO;
            case 'debug': return LogLevel.DEBUG;
            default: return LogLevel.INFO;
        }
    }
    formatLog(entry) {
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
    log(level, message, context, error, requestId, userId) {
        if (level <= this.logLevel) {
            const entry = {
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
    error(message, context, error, requestId, userId) {
        this.log(LogLevel.ERROR, message, context, error, requestId, userId);
    }
    warn(message, context, requestId, userId) {
        this.log(LogLevel.WARN, message, context, undefined, requestId, userId);
    }
    info(message, context, requestId, userId) {
        this.log(LogLevel.INFO, message, context, undefined, requestId, userId);
    }
    debug(message, context, requestId, userId) {
        this.log(LogLevel.DEBUG, message, context, undefined, requestId, userId);
    }
    // Specific logging methods for common scenarios
    toolCall(toolName, status, context, requestId) {
        const message = `Tool ${toolName} ${status}`;
        if (status === 'error') {
            this.error(message, context, undefined, requestId);
        }
        else {
            this.info(message, context, requestId);
        }
    }
    websocketEvent(event, clientId, context) {
        this.debug(`WebSocket ${event}`, { ...context, clientId });
    }
    securityEvent(event, details, requestId) {
        this.warn(`Security event: ${event}`, details, requestId);
    }
    performanceLog(operation, duration, context, requestId) {
        this.info(`Performance: ${operation} took ${duration}ms`, context, requestId);
    }
}
exports.Logger = Logger;
// Export singleton instance
exports.logger = Logger.getInstance();
