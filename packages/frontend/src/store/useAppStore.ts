import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  AppState,
  ConversationMessage,
  ToolCall,
  GeneratedCode,
  AgentStatus,
  SpreadJSContext,
  generateId
} from '../../../shared/types';

interface AppStore extends AppState {
  // Actions for connection
  setConnectionStatus: (status: AppState['connection']['status'], error?: string) => void;

  // Actions for conversation
  addUserMessage: (content: string) => void;
  addAIMessage: (content: string, metadata?: ConversationMessage['metadata']) => void;
  clearConversation: () => void;

  // Actions for agent state
  setAgentStatus: (status: AgentStatus) => void;
  setCurrentTask: (task?: string) => void;
  addToolCall: (toolCall: Omit<ToolCall, 'id' | 'timestamp'>) => void;
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void;
  addGeneratedCode: (code: Omit<GeneratedCode, 'id' | 'timestamp'>) => void;
  setAvailableTools: (tools: string[]) => void;
  clearAgentHistory: () => void;

  // Actions for UI
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: AppState['ui']['activeTab']) => void;

  // Actions for SpreadJS
  setSpreadJSInitialized: (initialized: boolean) => void;
  updateSpreadJSContext: (context: SpreadJSContext) => void;
}

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set) => ({
    // Initial state
    connection: {
      status: 'disconnected',
    },
    conversation: [],
    agent: {
      status: 'idle',
      toolCalls: [],
      generatedCode: [],
      availableTools: [],
    },
    ui: {
      sidebarOpen: true,
      activeTab: 'agent',
    },
    spreadjs: {
      initialized: false,
    },

    // Connection actions
    setConnectionStatus: (status, error) => {
      set((state) => ({
        connection: {
          ...state.connection,
          status,
          error,
          lastConnected: status === 'connected' ? Date.now() : state.connection.lastConnected,
        },
      }));
    },

    // Conversation actions
    addUserMessage: (content) => {
      const message: ConversationMessage = {
        id: generateId(),
        type: 'user',
        content,
        timestamp: Date.now(),
      };
      set((state) => ({
        conversation: [...state.conversation, message],
      }));
    },

    addAIMessage: (content, metadata) => {
      const message: ConversationMessage = {
        id: generateId(),
        type: 'ai',
        content,
        timestamp: Date.now(),
        metadata,
      };
      set((state) => ({
        conversation: [...state.conversation, message],
      }));
    },

    clearConversation: () => {
      set({ conversation: [] });
    },

    // Agent actions
    setAgentStatus: (status) => {
      set((state) => ({
        agent: {
          ...state.agent,
          status,
        },
      }));
    },

    setCurrentTask: (task) => {
      set((state) => ({
        agent: {
          ...state.agent,
          currentTask: task,
        },
      }));
    },

    addToolCall: (toolCallData) => {
      const toolCall: ToolCall = {
        ...toolCallData,
        id: generateId(),
        timestamp: Date.now(),
      };
      set((state) => ({
        agent: {
          ...state.agent,
          toolCalls: [...state.agent.toolCalls, toolCall],
        },
      }));
    },

    updateToolCall: (id, updates) => {
      set((state) => ({
        agent: {
          ...state.agent,
          toolCalls: state.agent.toolCalls.map((toolCall) =>
            toolCall.id === id ? { ...toolCall, ...updates } : toolCall
          ),
        },
      }));
    },

    addGeneratedCode: (codeData) => {
      const code: GeneratedCode = {
        ...codeData,
        id: generateId(),
        timestamp: Date.now(),
      };
      set((state) => ({
        agent: {
          ...state.agent,
          generatedCode: [...state.agent.generatedCode, code],
        },
      }));
    },

    setAvailableTools: (tools) => {
      set((state) => ({
        agent: {
          ...state.agent,
          availableTools: tools,
        },
      }));
    },

    clearAgentHistory: () => {
      set((state) => ({
        agent: {
          ...state.agent,
          toolCalls: [],
          generatedCode: [],
          currentTask: undefined,
        },
      }));
    },

    // UI actions
    toggleSidebar: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          sidebarOpen: !state.ui.sidebarOpen,
        },
      }));
    },

    setSidebarOpen: (open) => {
      set((state) => ({
        ui: {
          ...state.ui,
          sidebarOpen: open,
        },
      }));
    },

    setActiveTab: (tab) => {
      set((state) => ({
        ui: {
          ...state.ui,
          activeTab: tab,
        },
      }));
    },

    // SpreadJS actions
    setSpreadJSInitialized: (initialized) => {
      set((state) => ({
        spreadjs: {
          ...state.spreadjs,
          initialized,
        },
      }));
    },

    updateSpreadJSContext: (context) => {
      set((state) => ({
        spreadjs: {
          ...state.spreadjs,
          currentContext: context,
        },
      }));
    },
  }))
);

// Selectors for better performance
export const useConnectionStatus = () => useAppStore((state) => state.connection.status);
export const useConversation = () => useAppStore((state) => state.conversation);
export const useAgentState = () => useAppStore((state) => state.agent);
export const useUIState = () => useAppStore((state) => state.ui);