import { AIMessage } from '@langchain/core/messages';

export interface AgentState {
  messages: AIMessage[];
  userRequest: string;
  context: any;
}