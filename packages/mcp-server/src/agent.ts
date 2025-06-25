import { StateGraph, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

import { AgentState } from './graph-state.js';
import {
    query_context7,
    query_spreadjs,
    execute_spreadjs,
    query_user,
    MCPMasterTools
} from './tools.js';
console.log('DEBUG-1:', { hasApiKey: !!process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL });
const model = new ChatOpenAI({
  model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  temperature: 0.2,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'SpreadJS MCP System'
    }
  }
});

export const mcpTools = new MCPMasterTools();
const tools = [query_context7, query_spreadjs, execute_spreadjs, query_user];
const boundModel = model.bind({ tools });

const should_continue = (state: AgentState): "continue" | "end" => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "continue";
  }
  return "end";
};

const call_model = async (state: AgentState): Promise<Partial<AgentState>> => {
  const { messages } = state;
  const response = await boundModel.invoke(messages);
  return { messages: [response] };
};

const call_tool_node = async (state: AgentState): Promise<Partial<AgentState>> => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls || !lastMessage.tool_calls.length) {
        throw new Error("call_tool_node was called with no tool calls present in the last message.");
    }

    const toolCall = lastMessage.tool_calls[0];

    if (!toolCall.id) {
        throw new Error("Tool call from AI message is missing an ID.");
    }

    const toolName = toolCall.name;
    const toolArgs = toolCall.args;

    const response = await mcpTools.call_tool(toolName, toolArgs);

    const toolMessage = new ToolMessage({
        content: JSON.stringify(response),
        tool_call_id: toolCall.id,
    });

    return { messages: [toolMessage] };
};

const workflow = new StateGraph<AgentState, any, any>({
  channels: {
    messages: {
      value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
    userRequest: {
        value: (x,y) => y ?? x,
        default: () => ""
    },
    context: {
        value: (x,y) => ({...x, ...y}),
        default: () => ({})
    }
  },
});

workflow.addNode("agent", call_model);
workflow.addNode("action", call_tool_node);

workflow.setEntryPoint("agent");

workflow.addConditionalEdges("agent", should_continue, {
  continue: "action",
  end: END,
});

workflow.addEdge("action", "agent");

const app = workflow.compile();

export { app };