import './config.js';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { app, mcpTools } from './agent.js';
import { logger, logComm } from './logger.js';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';

async function handleUserRequest(ws: WebSocket, message: any) {
    const { input } = message.data;

    // Log user request
    logComm.userRequest(input);

    logger.error('Processing user request with Langgraph Agent:', { input });

    ws.send(JSON.stringify({
        type: 'agent_status_update',
        data: { status: 'thinking', currentTask: input },
    }));

    const systemInstruction = new SystemMessage(
        `You are a powerful AI assistant for SpreadJS.
    Your primary goal is to help users by executing their requests.
    You must respond by calling the most appropriate tool for the user's request.

    *** VERY IMPORTANT RULE ***
    Before using the 'execute_spreadjs' tool, you MUST FIRST use the 'query_context7' tool to get the latest API documentation for the user's request.
    This is mandatory. After one or two attempts with 'query_context7', you should have enough information. You MUST then proceed to call 'execute_spreadjs'. Do not get stuck in a loop querying for documentation.

    When using the \`execute_spreadjs\` tool, you must assume that a SpreadJS instance is already available in the execution scope under the variable \`spread\`, and the GrapeCity library is available under \`GC\`.
    You must not generate code to create or find the workbook instance. Instead, use the \`spread\` variable directly.

    Key API guidelines:
    - For tables: use \`sheet.tables.add()\` or \`sheet.tables.addFromDataSource()\`. Do not use \`sheet.addTable()\`.
    - For finding tables: use \`sheet.tables.all()\` or \`sheet.tables.find()\`.
    - Always try to use unique table names to avoid conflicts.

    Always validate your operations correctly.`
    );

    const initialState = {
        messages: [systemInstruction, new HumanMessage(input)],
        userRequest: input,
        context: {},
    };

    try {
        const stream = await app.stream(initialState, { recursionLimit: 50 });
        let lastToolCallId: string | null = null;

        for await (const event of stream) {
            const eventName = Object.keys(event)[0];
            const eventData = event[eventName];

            logger.info(`Langgraph event: ${eventName}`, { data: eventData });

            if (eventName === 'agent' && eventData.messages) {
                const aiMessage = eventData.messages.find((m: BaseMessage) => m instanceof AIMessage);
                if (aiMessage && aiMessage instanceof AIMessage) {
                    // Log AI message
                    const messageContent = typeof aiMessage.content === 'string' ? aiMessage.content : JSON.stringify(aiMessage.content);
                    logComm.aiMessage(messageContent, aiMessage.tool_calls ? { tool_calls: aiMessage.tool_calls } : undefined);

                    // Send AI message immediately when it's generated
                    ws.send(JSON.stringify({
                        type: 'ai_message',
                        data: {
                            content: messageContent,
                            metadata: aiMessage.tool_calls ? { tool_calls: aiMessage.tool_calls } : undefined
                        }
                    }));

                    // If there are tool calls, add them to the tool call tracking
                    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                        const toolCall = aiMessage.tool_calls[0];
                        if (toolCall.id) {
                            lastToolCallId = toolCall.id;

                            // Log tool call
                            logComm.toolCall(toolCall.name, toolCall.args, toolCall.id);

                            // Send tool call add immediately
                            ws.send(JSON.stringify({
                                type: 'tool_call_add',
                                data: {
                                    id: lastToolCallId,
                                    name: toolCall.name,
                                    args: toolCall.args,
                                    status: 'pending',
                                },
                            }));
                        }
                    }
                }
            } else if (eventName === 'force_context7' && eventData.messages) {
                // Handle forced Context7 query results
                const toolMessage = eventData.messages[eventData.messages.length - 1];
                if (toolMessage && 'tool_call_id' in toolMessage) {
                    // Generate a Context7 tool call display
                    const context7ToolCall = {
                        id: toolMessage.tool_call_id,
                        name: 'query_context7',
                        args: { query: eventData.userRequest },
                        status: 'completed'
                    };

                    // Log as tool call
                    logComm.toolCall(context7ToolCall.name, context7ToolCall.args, context7ToolCall.id);

                    // Send tool call to frontend
                    ws.send(JSON.stringify({
                        type: 'tool_call_add',
                        data: context7ToolCall,
                    }));

                    // Send completion immediately
                    ws.send(JSON.stringify({
                        type: 'tool_call_update',
                        data: {
                            id: context7ToolCall.id,
                            status: 'success',
                            result: { success: true, message: 'Context7 documentation retrieved successfully' }
                        },
                    }));
                }
            } else if (eventName === 'action' && eventData.messages) {
                if (lastToolCallId) {
                    const toolMessage = eventData.messages[0];
                    let result: any;
                    let status = 'success';
                    let errorMsg: string | undefined;

                    try {
                        result = JSON.parse(toolMessage.content);
                        if (result.success === false) {
                            status = 'error';
                            errorMsg = typeof result.error === 'object' && result.error ?.message
                                ? String(result.error.message)
                                : (typeof result.error === 'string' ? result.error : 'Tool execution failed');
                        }
                    } catch (err) {
                        result = { success: false, error: 'Failed to parse tool result' };
                        status = 'error';
                        errorMsg = 'Failed to parse tool result';
                    }

                    // Log tool result
                    logComm.toolResult(lastToolCallId, status === 'success', result, errorMsg);

                    // Send tool call update immediately
                    ws.send(JSON.stringify({
                        type: 'tool_call_update',
                        data: {
                            id: lastToolCallId,
                            status: status,
                            result: result,
                            error: errorMsg,
                        },
                    }));
                    lastToolCallId = null;
                }
            }
        }

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Log error
        logComm.error('Langgraph execution', errorMessage, { input });

        logger.error('Langgraph execution failed:', { error: errorMessage });
        ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Agent execution failed', details: errorMessage },
        }));
    } finally {
        // This block will always run, ensuring the agent status is reset
        logger.info('Agent execution finished. Resetting status to idle.');
        ws.send(JSON.stringify({
            type: 'agent_status_update',
            data: { status: 'idle' }
        }));
    }
}

const appExpress = express();
appExpress.use(cors());
appExpress.use(express.json());

const server = new Server(appExpress);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
    logger.info('Frontend client connected');
    mcpTools.addWSClient(ws);

    ws.on('message', async (message: string) => {
        try {
            const parsedMessage = JSON.parse(message);
            logger.info('Received message from client:', { type: parsedMessage.type });

            switch (parsedMessage.type) {
                case 'user_request':
                    await handleUserRequest(ws, parsedMessage);
                    break;
                case 'tool_response':
                    mcpTools.handleToolResponse(message);
                    break;
                case 'ping':
                    // Pong is handled automatically by ws library, but we can log if needed
                    break;
                default:
                    logger.warn('Unknown message type received:', { type: parsedMessage.type });
            }
        } catch (error) {
            logger.error('Failed to process message from client:', { error: error instanceof Error ? error.message : String(error) });
        }
    });

    ws.on('close', () => {
        logger.info('Frontend client disconnected');
        mcpTools.removeWSClient();
    });

    ws.on('error', (error) => {
        logger.error('WebSocket error:', { error: error instanceof Error ? error.message : String(error) });
    });
});

appExpress.get('/', (req, res) => {
    res.send('MCP Server is running');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    logger.info(`Server is listening on port ${PORT}`);
});