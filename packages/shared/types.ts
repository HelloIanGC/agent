// Shared types for SpreadJS AI Agent

// Unique ID generator utility
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Base message interface
export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
}

// All possible message types from backend to frontend
export type MessageType =
  | 'user_request'
  | 'ai_message'
  | 'tool_call'
  | 'tool_response'
  | 'tool_call_add'
  | 'tool_call_update'
  | 'agent_status_update'
  | 'ping'
  | 'pong'
  | 'error';

// Message types enum (DEPRECATED, use string literals instead)
export enum OldMessageType {
  // User interactions
  USER_REQUEST = 'user_request',

  // AI responses
  AI_RESPONSE = 'DEPRECATED_AI_RESPONSE',

  // State updates
  STATE_UPDATE = 'DEPRECATED_STATE_UPDATE',

  // Errors
  ERROR = 'error',

  // System messages
  PING = 'ping',
  PONG = 'pong',

  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected'
}

// Specific message types
export interface UserRequestMessage extends BaseMessage {
  type: 'user_request';
  data: {
    input: string;
    context?: any;
  };
}

export interface AiMessage extends BaseMessage {
  type: 'ai_message';
  data: {
    content: string;
    metadata?: any;
  };
}

export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'error' | 'executing' | 'generating';

export interface AgentStatusUpdateMessage extends BaseMessage {
    type: 'agent_status_update';
    data: {
        status: AgentStatus;
        currentTask?: string;
    };
}

export interface ToolCallAddMessage extends BaseMessage {
    type: 'tool_call_add';
    data: any; // Simplified for now
}

export interface ToolCallUpdateMessage extends BaseMessage {
    type: 'tool_call_update';
    data: any; // Simplified for now
}

export interface ErrorMessage extends BaseMessage {
    type: 'error';
    data: {
        message: string;
        details?: any;
    };
}

// Frontend to Backend
export interface ToolResponseMessage extends BaseMessage {
  type: 'tool_response';
  data: {
    id: string; // Corresponds to the tool call id
    result?: any;
    error?: any;
  };
}

// Backend to Frontend
export interface ToolCallMessage extends BaseMessage {
  type: 'tool_call';
  data: {
    id: string;
    name: string;
    args: any;
  };
}

export type WebSocketMessage =
  | UserRequestMessage
  | AiMessage
  | ToolCallMessage
  | ToolResponseMessage
  | AgentStatusUpdateMessage
  | ToolCallAddMessage
  | ToolCallUpdateMessage
  | ErrorMessage;

// Core data types
export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  args?: any;
  result?: any;
  error?: string;
  timestamp: number;
  executionTime?: number;
}

export interface GeneratedCode {
  id: string;
  code: string;
  description: string;
  language: 'javascript' | 'typescript';
  timestamp: number;
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  affectedCells?: string[];
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
  metadata?: {
    tool_calls?: any[];
    codeGenerated?: string;
    executionResult?: ExecutionResult;
  };
}

// SpreadJS context
export interface SpreadJSContext {
  selectedRange?: string;
  cellData?: any;
  sheetStructure?: {
    name: string;
    rowCount: number;
    columnCount: number;
  };
  activeSheet?: string;
}

// Error codes
export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  AI_ERROR = 'AI_ERROR',
  SPREADJS_ERROR = 'SPREADJS_ERROR',
  CONTEXT7_ERROR = 'CONTEXT7_ERROR'
}

// App state interface
export interface AppState {
  // Connection status
  connection: {
    status: 'connecting' | 'connected' | 'disconnected';
    error?: string;
    lastConnected?: number;
  };

  // Conversation history
  conversation: ConversationMessage[];

  // Agent state
  agent: {
    status: AgentStatus;
    toolCalls: ToolCall[];
    generatedCode: GeneratedCode[];
    currentTask?: string;
    availableTools: string[];
  };

  // UI state
  ui: {
    sidebarOpen: boolean;
    activeTab: 'agent' | 'workflow';
  };

  // SpreadJS state
  spreadjs: {
    initialized: boolean;
    currentContext?: SpreadJSContext;
  };
}

// Utility types for message handling
export type MessageHandler<T extends BaseMessage> = (message: T) => void | Promise<void>;

export interface WebSocketClient {
  send(message: BaseMessage): void;
  onMessage(handler: MessageHandler<BaseMessage>): void;
  onError(handler: (error: Error) => void): void;
  onConnect(handler: () => void): void;
  onDisconnect(handler: () => void): void;
  connect(): void;
  disconnect(): void;
  readonly isConnected: boolean;
}