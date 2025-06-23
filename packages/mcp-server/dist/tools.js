"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPTools = void 0;
const context7_client_js_1 = require("./context7-client.js");
const config_js_1 = require("./config.js");
// Simple UUID generator
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
class MCPTools {
    constructor() {
        this.wsClients = new Set();
        this.context7Client = new context7_client_js_1.Context7Client();
    }
    addWSClient(client) {
        this.wsClients.add(client);
    }
    removeWSClient(client) {
        this.wsClients.delete(client);
    }
    broadcastToClients(message) {
        this.wsClients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify(message));
            }
        });
    }
    async executeQueryOnFrontend(query) {
        return new Promise((resolve, reject) => {
            const queryId = generateId();
            const pendingClients = new Set();
            // Set timeout with proper cleanup
            const timeout = setTimeout(() => {
                // Clean up all listeners
                pendingClients.forEach(client => {
                    if (client.readyState === 1) {
                        client.removeListener('message', responseHandler);
                    }
                });
                pendingClients.clear();
                reject(new Error(`Query ${query.id} timed out after 10 seconds`));
            }, 10000);
            // Create response handler with proper cleanup
            const responseHandler = (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'query_response' && data.queryId === queryId) {
                        clearTimeout(timeout);
                        // Clean up all listeners
                        pendingClients.forEach(client => {
                            if (client.readyState === 1) {
                                client.removeListener('message', responseHandler);
                            }
                        });
                        pendingClients.clear();
                        if (data.success) {
                            resolve({
                                queryId: query.id,
                                result: data.result,
                                timestamp: Date.now()
                            });
                        }
                        else {
                            reject(new Error(data.error || 'Query execution failed'));
                        }
                    }
                }
                catch (err) {
                    // Ignore parse errors for non-JSON messages
                }
            };
            // Send query to connected clients
            let messageSent = false;
            this.wsClients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: 'execute_query',
                        queryId,
                        query
                    }));
                    // Add temporary message listener
                    client.on('message', responseHandler);
                    pendingClients.add(client);
                    messageSent = true;
                }
            });
            if (!messageSent) {
                clearTimeout(timeout);
                reject(new Error('No frontend clients connected'));
            }
        });
    }
    async executeOperationOnFrontend(code, description) {
        // Validate code before execution
        if (!this.isCodeSafe(code)) {
            throw new Error('Code contains potentially dangerous operations');
        }
        return new Promise((resolve, reject) => {
            const operationId = generateId();
            const pendingClients = new Set();
            // Set timeout with proper cleanup
            const timeout = setTimeout(() => {
                // Clean up all listeners
                pendingClients.forEach(client => {
                    if (client.readyState === 1) {
                        client.removeListener('message', responseHandler);
                    }
                });
                pendingClients.clear();
                reject(new Error(`Operation timed out after 15 seconds`));
            }, 15000);
            // Create response handler with proper cleanup
            const responseHandler = (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'operation_response' && data.operationId === operationId) {
                        clearTimeout(timeout);
                        // Clean up all listeners
                        pendingClients.forEach(client => {
                            if (client.readyState === 1) {
                                client.removeListener('message', responseHandler);
                            }
                        });
                        pendingClients.clear();
                        if (data.success) {
                            resolve({
                                commandId: operationId,
                                executionTime: Date.now(),
                                affectedElements: data.affectedElements || [],
                                result: data.result
                            });
                        }
                        else {
                            reject(new Error(data.error || 'Operation execution failed'));
                        }
                    }
                }
                catch (err) {
                    // Ignore parse errors for non-JSON messages
                }
            };
            // Send operation to connected clients
            let messageSent = false;
            this.wsClients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: 'execute_operation',
                        operationId,
                        code,
                        description
                    }));
                    // Add temporary message listener
                    client.on('message', responseHandler);
                    pendingClients.add(client);
                    messageSent = true;
                }
            });
            if (!messageSent) {
                clearTimeout(timeout);
                reject(new Error('No frontend clients connected'));
            }
        });
    }
    isCodeSafe(code) {
        // Check code length using config
        if (code.length > config_js_1.config.security.maxCodeLength) {
            return false;
        }
        // Check for dangerous patterns using config
        for (const pattern of config_js_1.config.security.blockedPatterns) {
            if (pattern.test(code)) {
                return false;
            }
        }
        // Check for at least one allowed pattern (optional validation)
        const hasAllowedPattern = config_js_1.config.security.allowedPatterns.some(pattern => pattern.test(code));
        // For SpreadJS operations, we expect at least some valid patterns
        if (code.length > 50 && !hasAllowedPattern) {
            return false;
        }
        return true;
    }
    createMCPError(code, message, details) {
        return {
            code,
            message,
            details,
            timestamp: Date.now()
        };
    }
    getToolDefinitions() {
        return [
            {
                name: 'query_context7',
                description: 'Query Context7 to get SpreadJS API documentation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: { type: 'string' },
                        maxTokens: { type: 'number' }
                    },
                    required: ['topic']
                }
            },
            {
                name: 'execute_spreadjs_queries',
                description: 'Execute read-only SpreadJS queries',
                inputSchema: {
                    type: 'object',
                    properties: {
                        queries: { type: 'array' }
                    },
                    required: ['queries']
                }
            },
            {
                name: 'execute_spreadjs_operations',
                description: 'Execute SpreadJS operations',
                inputSchema: {
                    type: 'object',
                    properties: {
                        code: { type: 'string' },
                        description: { type: 'string' }
                    },
                    required: ['code', 'description']
                }
            },
            {
                name: 'validate_user_intent',
                description: 'Validate execution results against user intent for Agent self-verification',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userRequest: {
                            type: 'string',
                            description: 'Original user request'
                        },
                        executedCode: {
                            type: 'string',
                            description: 'Code that was executed'
                        },
                        stateDiff: {
                            type: 'object',
                            description: 'State comparison result'
                        },
                        expectedOutcome: {
                            type: 'string',
                            description: 'AI understanding of expected result',
                            default: ''
                        }
                    },
                    required: ['userRequest', 'executedCode', 'stateDiff']
                }
            }
        ];
    }
    async queryContext7(args) {
        const id = generateId();
        const startTime = Date.now();
        this.broadcastToClients({
            type: 'tool_call',
            data: { id, name: 'query_context7', status: 'pending', args },
            timestamp: startTime,
            id: generateId()
        });
        try {
            const result = await this.context7Client.querySpreadJSDocumentation(args.topic, args.maxTokens || 10000);
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'query_context7', status: 'success', result },
                timestamp: Date.now(),
                id: generateId()
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'query_context7', status: 'error', error: errorMessage },
                timestamp: Date.now(),
                id: generateId()
            });
            throw error;
        }
    }
    async executeSpreadJSQueries(args) {
        const id = generateId();
        const startTime = Date.now();
        this.broadcastToClients({
            type: 'tool_call',
            data: { id, name: 'execute_spreadjs_queries', status: 'pending', args },
            timestamp: startTime,
            id: generateId()
        });
        try {
            const results = {};
            const errors = [];
            for (const query of args.queries) {
                try {
                    // Execute real query on frontend via WebSocket
                    const queryResult = await this.executeQueryOnFrontend(query);
                    results[query.resultKey] = queryResult;
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Error in query ${query.id}: ${errorMessage}`);
                }
            }
            const response = {
                success: errors.length === 0,
                results,
                metadata: {
                    executionTime: Date.now() - startTime,
                    queryCount: args.queries.length,
                    errors
                }
            };
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'execute_spreadjs_queries', status: 'success', result: response },
                timestamp: Date.now(),
                id: generateId()
            });
            return response;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'execute_spreadjs_queries', status: 'error', error: errorMessage },
                timestamp: Date.now(),
                id: generateId()
            });
            throw error;
        }
    }
    async executeSpreadJSOperations(args) {
        const id = generateId();
        const startTime = Date.now();
        this.broadcastToClients({
            type: 'tool_call',
            data: { id, name: 'execute_spreadjs_operations', status: 'pending', args },
            timestamp: startTime,
            id: generateId()
        });
        this.broadcastToClients({
            type: 'code_generated',
            data: { code: args.code, description: args.description, timestamp: Date.now() },
            timestamp: Date.now(),
            id: generateId()
        });
        try {
            // Execute real operation on frontend via WebSocket
            const operationResult = await this.executeOperationOnFrontend(args.code, args.description);
            const response = {
                success: true,
                result: operationResult
            };
            this.broadcastToClients({
                type: 'execution_result',
                data: response,
                timestamp: Date.now(),
                id: generateId()
            });
            return response;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.broadcastToClients({
                type: 'error',
                data: { error: errorMessage },
                timestamp: Date.now(),
                id: generateId()
            });
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    async validateUserIntent(args) {
        const id = generateId();
        const startTime = Date.now();
        this.broadcastToClients({
            type: 'tool_call',
            data: { id, name: 'validate_user_intent', status: 'pending', args },
            timestamp: startTime,
            id: generateId()
        });
        try {
            // Perform intelligent validation analysis
            const validation = this.performIntentValidation(args.userRequest, args.executedCode, args.stateDiff, args.expectedOutcome);
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'validate_user_intent', status: 'success', result: validation },
                timestamp: Date.now(),
                id: generateId()
            });
            return validation;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'validate_user_intent', status: 'error', error: errorMessage },
                timestamp: Date.now(),
                id: generateId()
            });
            throw error;
        }
    }
    performIntentValidation(userRequest, executedCode, stateDiff, expectedOutcome) {
        try {
            // Analyze user request to understand intent
            const intentAnalysis = this.analyzeUserIntent(userRequest);
            // Check if query results indicate successful execution
            const executionCheck = this.checkExecutionSuccess(intentAnalysis, stateDiff);
            // Determine validation result based on targeted query results
            const validationResult = {
                success: executionCheck.isSuccessful,
                confidence: executionCheck.confidence,
                analysis: {
                    userIntent: intentAnalysis,
                    queryResults: stateDiff,
                    executionCheck: executionCheck.details
                },
                recommendations: executionCheck.isSuccessful ? [] : this.generateExecutionRecommendations(intentAnalysis, stateDiff)
            };
            return validationResult;
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Validation failed',
                confidence: 0
            };
        }
    }
    analyzeUserIntent(userRequest) {
        // Simple intent analysis - in production, this would be more sophisticated
        const intent = {
            action: 'unknown',
            target: 'unknown',
            parameters: {}
        };
        const request = userRequest.toLowerCase();
        // Basic intent recognition patterns
        if (request.includes('set') || request.includes('设置')) {
            intent.action = 'setValue';
            intent.target = 'cell';
        }
        else if (request.includes('format') || request.includes('格式')) {
            intent.action = 'format';
            intent.target = 'cell';
        }
        else if (request.includes('delete') || request.includes('删除')) {
            intent.action = 'delete';
        }
        else if (request.includes('insert') || request.includes('插入')) {
            intent.action = 'insert';
        }
        return intent;
    }
    checkExecutionSuccess(intent, queryResults) {
        const executionCheck = {
            isSuccessful: false,
            confidence: 0,
            details: []
        };
        try {
            // Check if we have valid query results
            if (!queryResults || !queryResults.success) {
                executionCheck.details.push('Query execution failed');
                executionCheck.confidence = 10;
                return executionCheck;
            }
            const results = queryResults.results || {};
            // Check based on intent and available query results
            switch (intent.action) {
                case 'setValue':
                    // Look for evidence of value changes in query results
                    const hasValueChanges = this.checkForValueChanges(results, intent);
                    if (hasValueChanges) {
                        executionCheck.isSuccessful = true;
                        executionCheck.confidence = 85;
                        executionCheck.details.push('Value changes detected in query results');
                    }
                    else {
                        executionCheck.details.push('No value changes detected');
                        executionCheck.confidence = 20;
                    }
                    break;
                case 'format':
                    // Look for formatting changes in query results
                    const hasFormatChanges = this.checkForFormatChanges(results, intent);
                    if (hasFormatChanges) {
                        executionCheck.isSuccessful = true;
                        executionCheck.confidence = 85;
                        executionCheck.details.push('Format changes detected in query results');
                    }
                    else {
                        executionCheck.details.push('No format changes detected');
                        executionCheck.confidence = 20;
                    }
                    break;
                default:
                    // Generic check - if we got any meaningful results, consider it partially successful
                    if (Object.keys(results).length > 0) {
                        executionCheck.isSuccessful = true;
                        executionCheck.confidence = 60;
                        executionCheck.details.push('Query returned results, execution likely successful');
                    }
            }
        }
        catch (error) {
            executionCheck.details.push('Error during execution check');
            executionCheck.confidence = 0;
        }
        return executionCheck;
    }
    checkForValueChanges(results, intent) {
        // Check if query results indicate value changes
        for (const key in results) {
            const result = results[key];
            if (result && typeof result === 'object') {
                // Look for before/after patterns or changed values
                if (result.value !== undefined || result.cell !== undefined) {
                    return true;
                }
            }
        }
        return false;
    }
    checkForFormatChanges(results, intent) {
        // Check if query results indicate format changes
        for (const key in results) {
            const result = results[key];
            if (result && typeof result === 'object') {
                // Look for format or style changes
                if (result.format !== undefined || result.style !== undefined) {
                    return true;
                }
            }
        }
        return false;
    }
    generateExecutionRecommendations(intent, queryResults) {
        const recommendations = [];
        if (!queryResults || !queryResults.success) {
            recommendations.push('Query execution failed. Check frontend connection and code syntax.');
            return recommendations;
        }
        const results = queryResults.results || {};
        if (Object.keys(results).length === 0) {
            recommendations.push('No query results returned. Verify query code is generating return values.');
        }
        if (intent.action === 'setValue' && !this.checkForValueChanges(results, intent)) {
            recommendations.push('Expected value changes but none detected in query results. Check if setValue operation succeeded.');
        }
        if (intent.action === 'format' && !this.checkForFormatChanges(results, intent)) {
            recommendations.push('Expected format changes but none detected in query results. Check if formatting operation succeeded.');
        }
        return recommendations;
    }
}
exports.MCPTools = MCPTools;
