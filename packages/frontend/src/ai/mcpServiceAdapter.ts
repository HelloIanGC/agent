import { WebSocketService } from '../services/WebSocketService';
import { BaseMessage, generateId } from '../../../shared/types';

export interface MCPToolCall {
  id: string;
  name: string;
  args: any;
}

export class MCPServiceAdapter {
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  async queryContext7(params: { topic: string; maxTokens?: number }): Promise<any> {
    return new Promise((resolve, reject) => {
      const toolCall: MCPToolCall = {
        id: generateId(),
        name: 'query_context7',
        args: params
      };

      // Set up response handler
      const timeout = setTimeout(() => {
        reject(new Error('Context7 query timeout'));
      }, 30000);

      const responseHandler = (response: any) => {
        if (response.id === toolCall.id) {
          clearTimeout(timeout);
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || 'Context7 query failed'));
          }
        }
      };

      // Send the tool call
      const message: BaseMessage = {
        id: toolCall.id,
        type: 'mcp_tool_call' as any,
        timestamp: Date.now(),
        data: toolCall
      };
      this.wsService.send(message);

      this.wsService.onMessage(responseHandler);
    });
  }

  async executeSpreadJSQueries(params: { queries: any[] }): Promise<any> {
    return new Promise((resolve, reject) => {
      const toolCall: MCPToolCall = {
        id: generateId(),
        name: 'execute_spreadjs_queries',
        args: params
      };

      // Set up response handler
      const timeout = setTimeout(() => {
        reject(new Error('SpreadJS queries timeout'));
      }, 30000);

      const responseHandler = (response: any) => {
        if (response.id === toolCall.id) {
          clearTimeout(timeout);
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || 'SpreadJS queries failed'));
          }
        }
      };

      // Send the tool call
      const message: BaseMessage = {
        id: toolCall.id,
        type: 'mcp_tool_call' as any,
        timestamp: Date.now(),
        data: toolCall
      };
      this.wsService.send(message);

      this.wsService.onMessage(responseHandler);
    });
  }

  async executeOperation(_: string, __: string): Promise<any> {
    throw new Error('Method not implemented');
  }
}