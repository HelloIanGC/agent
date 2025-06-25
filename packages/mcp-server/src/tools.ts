import { WebSocket } from 'ws';
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from 'zod';
import { TIMEOUTS, ERROR_MESSAGES } from './utils/constants.js';
import { logger } from './logger.js';
import { context7Client } from './context7-client.js';

type ToolCallRequest = {
    id: string;
    name: string;
    args: any;
    promise: {
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    timer: NodeJS.Timeout;
};

const queryContext7Schema = z.object({
    topic: z.string().describe("The search topic for the documentation.")
});
export const query_context7 = new DynamicStructuredTool({
    name: "query_context7",
    description: "Query technical documentation and APIs for libraries like SpreadJS. Use this to get information on how to use specific functions or accomplish tasks.",
    func: async () => { throw new Error("This tool must be called via MCPMasterTools"); },
    schema: queryContext7Schema
});

const querySpreadJsSchema = z.object({
    queries: z.array(z.string()).describe("An array of javascript code snippets to execute for querying information. e.g. ['sheet.getRowCount()', 'sheet.getColumnCount()']")
});
export const query_spreadjs = new DynamicStructuredTool({
    name: "query_spreadjs",
    description: "Use this to query the SpreadJS object for information. Input is an array of javascript code snippets to be executed. The code will be executed in the browser, and the results of each snippet will be returned.",
    func: async () => { throw new Error("This tool must be called via MCPMasterTools"); },
    schema: querySpreadJsSchema
});

const executeSpreadJsSchema = z.object({
    code: z.string().describe("The SpreadJS code to execute."),
    validate: z.string().describe("JavaScript code to execute after the main code to validate the result. It should return a boolean or a value.")
});
export const execute_spreadjs = new DynamicStructuredTool({
    name: "execute_spreadjs",
    description: "Execute SpreadJS code to modify the spreadsheet. This is for when you are confident you can fulfill the user request.",
    func: async () => { throw new Error("This tool must be called via MCPMasterTools"); },
    schema: executeSpreadJsSchema
});

const queryUserSchema = z.object({
    question: z.string().describe("The question to ask the user.")
});
export const query_user = new DynamicStructuredTool({
    name: "query_user",
    description: "Ask the user for clarification or more information if the request is ambiguous or incomplete.",
    func: async () => { throw new Error("This tool must be called via MCPMasterTools"); },
    schema: queryUserSchema
});


export class MCPMasterTools {
    private ws: WebSocket | null = null;
    private pendingRequests: Map<string, ToolCallRequest> = new Map();

    constructor() {
        this.handleToolResponse = this.handleToolResponse.bind(this);
    }

    addWSClient(ws: WebSocket) {
        this.ws = ws;
        this.ws.on('message', this.handleToolResponse);
    }

    removeWSClient() {
        if (this.ws) {
            this.ws.removeAllListeners('message');
            this.ws = null;
        }
        this.pendingRequests.forEach(request => {
            request.promise.reject(new Error("WebSocket client disconnected."));
            clearTimeout(request.timer);
        });
        this.pendingRequests.clear();
        logger.info('MCPMasterTools client removed and pending requests cleared.');
    }

    public handleToolResponse(message: string) {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.type === 'tool_response') {
                const { id, result, error } = parsedMessage.data;
                const request = this.pendingRequests.get(id);

                if (request) {
                    clearTimeout(request.timer);
                    if (error) {
                        const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
                        logger.error(`Tool call ${id} failed`, { error: errorMsg });
                        request.promise.reject(new Error(errorMsg));
                    } else {
                        logger.info(`Tool call ${id} succeeded`, { result });
                        request.promise.resolve(result);
                    }
                    this.pendingRequests.delete(id);
                }
            }
        } catch (err: any) {
            logger.error('Failed to parse tool response message from client:', { error: err.message || String(err) });
        }
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    private createToolCallPromise(id: string, name: string, args: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                const errorMessage = `${ERROR_MESSAGES.TOOL_TIMEOUT}: ${name}`;
                logger.error(errorMessage, { tool: name, args: JSON.stringify(args) });
                reject(new Error(errorMessage));
            }, TIMEOUTS.TOOL_EXECUTION);

            this.pendingRequests.set(id, { id, name, args, promise: { resolve, reject }, timer });
        });
    }

    async call_tool(name: string, args: any): Promise<any> {
        if (name === 'query_context7') {
            try {
                logger.info(`Executing tool '${name}' on the backend.`);
                const result = await context7Client.querySpreadJSDocumentation(args.topic);
                return result;
            } catch(error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error(`Backend tool execution failed for '${name}'`, { error: message });
                throw error;
            }
        }

        if (!this.ws) {
            throw new Error(ERROR_MESSAGES.NO_FRONTEND_CONNECTION);
        }

        const id = this.generateId();
        const promise = this.createToolCallPromise(id, name, args);

        this.ws.send(JSON.stringify({
            type: `tool_call`,
            data: { id, name, args }
        }));

        return promise;
    }
}