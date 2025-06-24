import React, { useState, useEffect } from 'react';
import { useConversation, useAgentState, useAppStore } from '../store/useAppStore';
import CodeEditor from './CodeEditor';

interface ChatInterfaceProps {
  onUserInput: (input: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onUserInput }) => {
  const [input, setInput] = useState('');
  const [expandedThinking, setExpandedThinking] = useState(true);
  const conversation = useConversation();
  const agentState = useAgentState();
  const { clearConversation, clearAgentHistory } = useAppStore();

  const handleSubmit = () => {
    if (input.trim()) {
      onUserInput(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">SpreadJS AI助手</h3>
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
        <p className="text-sm text-gray-600">
          输入自然语言指令来操作电子表格
        </p>
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

            {/* Real-time AI thinking process */}
            {(agentState.status !== 'idle' || agentState.toolCalls.length > 0) && (
              <div className="border border-gray-200 rounded-lg p-3 bg-blue-50">
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
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-600 mb-1">当前请求的AI工具调用过程：</div>
                    {(() => {
                      // 获取当前请求的工具调用（按时间戳分组，显示最近的一组）
                      const currentRequestToolCalls = agentState.toolCalls.slice(-3);
                      // 按时间正序排列（最早的在上面，最新的在下面）
                      const sortedToolCalls = [...currentRequestToolCalls].sort((a, b) =>
                        (a.timestamp || 0) - (b.timestamp || 0)
                      );

                      return sortedToolCalls.map((toolCall, index) => (
                        <div key={toolCall.id} className="text-xs bg-white rounded p-2 border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-700">
                              {index + 1}. {toolCall.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              toolCall.status === 'success' ? 'bg-green-100 text-green-700' :
                              toolCall.status === 'error' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {toolCall.status === 'success' ? '✓ 成功' :
                               toolCall.status === 'error' ? '✗ 失败' : '⏳ 进行中'}
                            </span>
                          </div>
                          {toolCall.error && (
                            <div className="text-red-600 text-xs mt-1">
                              错误: {toolCall.error}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}

                {expandedThinking && agentState.generatedCode.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-600 mb-1">最新生成的代码：</div>
                    <div className="bg-white rounded border">
                      <CodeEditor
                        code={agentState.generatedCode[agentState.generatedCode.length - 1]?.code || ''}
                        language="javascript"
                        height="80px"
                        theme="vs-light"
                        readOnly={true}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-300">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的自然语言指令..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>

        <div className="text-xs text-gray-400 text-center mt-2">
          由本地AI工作流系统处理
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;