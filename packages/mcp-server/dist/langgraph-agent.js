import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import 'dotenv/config';
/**
 * LangGraph-based Autonomous AI Agent for SpreadJS
 * Uses conditional edges to let AI make completely autonomous decisions
 * Uses OpenRouter API for AI calls (same as original implementation)
 */
export class LangGraphSpreadJSAgent {
    constructor(mcpTools) {
        this.mcpTools = mcpTools;
        this.workflow = this.createWorkflow();
    }
    broadcastStateUpdate(state) {
        // Broadcast state updates to connected clients via MCPTools
        if (this.mcpTools) {
            this.mcpTools.broadcastToClients({
                type: 'langgraph_state_update',
                data: state,
                timestamp: Date.now(),
                id: this.generateId()
            });
        }
    }
    generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    createWorkflow() {
        // Create the state graph
        const workflow = new StateGraph({
            channels: {
                messages: {
                    value: (x, y) => x.concat(y),
                    default: () => []
                },
                userRequest: {
                    value: (x, y) => y ?? x,
                    default: () => ""
                },
                currentStep: {
                    value: (x, y) => y ?? x,
                    default: () => "start"
                },
                stepCount: {
                    value: (x, y) => y ?? x,
                    default: () => 0
                },
                context7Results: {
                    value: (x, y) => y ?? x,
                    default: () => null
                },
                spreadjsResults: {
                    value: (x, y) => y ?? x,
                    default: () => null
                },
                userResponse: {
                    value: (x, y) => y ?? x,
                    default: () => null
                },
                executionResult: {
                    value: (x, y) => y ?? x,
                    default: () => null
                },
                isComplete: {
                    value: (x, y) => y ?? x,
                    default: () => false
                },
                error: {
                    value: (x, y) => y ?? x,
                    default: () => undefined
                }
            }
        });
        // Add nodes
        workflow.addNode("decide_next_action", this.decideNextAction.bind(this));
        workflow.addNode("query_context7", this.queryContext7.bind(this));
        workflow.addNode("query_spreadjs", this.querySpreadjs.bind(this));
        workflow.addNode("query_user", this.queryUser.bind(this));
        workflow.addNode("execute_spreadjs", this.executeSpreadjs.bind(this));
        workflow.addNode("complete_task", this.completeTask.bind(this));
        // Set entry point using addEdge instead of setEntryPoint
        workflow.addEdge(START, "decide_next_action");
        // Add conditional edges - this is where AI autonomy happens
        workflow.addConditionalEdges("decide_next_action", this.routeDecision.bind(this), {
            "query_context7": "query_context7",
            "query_spreadjs": "query_spreadjs",
            "query_user": "query_user",
            "execute_spreadjs": "execute_spreadjs",
            "complete": "complete_task"
        });
        // All tools loop back to decision making
        workflow.addConditionalEdges("query_context7", this.routeAfterTool.bind(this), {
            "decide": "decide_next_action",
            "complete": "complete_task"
        });
        workflow.addConditionalEdges("query_spreadjs", this.routeAfterTool.bind(this), {
            "decide": "decide_next_action",
            "complete": "complete_task"
        });
        workflow.addConditionalEdges("query_user", this.routeAfterTool.bind(this), {
            "decide": "decide_next_action",
            "complete": "complete_task"
        });
        workflow.addConditionalEdges("execute_spreadjs", this.routeAfterTool.bind(this), {
            "decide": "decide_next_action",
            "complete": "complete_task"
        });
        workflow.addEdge("complete_task", END);
        return workflow.compile();
    }
    // Routing functions for conditional edges
    async routeDecision(state) {
        // This will be set by the decision node
        return state.currentStep;
    }
    async routeAfterTool(state) {
        if (state.isComplete || state.error) {
            return "complete";
        }
        return "decide";
    }
    // Node implementations
    async decideNextAction(state) {
        // Check step limit to prevent infinite loops
        if (state.stepCount >= 10) {
            return {
                isComplete: true,
                error: "Maximum execution steps (10) reached. Task forced to complete.",
                messages: [new AIMessage("Task stopped after 10 steps to prevent infinite loops.")]
            };
        }
        const prompt = `You are an autonomous AI agent helping users with SpreadJS operations.

Current situation:
- User request: ${state.userRequest}
- Previous steps: ${state.messages.slice(-3).map(m => m.content).join(', ')}
- Context7 results available: ${!!state.context7Results}
- SpreadJS state available: ${!!state.spreadjsResults}
- User clarification available: ${!!state.userResponse}
- Execution result: ${state.executionResult ? 'Available' : 'None'}

Available actions:
1. query_context7 - Get SpreadJS API documentation when you need to understand how to use SpreadJS APIs
2. query_spreadjs - Query current SpreadJS state to understand what data exists
3. query_user - Ask the user a question when you need clarification about their requirements
4. execute_spreadjs - Execute SpreadJS operations to modify the spreadsheet
5. complete - Task is finished

Rules:
- If you don't know how to do something, query Context7 first
- If you need to check current state before executing, query SpreadJS
- If the user request is unclear, ask for clarification
- Only execute when you're confident about the operation
- Complete when the task is successfully done

Decide what to do next and provide reasoning.`;
        try {
            // Use OpenRouter API for structured decision making
            const response = await this.callOpenRouterAI({
                messages: [
                    {
                        role: "system",
                        content: "You are an AI agent that decides what action to take next. Respond with JSON containing nextAction and reasoning."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            });
            const decision = this.safeParseJSON(response.choices[0].message.content);
            const newState = {
                currentStep: decision.nextAction || 'complete',
                stepCount: state.stepCount + 1,
                messages: [new AIMessage(`Step ${state.stepCount + 1}: ${decision.reasoning || 'Proceeding with next action'}`)]
            };
            // Broadcast state update to frontend
            this.broadcastStateUpdate(newState);
            return newState;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                error: `Decision making failed: ${errorMessage}`,
                currentStep: 'complete',
                messages: [new AIMessage(`Error in decision making: ${errorMessage}`)]
            };
        }
    }
    async queryContext7(state) {
        try {
            const result = await this.mcpTools.queryContext7({
                topic: state.userRequest,
                maxTokens: 2000
            });
            return {
                context7Results: result,
                messages: [new AIMessage('Retrieved Context7 documentation successfully')]
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                error: `Context7 query failed: ${errorMessage}`,
                messages: [new AIMessage(`Failed to query Context7: ${errorMessage}`)]
            };
        }
    }
    async querySpreadjs(state) {
        try {
            const result = await this.mcpTools.querySpreadjs({
                queries: [{
                        id: 'main_query',
                        code: state.userRequest,
                        description: state.userRequest,
                        resultKey: 'spreadjs_state'
                    }]
            });
            return {
                spreadjsResults: result,
                messages: [new AIMessage('Retrieved SpreadJS state successfully')]
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                error: `SpreadJS query failed: ${errorMessage}`,
                messages: [new AIMessage(`Failed to query SpreadJS: ${errorMessage}`)]
            };
        }
    }
    async queryUser(state) {
        try {
            const result = await this.mcpTools.queryUser({
                question: `Need clarification for: ${state.userRequest}`,
                context: state.messages.slice(-2).map(m => m.content).join('\n')
            });
            return {
                userResponse: result,
                messages: [new AIMessage('Received user clarification')]
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                error: `User query failed: ${errorMessage}`,
                messages: [new AIMessage(`Failed to get user input: ${errorMessage}`)]
            };
        }
    }
    async executeSpreadjs(state) {
        // Determine what code to execute based on available information
        let codeToExecute = '';
        let verificationCode = '';
        // Use Context7 results to build proper API calls
        if (state.context7Results) {
            codeToExecute = `// Using Context7 guidance:\n${state.context7Results.code || '// No specific code provided'}`;
        }
        // Add current state awareness if available
        if (state.spreadjsResults) {
            codeToExecute += `\n// Current SpreadJS state: ${JSON.stringify(state.spreadjsResults, null, 2)}`;
        }
        // Add user clarification if available
        if (state.userResponse) {
            codeToExecute += `\n// User clarification: ${state.userResponse.response}`;
        }
        // If no specific code, generate based on user request
        if (!codeToExecute.trim()) {
            codeToExecute = `// Executing user request: ${state.userRequest}\n// TODO: Implement specific SpreadJS operations`;
        }
        // Generate verification code to check execution results
        verificationCode = `
// Verification code for: ${state.userRequest}
try {
  const sheet = window.spread.getActiveSheet();
  const verification = {
    rowCount: sheet.getRowCount(),
    columnCount: sheet.getColumnCount(),
    activeRange: sheet.getSelections()[0] ? sheet.getSelections()[0].toString() : 'No selection',
    cellData: sheet.getValue(0, 0), // Check first cell as sample
    timestamp: Date.now()
  };
  verification; // Return verification object
} catch (e) {
  ({ error: e.message, timestamp: Date.now() });
}`;
        try {
            const result = await this.mcpTools.executeSpreadjs({
                code: codeToExecute,
                description: `Executing: ${state.userRequest}`,
                verificationCode: verificationCode
            });
            const newState = {
                executionResult: result,
                isComplete: result.success || false,
                messages: [new AIMessage(`SpreadJS execution ${result.success ? 'completed successfully' : 'failed'}: ${result.result || result.error}`)]
            };
            // Broadcast state update to frontend
            this.broadcastStateUpdate(newState);
            return newState;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                error: `SpreadJS execution failed: ${errorMessage}`,
                messages: [new AIMessage(`Failed to execute SpreadJS: ${errorMessage}`)]
            };
        }
    }
    async completeTask(state) {
        const summary = state.executionResult?.success
            ? 'Task completed successfully'
            : state.error
                ? `Task failed: ${state.error}`
                : 'Task completed';
        return {
            isComplete: true,
            messages: [new AIMessage(summary)]
        };
    }
    async callOpenRouterAI(prompt) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'X-Title': 'LangGraph SpreadJS Agent'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                messages: prompt.messages,
                temperature: 0.3,
                max_tokens: 1000,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            })
        });
        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
    safeParseJSON(jsonString) {
        try {
            return JSON.parse(jsonString);
        }
        catch {
            return { nextAction: 'complete', reasoning: 'Failed to parse AI response' };
        }
    }
    async processUserRequest(userRequest) {
        const initialState = {
            messages: [new HumanMessage(userRequest)],
            userRequest,
            currentStep: "start",
            stepCount: 0,
            isComplete: false
        };
        try {
            const result = await this.workflow.invoke(initialState);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                ...initialState,
                error: `Workflow execution failed: ${errorMessage}`,
                isComplete: true,
                messages: [...initialState.messages, new AIMessage(`Workflow failed: ${errorMessage}`)]
            };
        }
    }
    async *streamUserRequest(userRequest) {
        const initialState = {
            messages: [new HumanMessage(userRequest)],
            userRequest,
            currentStep: "start",
            stepCount: 0,
            isComplete: false
        };
        try {
            const stream = await this.workflow.stream(initialState, {
                streamMode: "values"
            });
            for await (const chunk of stream) {
                yield chunk;
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            yield {
                error: `Streaming failed: ${errorMessage}`,
                isComplete: true,
                messages: [new AIMessage(`Streaming failed: ${errorMessage}`)]
            };
        }
    }
}
