// Context7 related types
export interface Context7Response {
  success: boolean;
  documents: Context7Document[];
  totalTokens: number;
  error?: string;
}

export interface CodeListItem {
  language: string;
  code: string;
}

export interface Context7Document {
  codeTitle: string;
  // codeDescription: string;
  pageTitle: string;
  codeList: CodeListItem[];
  relevance: number;
}

// SpreadJS Query types
export interface StateQuery {
  id: string;
  code: string;
  description: string;
  resultKey?: string;
}

export interface StateQueryResponse {
  success: boolean;
  results: any[];
  metadata?: {
    executionTime: number;
    queryCount: number;
    errors: string[];
  };
  error?: MCPError;
}

// SpreadJS Operation types
export interface OperationResponse {
  success: boolean;
  result?: any;
  error?: MCPError;
}

// WebSocket message types for frontend communication
export interface WSMessage {
  type: 'tool_call' | 'ai_thinking' | 'code_generated' | 'execution_result' | 'error' | 'tools_list' | 'execute_query' | 'execute_operation' | 'query_response' | 'operation_response' | 'ping' | 'pong';
  data: any;
  timestamp: number;
  id: string;
}

// Specific message types for better type safety
export interface QueryExecuteMessage {
  type: 'execute_query';
  queryId: string;
  query: StateQuery;
}

export interface OperationExecuteMessage {
  type: 'execute_operation';
  operationId: string;
  code: string;
  description: string;
}

export interface QueryResponseMessage {
  type: 'query_response';
  queryId: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface OperationResponseMessage {
  type: 'operation_response';
  operationId: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  result?: any;
  error?: string;
}

// Tool definition type (simplified version)
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Error handling types
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  CONTEXT7_ERROR = 'CONTEXT7_ERROR',
  SPREADJS_ERROR = 'SPREADJS_ERROR',
  CONTEXT7_QUERY_FAILED = 'CONTEXT7_QUERY_FAILED',
  FRONTEND_QUERY_FAILED = 'FRONTEND_QUERY_FAILED',
  FRONTEND_OPERATION_FAILED = 'FRONTEND_OPERATION_FAILED',
  USER_PROMPT_TIMEOUT = 'USER_PROMPT_TIMEOUT'
}

export interface MCPError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: number;
}

// Request validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Agent state types
export interface AgentState {
  currentTask?: string;
  toolCalls: ToolCall[];
  generatedCode: string[];
  context: any;
  availableTools: string[];
}