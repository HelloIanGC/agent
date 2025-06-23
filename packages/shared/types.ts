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
  data?: any;
}

// Message types enum
export enum MessageType {
  // User interactions
  USER_REQUEST = 'user_request',

  // AI responses
  AI_RESPONSE = 'ai_response',

  // State updates
  STATE_UPDATE = 'state_update',

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
  type: MessageType.USER_REQUEST;
  data: {
    input: string;
    context?: SpreadJSContext;
  };
}

export interface AIResponseMessage extends BaseMessage {
  type: MessageType.AI_RESPONSE;
  data: {
    response: string;
    codeGenerated?: string;
    executionResult?: ExecutionResult;
    conversationId: string;
  };
}

export interface StateUpdateMessage extends BaseMessage {
  type: MessageType.STATE_UPDATE;
  data: {
    toolCalls?: ToolCall[];
    generatedCode?: GeneratedCode[];
    agentStatus?: AgentStatus;
    currentTask?: string;
    availableTools?: string[];
  };
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  data: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
}

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

// Agent status
export type AgentStatus = 'idle' | 'thinking' | 'generating' | 'executing' | 'error';

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