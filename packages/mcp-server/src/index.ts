import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { MCPTools } from './tools.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { AICodeGenerator } from './ai-code-generator.js';

// Simple utility functions for the new protocol
const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// AI Agent Decision Engine for determining tool usage
class AIAgentDecisionEngine {
  private mcpTools: any;

  constructor(mcpTools: any) {
    this.mcpTools = mcpTools;
  }

  async makeDecision(userRequest: string): Promise<{
    needsContext7: boolean;
    context7Query?: string;
    requiredQueries: any[];
    executionStrategy: 'simple' | 'validated' | 'iterative';
  }> {
    const prompt = {
      messages: [
        {
          role: "system",
          content: `You are an AI agent that decides how to handle SpreadJS operations.

You have access to these MCP tools:
1. query_context7 - Get SpreadJS documentation
2. execute_spreadjs_queries - Get current spreadsheet state
3. execute_spreadjs_operations - Execute SpreadJS code

For each user request, decide:
1. Do you need Context7 documentation? (simple operations like "get A1 value" don't need docs)
2. What specific Context7 query would be most helpful?
3. What SpreadJS state queries do you need? (only query what you actually need)
4. What execution strategy to use: simple (direct execution), validated (with verification), or iterative (multiple attempts)

Respond in JSON format:
{
  "needsContext7": boolean,
  "context7Query": "specific search terms for SpreadJS docs",
  "requiredQueries": [
    {
      "code": "JavaScript code to get state",
      "description": "What this query does",
      "resultKey": "key for storing result"
    }
  ],
  "executionStrategy": "simple|validated|iterative",
  "reasoning": "Why you made these decisions"
}`
        },
        {
          role: "user",
          content: `User request: "${userRequest}"\n\nWhat's your strategy for handling this request?`
        }
      ],
      function_call: {
        name: "make_agent_decision",
        description: "Decide how to handle a SpreadJS user request",
        parameters: {
          type: "object",
          properties: {
            needsContext7: { type: "boolean" },
            context7Query: { type: "string" },
            requiredQueries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  description: { type: "string" },
                  resultKey: { type: "string" }
                }
              }
            },
            executionStrategy: { type: "string", enum: ["simple", "validated", "iterative"] },
            reasoning: { type: "string" }
          }
        }
      }
    };

    try {
      const aiResponse = await this.callAI(prompt);
              // AI Decision logged through structured logging
      return aiResponse;
    } catch (error) {
              logger.error('AI decision failed, using fallback', { error: error instanceof Error ? error.message : String(error) });
      // Fallback to minimal strategy
      return {
        needsContext7: true,
        context7Query: `SpreadJS ${userRequest}`,
        requiredQueries: [
          {
            code: 'spread.getActiveSheet().getActiveRowIndex() + "," + spread.getActiveSheet().getActiveColumnIndex()',
            description: 'Get active cell position',
            resultKey: 'activeCell'
          }
        ],
        executionStrategy: 'simple'
      };
    }
  }

  private async callAI(prompt: any): Promise<any> {
    // Use the same AI service as the code generator
    const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'SpreadJS MCP Agent'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: prompt.messages,
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse AI decision response');
  }
}

