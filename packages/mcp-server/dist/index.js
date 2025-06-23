"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const http_1 = require("http");
const tools_js_1 = require("./tools.js");
const config_js_1 = require("./config.js");
const logger_js_1 = require("./logger.js");
const ai_code_generator_js_1 = require("./ai-code-generator.js");
// Simple utility functions for the new protocol
const generateId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};
// Handle user requests in the new unified protocol
async function handleUserRequest(ws, message) {
    try {
        const { input, context } = message.data;
        // Send state update - agent is thinking
        ws.send(JSON.stringify({
            id: generateId(),
            type: 'state_update',
            timestamp: Date.now(),
            data: {
                agentStatus: 'thinking',
                currentTask: input
            }
        }));
        console.log('Processing user request:', input);
        // Step 1: Query Context7 for relevant documentation with more specific query
        const context7StartTime = Date.now();
        let context7Result;
        try {
            // Create more specific query for SpreadJS documentation
            const apiQuery = extractApiKeywords(input);
            const query = apiQuery.length > 0 ? `SpreadJS ${apiQuery.join(' ')}` : `SpreadJS setValue getActiveSheet selection`;
            context7Result = await mcpTools.queryContext7({
                topic: query,
                maxTokens: 5000
            });
            console.log('Context7 query completed:', context7Result.success, 'Documents:', context7Result.documents?.length || 0);
        }
        catch (error) {
            console.error('Context7 query failed:', error);
            context7Result = { success: false, error: error instanceof Error ? error.message : 'Context7 query failed' };
        }
        const context7Time = Date.now() - context7StartTime;
        // Step 2: Execute SpreadJS queries to get current state (with corrected API calls)
        const queryStartTime = Date.now();
        const contextQueries = [
            {
                id: generateId(),
                code: 'spread.getActiveSheet().name()',
                description: 'Get active sheet name',
                resultKey: 'activeSheetName'
            },
            {
                id: generateId(),
                code: 'spread.getActiveSheet().getSelections()',
                description: 'Get current selections',
                resultKey: 'selections'
            },
            {
                id: generateId(),
                code: 'spread.getActiveSheet().getRowCount()',
                description: 'Get row count',
                resultKey: 'rowCount'
            },
            {
                id: generateId(),
                code: 'spread.getActiveSheet().getColumnCount()',
                description: 'Get column count',
                resultKey: 'columnCount'
            }
        ];
        let queryResult;
        try {
            queryResult = await mcpTools.executeSpreadJSQueries({ queries: contextQueries });
            console.log('SpreadJS queries completed:', queryResult.success);
        }
        catch (error) {
            console.error('SpreadJS queries failed:', error);
            queryResult = { success: false, error: error instanceof Error ? error.message : 'SpreadJS queries failed' };
        }
        const queryTime = Date.now() - queryStartTime;
        // Step 3: Generate appropriate SpreadJS code using AI
        const codeGenStartTime = Date.now();
        const aiGenerationResult = await aiCodeGenerator.generateSpreadJSCode({
            userRequest: input,
            spreadjsContext: queryResult,
            documentationContext: context7Result
        });
        const generatedCode = aiGenerationResult.code;
        const codeGenTime = Date.now() - codeGenStartTime;
        console.log('AI Generated code:', generatedCode);
        console.log('AI Confidence:', aiGenerationResult.confidence);
        console.log('AI Explanation:', aiGenerationResult.explanation);
        // Step 4: Execute the generated operation
        const execStartTime = Date.now();
        let executionResult;
        try {
            executionResult = await mcpTools.executeSpreadJSOperations({
                code: generatedCode,
                description: `AI-generated operation: ${input}`
            });
            console.log('Operation execution completed:', executionResult.success);
        }
        catch (error) {
            console.error('Operation execution failed:', error);
            executionResult = { success: false, error: error instanceof Error ? error.message : 'Operation execution failed' };
        }
        const executionTime = Date.now() - execStartTime;
        const totalTime = context7Time + queryTime + codeGenTime + executionTime;
        if (executionResult.success) {
            // Send successful AI response
            ws.send(JSON.stringify({
                id: generateId(),
                type: 'ai_response',
                timestamp: Date.now(),
                data: {
                    response: `成功处理您的请求："${input}"。执行时间：${totalTime}ms`,
                    conversationId: message.id,
                    codeGenerated: generatedCode,
                    executionResult: {
                        success: true,
                        result: executionResult.result,
                        executionTime: totalTime
                    }
                }
            }));
            // Send execution steps as tool calls
            const toolCalls = [
                {
                    id: generateId(),
                    name: 'query_context7',
                    status: context7Result.success ? 'success' : 'error',
                    args: { topic: `SpreadJS ${input}` },
                    result: context7Result.success ? context7Result : undefined,
                    error: context7Result.success ? undefined : context7Result.error,
                    timestamp: Date.now() - totalTime + context7Time
                },
                {
                    id: generateId(),
                    name: 'execute_spreadjs_queries',
                    status: queryResult.success ? 'success' : 'error',
                    args: { queries: contextQueries.map(q => q.description) },
                    result: queryResult.success ? queryResult : undefined,
                    error: queryResult.success ? undefined : queryResult.error,
                    timestamp: Date.now() - totalTime + context7Time + queryTime
                },
                {
                    id: generateId(),
                    name: 'execute_spreadjs_operations',
                    status: executionResult.success ? 'success' : 'error',
                    args: { code: generatedCode, description: `AI-generated operation: ${input}` },
                    result: executionResult.success ? executionResult : undefined,
                    error: executionResult.success ? undefined : executionResult.error,
                    timestamp: Date.now() - executionTime
                }
            ];
            // Send final state update with real execution data
            ws.send(JSON.stringify({
                id: generateId(),
                type: 'state_update',
                timestamp: Date.now(),
                data: {
                    agentStatus: 'idle',
                    currentTask: undefined,
                    toolCalls: toolCalls,
                    generatedCode: [{
                            id: generateId(),
                            code: generatedCode,
                            description: `AI生成的操作: ${input}`,
                            language: 'javascript',
                            timestamp: Date.now()
                        }]
                }
            }));
        }
        else {
            // Send error response
            ws.send(JSON.stringify({
                id: generateId(),
                type: 'ai_response',
                timestamp: Date.now(),
                data: {
                    response: `处理请求"${input}"时发生错误：${executionResult.error}`,
                    conversationId: message.id,
                    executionResult: {
                        success: false,
                        error: executionResult.error,
                        executionTime: totalTime
                    }
                }
            }));
            // Send error state update
            ws.send(JSON.stringify({
                id: generateId(),
                type: 'state_update',
                timestamp: Date.now(),
                data: {
                    agentStatus: 'error',
                    currentTask: undefined
                }
            }));
        }
    }
    catch (error) {
        console.error('Error handling user request:', error);
        // Send error response
        ws.send(JSON.stringify({
            id: generateId(),
            type: 'error',
            timestamp: Date.now(),
            data: {
                code: 'AI_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error processing request',
                details: error
            }
        }));
        // Send error state update
        ws.send(JSON.stringify({
            id: generateId(),
            type: 'state_update',
            timestamp: Date.now(),
            data: {
                agentStatus: 'error',
                currentTask: undefined
            }
        }));
    }
}
// Extract API keywords from user input to improve Context7 queries
function extractApiKeywords(input) {
    const keywords = [];
    const lowerInput = input.toLowerCase();
    // Cell operations
    if (lowerInput.includes('值') || lowerInput.includes('设置') || lowerInput.includes('修改')) {
        keywords.push('setValue', 'getValue', 'cell');
    }
    // Selection operations
    if (lowerInput.includes('选择') || lowerInput.includes('选中')) {
        keywords.push('getSelections', 'setSelections', 'selection');
    }
    // Formatting operations
    if (lowerInput.includes('格式') || lowerInput.includes('颜色') || lowerInput.includes('字体')) {
        keywords.push('backColor', 'foreColor', 'font', 'style');
    }
    // Formula operations
    if (lowerInput.includes('公式') || lowerInput.includes('计算') || lowerInput.includes('求和')) {
        keywords.push('setFormula', 'getFormula', 'calculate');
    }
    // Chart operations
    if (lowerInput.includes('图表') || lowerInput.includes('chart')) {
        keywords.push('charts', 'add', 'ChartType');
    }
    return keywords;
}
// Note: Removed old hardcoded generateSpreadJSCode function
// Now using AICodeGenerator for intelligent code generation
// Helper function to convert cell reference like "A1" to row, col coordinates
function getCellRowCol(cellRef) {
    const col = cellRef.match(/[A-Z]+/)?.[0] || 'A';
    const row = cellRef.match(/\d+/)?.[0] || '1';
    let colNum = 0;
    for (let i = 0; i < col.length; i++) {
        colNum = colNum * 26 + (col.charCodeAt(i) - 65 + 1);
    }
    return `${parseInt(row) - 1}, ${colNum - 1}`;
}
const app = (0, express_1.default)();
const PORT = config_js_1.config.server.port;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize MCP Tools and AI Code Generator
const mcpTools = new tools_js_1.MCPTools();
const aiCodeGenerator = new ai_code_generator_js_1.AICodeGenerator();
// Helper function to handle MCP tool calls via WebSocket
async function handleMCPToolCall(ws, message, toolName) {
    try {
        let result;
        switch (toolName) {
            case 'query_context7':
                result = await mcpTools.queryContext7(message.data);
                break;
            case 'execute_spreadjs_queries':
                result = await mcpTools.executeSpreadJSQueries(message.data);
                break;
            case 'execute_spreadjs_operations':
                result = await mcpTools.executeSpreadJSOperations(message.data);
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
        ws.send(JSON.stringify({
            type: message.type,
            id: message.id,
            success: true,
            result,
            timestamp: Date.now()
        }));
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error executing ${toolName}:`, error);
        ws.send(JSON.stringify({
            type: message.type,
            id: message.id,
            success: false,
            error: errorMessage,
            timestamp: Date.now()
        }));
    }
}
// Health check endpoint
app.get('/health', (req, res) => {
    const requestId = Math.random().toString(36).substring(2);
    logger_js_1.logger.info('Health check requested', {}, requestId);
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        tools: mcpTools.getToolDefinitions().map(tool => tool.name),
        config: {
            nodeEnv: config_js_1.config.server.nodeEnv,
            logLevel: config_js_1.config.server.logLevel
        }
    });
});
// Get available tools
app.get('/tools', (req, res) => {
    const requestId = Math.random().toString(36).substring(2);
    logger_js_1.logger.info('Tools list requested', {}, requestId);
    res.json({
        tools: mcpTools.getToolDefinitions(),
        timestamp: new Date().toISOString()
    });
});
// MCP Tool endpoints
app.post('/tools/query_context7', async (req, res) => {
    try {
        const result = await mcpTools.queryContext7(req.body);
        res.json({ success: true, result });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: errorMessage });
    }
});
app.post('/tools/execute_spreadjs_queries', async (req, res) => {
    try {
        const result = await mcpTools.executeSpreadJSQueries(req.body);
        res.json({ success: true, result });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: errorMessage });
    }
});
app.post('/tools/execute_spreadjs_operations', async (req, res) => {
    try {
        const result = await mcpTools.executeSpreadJSOperations(req.body);
        res.json({ success: true, result });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: errorMessage });
    }
});
// CopilotKit API endpoint
app.post('/api/copilotkit', async (req, res) => {
    try {
        console.log('CopilotKit API request received:');
        console.log('Headers:', req.headers);
        console.log('Body:', JSON.stringify(req.body, null, 2));
        const { messages, model, functions } = req.body;
        // More lenient validation - allow empty messages for initial requests
        if (!messages || !Array.isArray(messages)) {
            console.log('Invalid messages format, providing default response');
            return res.json({
                choices: [{
                        message: {
                            role: 'assistant',
                            content: '我是 SpreadJS AI 助手。我可以帮助您处理电子表格操作。请告诉我您想要做什么，我会通过工作流系统来执行您的请求。'
                        },
                        finish_reason: 'stop'
                    }]
            });
        }
        const lastMessage = messages[messages.length - 1];
        // Check if this is a function call request
        if (functions && Array.isArray(functions) && functions.length > 0) {
            const executeAIWorkflowFunction = functions.find((f) => f.name === 'executeAIWorkflow');
            if (executeAIWorkflowFunction && lastMessage?.content) {
                // Return a function call response
                res.json({
                    choices: [{
                            message: {
                                role: 'assistant',
                                content: null,
                                function_call: {
                                    name: 'executeAIWorkflow',
                                    arguments: JSON.stringify({
                                        userRequest: lastMessage.content
                                    })
                                }
                            },
                            finish_reason: 'function_call'
                        }]
                });
                return;
            }
        }
        // Return a regular chat response
        res.json({
            choices: [{
                    message: {
                        role: 'assistant',
                        content: '我是 SpreadJS AI 助手。我可以帮助您处理电子表格操作。请告诉我您想要做什么，我会通过工作流系统来执行您的请求。'
                    },
                    finish_reason: 'stop'
                }]
        });
    }
    catch (error) {
        console.error('CopilotKit API error:', error);
        res.status(500).json({
            error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                type: 'api_error'
            }
        });
    }
});
// Create HTTP server
const server = new http_1.Server(app);
// Create WebSocket server for real-time communication with frontend
const wss = new ws_1.WebSocketServer({
    server,
    path: '/ws'
});
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    // Add client to MCP tools for broadcasting
    mcpTools.addWSClient(ws);
    // Send initial state using new protocol
    ws.send(JSON.stringify({
        id: generateId(),
        type: 'state_update',
        timestamp: Date.now(),
        data: {
            agentStatus: 'idle',
            toolCalls: [],
            generatedCode: [],
            availableTools: mcpTools.getToolDefinitions().map(t => t.name)
        }
    }));
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received WebSocket message:', data);
            // Handle different message types using new unified protocol
            switch (data.type) {
                case 'user_request':
                    await handleUserRequest(ws, data);
                    break;
                case 'ping':
                    ws.send(JSON.stringify({
                        id: generateId(),
                        type: 'pong',
                        timestamp: Date.now()
                    }));
                    break;
                // Legacy support for old message types
                case 'query_execution_result':
                    console.log('Query execution result:', data);
                    break;
                case 'operation_execution_result':
                    console.log('Operation execution result:', data);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        }
        catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        mcpTools.removeWSClient(ws);
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        mcpTools.removeWSClient(ws);
    });
});
// Start server
server.listen(PORT, () => {
    console.log(`🚀 MCP Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Tools endpoint: http://localhost:${PORT}/tools`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
    console.log(`📁 Available tools: ${mcpTools.getToolDefinitions().map(t => t.name).join(', ')}`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
