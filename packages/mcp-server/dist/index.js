#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { MCPTools } from './tools.js';
import { LangGraphSpreadJSAgent } from './langgraph-agent.js';
// Create server and tools instances
const server = new Server({
    name: 'spreadjs-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
const mcpTools = new MCPTools();
const langGraphAgent = new LangGraphSpreadJSAgent(mcpTools);
/**
 * MCP Server for SpreadJS Integration with LangGraph Agent
 *
 * Two modes of operation:
 * 1. Direct tool calls (for detailed control)
 * 2. LangGraph agent (for autonomous AI workflow)
 */
// Enhanced tool list for both modes
const tools = [
    // Direct tool access (existing)
    {
        name: 'query_context7',
        description: 'Query Context7 for SpreadJS API documentation',
        inputSchema: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: 'Topic to search for in documentation' },
                maxTokens: { type: 'number', description: 'Maximum tokens to retrieve', default: 5000 }
            },
            required: ['topic']
        }
    },
    {
        name: 'query_spreadjs',
        description: 'Query current SpreadJS state',
        inputSchema: {
            type: 'object',
            properties: {
                queries: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Unique identifier for this query' },
                            code: { type: 'string', description: 'JavaScript code to execute for querying' },
                            description: { type: 'string', description: 'Human-readable description of what this query does' },
                            resultKey: { type: 'string', description: 'Key to store the result under' }
                        },
                        required: ['id', 'code', 'description', 'resultKey']
                    }
                }
            },
            required: ['queries']
        }
    },
    {
        name: 'query_user',
        description: 'Ask the user a question for clarification',
        inputSchema: {
            type: 'object',
            properties: {
                question: { type: 'string', description: 'The question to ask the user' },
                context: { type: 'string', description: 'Additional context about why this question is being asked' }
            },
            required: ['question']
        }
    },
    {
        name: 'execute_spreadjs',
        description: 'Execute SpreadJS operations',
        inputSchema: {
            type: 'object',
            properties: {
                code: { type: 'string', description: 'JavaScript code to execute' },
                description: { type: 'string', description: 'Human-readable description of the operation' }
            },
            required: ['code', 'description']
        }
    },
    {
        name: 'run_langgraph_agent',
        description: 'Run the full LangGraph agent (requires LangChain dependencies) to complete a user request automatically',
        inputSchema: {
            type: 'object',
            properties: {
                userRequest: { type: 'string', description: 'The user request to complete autonomously' },
                streaming: { type: 'boolean', description: 'Whether to stream progress updates', default: false }
            },
            required: ['userRequest']
        }
    }
];
// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'query_context7':
                return await handleQueryContext7(args);
            case 'query_spreadjs':
                return await handleQuerySpreadjs(args);
            case 'query_user':
                return await handleQueryUser(args);
            case 'execute_spreadjs':
                return await handleExecuteSpreadjs(args);
            case 'run_langgraph_agent':
                return await handleLangGraphAgent(args);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
                }
            ]
        };
    }
});
// Tool handlers (existing direct tool access)
async function handleQueryContext7(args) {
    console.log('🔍 Direct Context7 query:', args);
    const result = await mcpTools.queryContext7(args);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }
        ]
    };
}
async function handleQuerySpreadjs(args) {
    console.log('📊 Direct SpreadJS query:', args);
    const result = await mcpTools.querySpreadjs(args);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }
        ]
    };
}
async function handleQueryUser(args) {
    console.log('❓ Direct user query:', args);
    const result = await mcpTools.queryUser(args);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }
        ]
    };
}
async function handleExecuteSpreadjs(args) {
    console.log('⚡ Direct SpreadJS execution:', args);
    const result = await mcpTools.executeSpreadjs(args);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }
        ]
    };
}
// LangGraph agent handler (new autonomous mode)
async function handleLangGraphAgent(args) {
    console.log('🤖 Running LangGraph autonomous agent:', args);
    try {
        if (args.streaming) {
            // Stream progress updates
            const updates = [];
            const stream = langGraphAgent.streamUserRequest(args.userRequest);
            for await (const step of stream) {
                updates.push(step);
                console.log('🔄 Agent step:', step);
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            type: 'streaming_complete',
                            allSteps: updates,
                            finalResult: updates[updates.length - 1]
                        }, null, 2)
                    }
                ]
            };
        }
        else {
            // Run to completion
            const result = await langGraphAgent.processUserRequest(args.userRequest);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            type: 'complete',
                            result: result
                        }, null, 2)
                    }
                ]
            };
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        fallback: 'Use direct tool calls instead'
                    }, null, 2)
                }
            ]
        };
    }
}
// Start server
async function main() {
    console.log('🚀 Starting SpreadJS MCP Server with LangGraph Support...');
    console.log('📚 Available modes:');
    console.log('  1. Direct tool calls: query_context7, query_spreadjs, query_user, execute_spreadjs');
    console.log('  2. Full LangGraph agent: run_langgraph_agent (dependencies pending)');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('✅ MCP Server running on stdio');
}
main().catch((error) => {
    console.error('💥 Server startup failed:', error);
    process.exit(1);
});
