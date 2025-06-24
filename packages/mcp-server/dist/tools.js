import { Context7Client } from './context7-client.js';
import { config } from './config.js';
import { TIMEOUTS, ERROR_MESSAGES, LIMITS } from './utils/constants.js';
// Simple UUID generator
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
export class MCPTools {
    constructor() {
        this.wsClients = new Set();
        this.context7Client = new Context7Client();
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
            throw new Error(ERROR_MESSAGES.CODE_UNSAFE);
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
                reject(new Error(`${ERROR_MESSAGES.OPERATION_TIMEOUT} after ${TIMEOUTS.OPERATION_TIMEOUT}ms`));
            }, TIMEOUTS.OPERATION_TIMEOUT);
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
        // Check code length using constants
        if (code.length > LIMITS.MAX_CODE_LENGTH) {
            return false;
        }
        // Check for dangerous patterns using config
        for (const pattern of config.security.blockedPatterns) {
            if (pattern.test(code)) {
                return false;
            }
        }
        // Check for at least one allowed pattern (optional validation)
        const hasAllowedPattern = config.security.allowedPatterns.some(pattern => pattern.test(code));
        // For SpreadJS operations, we expect at least some valid patterns
        if (code.length > LIMITS.MIN_CODE_LENGTH_FOR_VALIDATION && !hasAllowedPattern) {
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
                description: 'Query Context7 to get SpreadJS API documentation when you need to understand how to use SpreadJS APIs',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: {
                            type: 'string',
                            description: 'What SpreadJS functionality you need help with (e.g., "add table", "cell formatting", "range operations")'
                        },
                        maxTokens: {
                            type: 'number',
                            description: 'Maximum tokens to retrieve (default: 5000)',
                            default: 5000
                        }
                    },
                    required: ['topic']
                }
            },
            {
                name: 'query_spreadjs',
                description: 'Query current SpreadJS state to understand what data exists and how things are configured',
                inputSchema: {
                    type: 'object',
                    properties: {
                        queries: {
                            type: 'array',
                            description: 'Array of JavaScript queries to execute on SpreadJS instance',
                            items: {
                                type: 'object',
                                properties: {
                                    code: {
                                        type: 'string',
                                        description: 'JavaScript code to get SpreadJS state (e.g., "spread.getActiveSheet().getRowCount()")'
                                    },
                                    description: {
                                        type: 'string',
                                        description: 'What this query is checking'
                                    },
                                    resultKey: {
                                        type: 'string',
                                        description: 'Key to store the result under'
                                    }
                                },
                                required: ['code', 'description', 'resultKey']
                            }
                        }
                    },
                    required: ['queries']
                }
            },
            {
                name: 'query_user',
                description: 'Ask the user a question when you need clarification about their requirements',
                inputSchema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The question you want to ask the user for clarification'
                        },
                        context: {
                            type: 'string',
                            description: 'Additional context about why you are asking this question',
                            default: ''
                        }
                    },
                    required: ['question']
                }
            },
            {
                name: 'execute_spreadjs',
                description: 'Execute SpreadJS operations to modify the spreadsheet',
                inputSchema: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'JavaScript code to execute on SpreadJS instance'
                        },
                        description: {
                            type: 'string',
                            description: 'What this operation does'
                        }
                    },
                    required: ['code', 'description']
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
    async querySpreadjs(args) {
        const id = generateId();
        const startTime = Date.now();
        this.broadcastToClients({
            type: 'tool_call',
            data: { id, name: 'query_spreadjs', status: 'pending', args },
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
                data: { id, name: 'query_spreadjs', status: 'success', result: response },
                timestamp: Date.now(),
                id: generateId()
            });
            return response;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'query_spreadjs', status: 'error', error: errorMessage },
                timestamp: Date.now(),
                id: generateId()
            });
            throw error;
        }
    }
    async queryUser(args) {
        const id = generateId();
        const startTime = Date.now();
        this.broadcastToClients({
            type: 'tool_call',
            data: { id, name: 'query_user', status: 'pending', args },
            timestamp: startTime,
            id: generateId()
        });
        try {
            // Send question to user via WebSocket and wait for response
            const userResponse = await this.askUserQuestion(args.question, args.context);
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'query_user', status: 'success', result: userResponse },
                timestamp: Date.now(),
                id: generateId()
            });
            return userResponse;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'query_user', status: 'error', error: errorMessage },
                timestamp: Date.now(),
                id: generateId()
            });
            throw error;
        }
    }
    async executeSpreadjs(args) {
        const id = generateId();
        const startTime = Date.now();
        this.broadcastToClients({
            type: 'tool_call',
            data: { id, name: 'execute_spreadjs', status: 'pending', args },
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
            let verificationResult;
            // Execute verification code if provided
            if (args.verificationCode) {
                try {
                    verificationResult = await this.executeOperationOnFrontend(args.verificationCode, `Verification for: ${args.description}`);
                }
                catch (verificationError) {
                    console.warn('Verification failed:', verificationError);
                    verificationResult = { error: 'Verification failed', details: verificationError };
                }
            }
            const response = {
                success: true,
                result: {
                    ...operationResult,
                    verification: verificationResult
                }
            };
            this.broadcastToClients({
                type: 'execution_result',
                data: response,
                timestamp: Date.now(),
                id: generateId()
            });
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'execute_spreadjs', status: 'success', result: response },
                timestamp: Date.now(),
                id: generateId()
            });
            return response;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.broadcastToClients({
                type: 'tool_call',
                data: { id, name: 'execute_spreadjs', status: 'error', error: errorMessage },
                timestamp: Date.now(),
                id: generateId()
            });
            throw error;
        }
    }
    async askUserQuestion(question, context) {
        return new Promise((resolve, reject) => {
            const questionId = generateId();
            // Set timeout for user response (5 minutes)
            const timeout = setTimeout(() => {
                reject(new Error('User response timeout after 5 minutes'));
            }, 300000);
            // Create response handler
            const responseHandler = (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'user_response' && data.questionId === questionId) {
                        clearTimeout(timeout);
                        // Clean up listeners
                        this.wsClients.forEach(client => {
                            if (client.readyState === 1) {
                                client.removeListener('message', responseHandler);
                            }
                        });
                        resolve({
                            question,
                            answer: data.answer,
                            timestamp: Date.now()
                        });
                    }
                }
                catch (err) {
                    // Ignore parse errors for non-JSON messages
                }
            };
            // Add response handler to all clients
            this.wsClients.forEach(client => {
                if (client.readyState === 1) {
                    client.on('message', responseHandler);
                }
            });
            // Send question to all connected clients
            const questionMessage = {
                id: generateId(),
                type: 'user_question',
                timestamp: Date.now(),
                data: {
                    questionId,
                    question,
                    context: context || '',
                    requiresResponse: true
                }
            };
            this.broadcastToClients(questionMessage);
            // If no clients connected, reject immediately
            if (this.wsClients.size === 0) {
                clearTimeout(timeout);
                reject(new Error('No clients connected to receive user question'));
            }
        });
    }
}
