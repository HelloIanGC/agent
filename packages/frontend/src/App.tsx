import { useEffect, useRef, useCallback } from 'react';
import { CopilotKit } from "@copilotkit/react-core";
import { useCopilotAction } from "@copilotkit/react-core";

import SpreadSheetComponent from './components/SpreadSheetComponent';
import AgentStateViewer from './components/AgentStateViewer';
import WorkflowViewer from './components/WorkflowViewer';
import ChatInterface from './components/ChatInterface';
import ResizablePanels from './components/ResizablePanels';
import { WebSocketService } from './services/WebSocketService';
import {
  useAppStore,
  useConnectionStatus,
  useUIState,
} from './store/useAppStore';
import { MessageType, AIResponseMessage, StateUpdateMessage, ErrorMessage, ToolCall, GeneratedCode } from '../../shared/types';

// Inner component that uses CopilotKit hooks
const AppInner: React.FC<{ handleUserInput: (input: string) => void }> = ({ handleUserInput }) => {
  const connectionStatus = useConnectionStatus();
  const uiState = useUIState();
  const { toggleSidebar, setActiveTab } = useAppStore();

  // CopilotKit action for SpreadJS operations
  useCopilotAction({
    name: "executeSpreadJSOperation",
    description: "Execute operations on SpreadJS spreadsheet",
    parameters: [
      { name: "operation", type: "string", description: "Description of the operation to perform" },
      { name: "code", type: "string", description: "JavaScript code to execute" }
    ],
    handler: async ({ operation, code }: { operation: string; code: string }) => {
      return handleUserInput(`${operation}: ${code}`);
    }
  });

  // Create left panel content
  const leftPanel = (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-300">
        <button
          onClick={() => setActiveTab('workflow')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            uiState.activeTab === 'workflow'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          AI工作流程
        </button>
        <button
          onClick={() => setActiveTab('agent')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            uiState.activeTab === 'agent'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Agent状态监控
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {uiState.activeTab === 'workflow' ? (
          <WorkflowViewer />
        ) : (
          <AgentStateViewer />
        )}
      </div>
    </div>
  );

  // Create center panel content
  const centerPanel = (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Connection Status Bar */}
      <div className={`px-4 py-1.5 text-xs font-medium ${
        connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
        connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
        'bg-red-100 text-red-800'
      }`}>
        MCP Server: {connectionStatus === 'connected' ? '已连接' :
                    connectionStatus === 'connecting' ? '连接中...' : '已断开'}
      </div>

      {/* SpreadJS Container */}
      <div className="flex-1 overflow-hidden">
        <SpreadSheetComponent onReady={() => {}} />
      </div>
    </div>
  );

  // Create right panel content
  const rightPanel = (
    <div className="h-full">
      <ChatInterface onUserInput={handleUserInput} />
    </div>
  );

  return (
    <div className="h-screen bg-gray-100">
      {/* Sidebar Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
      >
        {uiState.sidebarOpen ? '◀' : '▶'}
      </button>

      {/* Resizable Panels Layout */}
      {uiState.sidebarOpen ? (
        <ResizablePanels
          leftPanel={leftPanel}
          centerPanel={centerPanel}
          rightPanel={rightPanel}
          leftInitialWidth={320}
          rightInitialWidth={380}
          leftMinWidth={280}
          rightMinWidth={320}
          leftMaxWidth={600}
          rightMaxWidth={500}
        />
      ) : (
        <div className="h-full flex">
          {/* Center Panel when sidebar is closed */}
          <div className="flex-1">
            {centerPanel}
          </div>

          {/* Right Panel */}
          <div className="w-[380px] border-l border-gray-300">
            {rightPanel}
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const wsRef = useRef<WebSocketService | null>(null);

  const {
    setConnectionStatus,
    addAIMessage,
    setAgentStatus,
    setCurrentTask,
    addToolCall,
    addGeneratedCode,
    setAvailableTools
  } = useAppStore();

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocketService();
    wsRef.current = ws;

    const unsubscribeConnect = ws.onConnect(() => {
      setConnectionStatus('connected');
    });

    const unsubscribeDisconnect = ws.onDisconnect(() => {
      setConnectionStatus('disconnected');
    });

    const unsubscribeError = ws.onError((error: Error) => {
      setConnectionStatus('disconnected', error.message);
    });

    const unsubscribeMessage = ws.onMessage((message: any) => {
      handleWebSocketMessage(message);
    });

    // Connect
    setConnectionStatus('connecting');
    ws.connect();

    // Cleanup on unmount
    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
      unsubscribeMessage();
      ws.disconnect();
    };
  }, [setConnectionStatus]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    console.log('Received WebSocket message:', message);

    switch (message.type) {
      case MessageType.AI_RESPONSE:
        handleAIResponse(message as AIResponseMessage);
        break;
      case MessageType.STATE_UPDATE:
        handleStateUpdate(message as StateUpdateMessage);
        break;
      case MessageType.ERROR:
        handleError(message as ErrorMessage);
        break;
      // Handle MCP tool-related messages
      case 'tool_call':
        handleToolCall(message);
        break;
      case 'execute_query':
        handleExecuteQuery(message);
        break;
      case 'execute_operation':
        handleExecuteOperation(message);
        break;
      case 'code_generated':
        console.log('Code generated:', message);
        // Handle code generation notification
        break;
      case 'pong':
        console.log('Received pong from server');
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  // Handle AI response
  const handleAIResponse = useCallback((message: AIResponseMessage) => {
    const { response, codeGenerated, executionResult } = message.data;

    // Add AI message to conversation
    addAIMessage(response, {
      codeGenerated,
      executionResult
    });

    // Update agent status
    setAgentStatus('idle');
    setCurrentTask(undefined);
  }, [addAIMessage, setAgentStatus, setCurrentTask]);

  // Handle state update
  const handleStateUpdate = useCallback((message: StateUpdateMessage) => {
    const { agentStatus, currentTask, toolCalls, generatedCode, availableTools } = message.data;

    if (agentStatus) setAgentStatus(agentStatus);
    if (currentTask !== undefined) setCurrentTask(currentTask);
    if (toolCalls) {
      toolCalls.forEach((toolCall: ToolCall) => {
        addToolCall(toolCall);
      });
    }
    if (generatedCode) {
      generatedCode.forEach((code: GeneratedCode) => {
        addGeneratedCode(code);
      });
    }
    if (availableTools) {
      setAvailableTools(availableTools);
    }
  }, [setAgentStatus, setCurrentTask, addToolCall, addGeneratedCode, setAvailableTools]);

  // Handle error
  const handleError = useCallback((message: ErrorMessage) => {
    console.error('WebSocket error:', message.data);
    setAgentStatus('error');
    setCurrentTask(undefined);
  }, [setAgentStatus, setCurrentTask]);

  // Handle tool call messages
  const handleToolCall = useCallback((message: any) => {
    console.log('Handling tool call:', message);

    if (message.data) {
      const toolCall: ToolCall = {
        id: message.data.id,
        name: message.data.name,
        status: message.data.status,
        args: message.data.args,
        result: message.data.result,
        error: message.data.error,
        timestamp: message.timestamp
      };
      addToolCall(toolCall);
    }
  }, [addToolCall]);

  // Handle execute query messages from MCP server
  const handleExecuteQuery = useCallback((message: any) => {
    console.log('Handling execute query:', message);

    if (message.query && window.spread) {
      try {
        // Execute the query on SpreadJS
        console.log('Executing query:', message.query.code);
        const result = eval(message.query.code);
        console.log('Query result:', result);

        // Send result back to MCP server
        if (wsRef.current?.isConnected) {
          (wsRef.current as any).ws?.send(JSON.stringify({
            type: 'query_response',
            queryId: message.queryId,
            result: result,
            success: true,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error executing query:', error);

        // Send error back to MCP server
        if (wsRef.current?.isConnected) {
          (wsRef.current as any).ws?.send(JSON.stringify({
            type: 'query_response',
            queryId: message.queryId,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false,
            timestamp: Date.now()
          }));
        }
      }
    }
  }, []);

  // Handle execute operation messages from MCP server
  const handleExecuteOperation = useCallback((message: any) => {
    console.log('Handling execute operation:', message);

    if (message.code && window.spread) {
      try {
        // Execute the operation on SpreadJS
        const result = eval(message.code);
        console.log('Operation result:', result);

        // Send result back to MCP server
        if (wsRef.current?.isConnected) {
          (wsRef.current as any).ws?.send(JSON.stringify({
            type: 'operation_response',
            operationId: message.operationId,
            result: result,
            success: true,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error executing operation:', error);

        // Send error back to MCP server
        if (wsRef.current?.isConnected) {
          (wsRef.current as any).ws?.send(JSON.stringify({
            type: 'operation_response',
            operationId: message.operationId,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false,
            timestamp: Date.now()
          }));
        }
      }
    }
  }, []);

  // Handle user input from chat interface
  const handleUserInput = useCallback((input: string) => {
    // Send user request via WebSocket
    wsRef.current?.sendUserRequest(input);

    // Update agent status
    setAgentStatus('thinking');
  }, [setAgentStatus]);

  return (
    <CopilotKit runtimeUrl="http://localhost:3001/api/copilotkit">
      <AppInner handleUserInput={handleUserInput} />
    </CopilotKit>
  );
}

export default App;