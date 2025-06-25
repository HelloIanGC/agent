import { useEffect, useMemo } from 'react';
import SpreadSheetComponent from './components/SpreadSheetComponent';
import ResizablePanels from './components/ResizablePanels';
import { useAppStore } from './store/useAppStore';
import { WebSocketService } from './services/WebSocketService';
import { WebSocketMessage } from '../../shared/types';
import ChatInterface from './components/ChatInterface';

function App() {
    const {
        setAgentStatus,
        addToolCall,
        updateToolCall,
    } = useAppStore();

    const webSocketService = useMemo(() => new WebSocketService(), []);

    useEffect(() => {
        webSocketService.connect();

        const unsubscribe = webSocketService.onMessage((message: WebSocketMessage) => {
            switch (message.type) {
                case 'agent_status_update':
                    setAgentStatus(message.data);
                    break;
                case 'tool_call_add':
                    addToolCall(message.data);
                    break;
                case 'tool_call_update':
                    updateToolCall(message.data.id, message.data);
                    break;
                case 'ai_message':
                    useAppStore.getState().addAIMessage(message.data.content, message.data.metadata);
                    break;
            }
        });

        return () => {
            unsubscribe();
            webSocketService.disconnect();
        };
    }, [webSocketService, setAgentStatus, addToolCall, updateToolCall]);


    return (
        <div className="h-screen w-screen bg-gray-100 flex flex-col">
            <header className="bg-white border-b border-gray-200 p-2 text-center text-sm font-semibold text-gray-700 shadow-sm">
                SpreadJS AI Agent Prototype
            </header>
            <main className="flex-1 overflow-hidden">
                <ResizablePanels
                    leftPanel={<ChatInterface webSocketService={webSocketService} />}
                    rightPanel={<SpreadSheetComponent webSocketService={webSocketService} />}
                />
            </main>
        </div>
    );
}

export default App;