// True AI-driven request handler
async function handleUserRequest(ws: any, message: any) {
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

    console.log('Processing user request with AI Agent:', input);

    // Step 1: AI decides the strategy
    const decisionEngine = new AIAgentDecisionEngine(mcpTools);
    const decision = await decisionEngine.makeDecision(input);

    console.log('AI Decision:', decision);

    let context7Result = null;
    let context7Time = 0;

    // Step 2: Conditionally query Context7 based on AI decision
    if (decision.needsContext7 && decision.context7Query) {
      const context7StartTime = Date.now();
      try {
        context7Result = await mcpTools.queryContext7({
          topic: decision.context7Query,
          maxTokens: 5000
        });
        console.log('Context7 query completed:', context7Result.success, 'Documents:', context7Result.documents?.length || 0);
      } catch (error) {
        console.error('Context7 query failed:', error);
        context7Result = { success: false, error: error instanceof Error ? error.message : 'Context7 query failed' };
      }
      context7Time = Date.now() - context7StartTime;
    } else {
      console.log('AI decided Context7 not needed for this request');
    }

    // Step 3: Execute AI-determined queries only
    let queryResult: any = { success: true, results: {} };
    let queryTime = 0;

    if (decision.requiredQueries.length > 0) {
      const queryStartTime = Date.now();
      try {
        // Add IDs to queries
        const queriesWithIds = decision.requiredQueries.map(q => ({
          ...q,
          id: generateId()
        }));

        queryResult = await mcpTools.executeSpreadJSQueries({ queries: queriesWithIds });
        console.log('AI-determined queries completed:', queryResult.success);
      } catch (error) {
        console.error('SpreadJS queries failed:', error);
        queryResult = { success: false, error: error instanceof Error ? error.message : 'SpreadJS queries failed' };
      }
      queryTime = Date.now() - queryStartTime;
    } else {
      console.log('AI decided no state queries needed');
    }

    // Step 4: Execute with AI-chosen strategy
    const execStartTime = Date.now();
    let aiGenerationResult;

    if (decision.executionStrategy === 'validated' || decision.executionStrategy === 'iterative') {
      // Use the Agent version with validation
      aiGenerationResult = await aiCodeGenerator.executeAsAgent({
        userRequest: input,
        spreadjsContext: queryResult,
        documentationContext: context7Result,
        maxRetries: decision.executionStrategy === 'iterative' ? 3 : 1,
        requireValidation: true
      });
    } else {
      // Use simple generation
      aiGenerationResult = await aiCodeGenerator.generateSpreadJSCode({
        userRequest: input,
        spreadjsContext: queryResult,
        documentationContext: context7Result
      });
    }

    console.log('AI Generated code:', aiGenerationResult.code);
    console.log('AI Confidence:', aiGenerationResult.confidence);
    console.log('AI Explanation:', aiGenerationResult.explanation);

    // Step 5: Execute the operation if code was generated successfully
    let executionResult;
    if (aiGenerationResult.success && aiGenerationResult.code) {
      try {
        executionResult = await mcpTools.executeSpreadJSOperations({
          code: aiGenerationResult.code,
          description: `AI-generated operation: ${input}`
        });
        console.log('Operation execution completed:', executionResult.success);
      } catch (error) {
        console.error('Operation execution failed:', error);
        executionResult = { success: false, error: error instanceof Error ? error.message : 'Operation execution failed' };
      }
    } else {
      executionResult = {
        success: false,
        error: aiGenerationResult.error || 'Code generation failed'
      };
    }

    const executionTime = Date.now() - execStartTime;

    const totalTime = context7Time + queryTime + executionTime;

    if (executionResult.success) {
      // Send successful AI response
      ws.send(JSON.stringify({
        id: generateId(),
        type: 'ai_response',
        timestamp: Date.now(),
        data: {
          response: `成功处理您的请求："${input}"。执行时间：${totalTime}ms`,
          conversationId: message.id,
          codeGenerated: aiGenerationResult.code,
          executionResult: {
            success: true,
            result: executionResult.result,
            executionTime: totalTime
          }
        }
      }));

      // Send execution steps as tool calls
      const toolCalls = [
        ...(decision.needsContext7 && context7Result ? [{
          id: generateId(),
          name: 'query_context7',
          status: context7Result.success ? 'success' : 'error',
          args: { topic: decision.context7Query || input },
          result: context7Result.success ? context7Result : undefined,
          error: context7Result.success ? undefined : context7Result.error,
          timestamp: Date.now() - totalTime + context7Time
        }] : []),
        ...(decision.requiredQueries.length > 0 ? [{
          id: generateId(),
          name: 'execute_spreadjs_queries',
          status: queryResult.success ? 'success' : 'error',
          args: { queries: decision.requiredQueries.map((q: any) => q.description) },
          result: queryResult.success ? queryResult : undefined,
          error: queryResult.success ? undefined : queryResult.error,
          timestamp: Date.now() - totalTime + context7Time + queryTime
        }] : []),
        {
          id: generateId(),
          name: 'execute_spreadjs_operations',
          status: executionResult.success ? 'success' : 'error',
          args: { code: aiGenerationResult.code, description: `AI-generated operation: ${input}` },
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
            code: aiGenerationResult.code,
            description: `AI生成的操作: ${input}`,
            language: 'javascript',
            timestamp: Date.now()
          }]
        }
      }));

    } else {
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

  } catch (error) {
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

// Note: Removed old helper functions - now using true AI decision making

const app = express();
const PORT = config.server.port;

app.use(cors());
app.use(express.json());

// Initialize MCP Tools and AI Code Generator
const mcpTools = new MCPTools();
const aiCodeGenerator = new AICodeGenerator();

// Helper function to handle MCP tool calls via WebSocket
async function handleMCPToolCall(ws: any, message: any, toolName: string) {
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
  } catch (error) {
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
  logger.info('Health check requested', {}, requestId);

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tools: mcpTools.getToolDefinitions().map(tool => tool.name),
    config: {
      nodeEnv: config.server.nodeEnv,
      logLevel: config.server.logLevel
    }
  });
});

// Get available tools
app.get('/tools', (req, res) => {
  const requestId = Math.random().toString(36).substring(2);
  logger.info('Tools list requested', {}, requestId);

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

app.post('/tools/execute_spreadjs_queries', async (req, res) => {
  try {
    const result = await mcpTools.executeSpreadJSQueries(req.body);
    res.json({ success: true, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

app.post('/tools/execute_spreadjs_operations', async (req, res) => {
  try {
    const result = await mcpTools.executeSpreadJSOperations(req.body);
    res.json({ success: true, result });
  } catch (error) {
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
      const executeAIWorkflowFunction = functions.find((f: any) => f.name === 'executeAIWorkflow');
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

  } catch (error) {
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
const server = new Server(app);

// Create WebSocket server for real-time communication with frontend
const wss = new WebSocketServer({
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

        // Handle frontend responses
        case 'query_response':
          console.log('Query response received:', data);
          break;

        case 'operation_response':
          console.log('Operation response received:', data);
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
    } catch (error) {
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