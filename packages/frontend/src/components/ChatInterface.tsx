import React, { useState } from 'react';
import { useConversation } from '../store/useAppStore';
import CodeEditor from './CodeEditor';

interface ChatInterfaceProps {
  onUserInput: (input: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onUserInput }) => {
  const [input, setInput] = useState('');
  const conversation = useConversation();

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-300">
        <h3 className="text-lg font-semibold mb-2">SpreadJS AI助手</h3>
        <p className="text-sm text-gray-600">
          输入自然语言指令来操作电子表格
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.length === 0 ? (
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
          conversation.map((message) => (
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
          ))
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