import {
  BaseMessage,
  MessageType,
  MessageHandler,
  generateId,
  UserRequestMessage
} from '../../../shared/types';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, MessageHandler<BaseMessage>> = new Map();
  private connectionHandlers: (() => void)[] = [];
  private disconnectionHandlers: (() => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];

  private readonly url: string;
  private readonly reconnectDelay = 3000; // 3 seconds
  private readonly maxReconnectAttempts = 10;
  private reconnectAttempts = 0;

  constructor(url: string = 'ws://localhost:3001/ws') {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleError(new Error('Failed to create WebSocket connection'));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  send(message: BaseMessage): void {
    if (!this.isConnected) {
      console.warn('WebSocket not connected, queuing message:', message);
      // Could implement message queuing here
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      this.handleError(new Error('Failed to send message'));
    }
  }

  // Convenience methods for specific message types
  sendUserRequest(input: string, context?: any): void {
    const message: UserRequestMessage = {
      id: generateId(),
      type: MessageType.USER_REQUEST,
      timestamp: Date.now(),
      data: { input, context }
    };
    this.send(message);
  }

  // Event handlers
  onMessage(handler: MessageHandler<BaseMessage>): () => void {
    const id = generateId();
    this.messageHandlers.set(id, handler);
    return () => this.messageHandlers.delete(id);
  }

  onConnect(handler: () => void): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      const index = this.connectionHandlers.indexOf(handler);
      if (index > -1) {
        this.connectionHandlers.splice(index, 1);
      }
    };
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectionHandlers.push(handler);
    return () => {
      const index = this.disconnectionHandlers.indexOf(handler);
      if (index > -1) {
        this.disconnectionHandlers.splice(index, 1);
      }
    };
  }

  onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index > -1) {
        this.errorHandlers.splice(index, 1);
      }
    };
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.connectionHandlers.forEach(handler => handler());

      // Send ping to establish connection
      this.send({
        id: generateId(),
        type: MessageType.PING,
        timestamp: Date.now()
      });
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.disconnectionHandlers.forEach(handler => handler());

      // Attempt to reconnect unless it was a clean close
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      // Set connection status to disconnected immediately on error
      this.disconnectionHandlers.forEach(handler => handler());
      this.handleError(new Error('WebSocket connection error'));
    };

    this.ws.onmessage = (event) => {
      try {
        const message: BaseMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        this.handleError(new Error('Failed to parse message'));
      }
    };
  }

  private handleMessage(message: BaseMessage): void {
    // Handle system messages internally
    if (message.type === MessageType.PONG) {
      // Pong received, connection is healthy
      return;
    }

    // Forward message to all handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private handleError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);

    this.reconnectTimer = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, this.reconnectDelay);
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();