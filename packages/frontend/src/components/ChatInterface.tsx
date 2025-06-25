import React, { useState, useEffect, useRef } from 'react';
import {
  Code,
  MessageSquare,
  Paperclip,
} from 'lucide-react';

import { useConversation, useAgentState, useAppStore } from '../store/useAppStore';
import CodeEditor from './CodeEditor';
import { WebSocketService } from '../services/WebSocketService';
import CollapsibleResultViewer from './viewers/CollapsibleResultViewer';
import ExecuteSpreadJSCallViewer from './viewers/ExecuteSpreadJSCallViewer';

interface ChatInterfaceProps {
  webSocketService: WebSocketService;
}

// THIS IS WHERE THE OLD COMPONENT DEFINITIONS WERE. THEY ARE NOW DELETED.

const ChatInterface: React.FC<ChatInterfaceProps> = ({ webSocketService }) => {
  const [input, setInput] = useState('');
  const [expandedThinking, setExpandedThinking] = useState(true);
  const conversation = useConversation();
  const agentState = useAgentState();
  const { clearConversation, clearAgentHistory } = useAppStore();
  const addUserMessage = useAppStore((s) => s.addUserMessage);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() === '') return;

    clearAgentHistory();
    addUserMessage(input);

    webSocketService.sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  // Auto-collapse thinking process when task completes
  useEffect(() => {
    if (agentState.status === 'idle' && agentState.toolCalls.length > 0) {
      // Auto-collapse after 3 seconds when task completes
      const timer = setTimeout(() => {
        setExpandedThinking(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (agentState.status !== 'idle') {
      // Auto-expand when AI starts working
      setExpandedThinking(true);
    }
  }, [agentState.status, agentState.toolCalls.length]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">SpreadJS AI助手</h3>
          {(conversation.length > 0 || agentState.toolCalls.length > 0) && (
            <button
              onClick={() => {
                clearConversation();
                clearAgentHistory();
              }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
            >
              清除历史
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          输入自然语言指令来操作电子表格
        </p>

        {/* Available Tools Section */}
        {agentState.availableTools.length > 0 && (
            <div className="mt-3">
                <h4 className="text-xs font-semibold text-gray-600 mb-1">可用工具:</h4>
                <div className="flex flex-wrap gap-2">
                    {agentState.availableTools.map(tool => (
                        <span key={tool} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            {tool}
                        </span>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.length === 0 && agentState.status === 'idle' ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm mb-4">开始与AI助手对话</p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>示例指令：</p>
              <p>• "修改A1的值为100"</p>
              <p>• "给A列的数据按升序排列"</p>
              <p>• "在C列计算A列和B列的乘积"</p>
            </div>
          </div>
        ) : (
          <>
            {/* Display conversation history */}
            {conversation.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`${
                    message.metadata?.codeGenerated ? 'max-w-2xl' : 'max-w-xs'
                  } px-3 py-2 rounded-lg text-sm ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div>{message.content}</div>
                  <div className={`text-xs mt-1 ${
                    message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTimestamp(message.timestamp)}
                  </div>

                  {/* Show generated code if available */}
                  {message.metadata?.codeGenerated && (
                    <div className="mt-3">
                      <div className={`text-xs mb-1 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-600'
                      }`}>
                        生成的代码：
                      </div>
                      <CodeEditor
                        code={message.metadata.codeGenerated}
                        language="javascript"
                        height="120px"
                        theme="vs-dark"
                        readOnly={true}
                      />
                    </div>
                  )}

                  {/* Show execution result if available */}
                  {message.metadata?.executionResult && (
                    <div className={`mt-2 p-2 text-xs rounded ${
                      message.metadata.executionResult.success
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {message.metadata.executionResult.success
                        ? '✓ 执行成功'
                        : `✗ 执行失败: ${message.metadata.executionResult.error}`
                      }
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Real-time AI Task Progress */}
            {(agentState.status !== 'idle' || agentState.toolCalls.length > 0) && (
              <div className="border-t border-gray-200 p-4 bg-blue-50/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      agentState.status === 'thinking' ? 'bg-blue-500 animate-pulse' :
                      agentState.status === 'generating' ? 'bg-yellow-500 animate-pulse' :
                      agentState.status === 'executing' ? 'bg-green-500 animate-pulse' :
                      agentState.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-700">
                      {agentState.status === 'thinking' && '🤔 AI正在分析您的请求...'}
                      {agentState.status === 'generating' && '⚡ AI正在生成代码...'}
                      {agentState.status === 'executing' && '🔄 正在执行操作...'}
                      {agentState.status === 'error' && '❌ 处理过程中出现错误'}
                      {agentState.status === 'idle' && agentState.toolCalls.length > 0 && '✅ 处理完成'}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedThinking(!expandedThinking)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {expandedThinking ? '收起' : '展开'}
                  </button>
                </div>

                {agentState.currentTask && (
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">当前任务：</span>{agentState.currentTask}
                  </div>
                )}

                {expandedThinking && agentState.toolCalls.length > 0 && (
                  <div className="space-y-3">
                    {agentState.toolCalls.map((toolCall) => (
                      <div key={toolCall.id} className="text-sm bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2 font-medium text-gray-800">
                            {toolCall.name === 'query_context7' && <Paperclip className="w-4 h-4 text-blue-500" />}
                            {toolCall.name === 'execute_spreadjs' && <Code className="w-4 h-4 text-purple-500" />}
                            {toolCall.name === 'query_user' && <MessageSquare className="w-4 h-4 text-orange-500" />}
                            <span>{toolCall.name}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            toolCall.status === 'success' ? 'bg-green-100 text-green-800' :
                            toolCall.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800 animate-pulse'
                          }`}>
                            {toolCall.status}
                          </span>
                        </div>

                        {/* Conditional rendering for different tools */}
                        {toolCall.name === 'execute_spreadjs' ? (
                          <ExecuteSpreadJSCallViewer toolCall={toolCall} />
                        ) : (
                          <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(toolCall.args, null, 2)}
                          </pre>
                        )}

                        {/* Display result/error for all tools */}
                        {toolCall.status !== 'pending' && (toolCall.result || toolCall.error) && (
                            <CollapsibleResultViewer
                                title={toolCall.status === 'success' ? 'Result' : 'Error'}
                                content={toolCall.result || toolCall.error}
                                status={toolCall.status}
                            />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-gray-200">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的自然语言指令..."
            className="w-full p-3 pr-24 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
            rows={1}
          />
          <button
            onClick={handleSend}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </div>
        <div className="text-center text-xs text-gray-400 mt-2">
          由本地AI工作流系统处理
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;