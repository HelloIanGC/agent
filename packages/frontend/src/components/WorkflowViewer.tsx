import React from 'react';
import { useAgentState } from '../store/useAppStore';

interface WorkflowViewerProps {
  // No props needed, will use store directly
}

const WorkflowViewer: React.FC<WorkflowViewerProps> = () => {
  const agentState = useAgentState();

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return '⭕';
      case 'thinking':
        return '🤔';
      case 'generating':
        return '⚡';
      case 'executing':
        return '🔄';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'text-gray-600 bg-gray-50';
      case 'thinking':
        return 'text-blue-600 bg-blue-50';
      case 'generating':
        return 'text-yellow-600 bg-yellow-50';
      case 'executing':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'idle':
        return '空闲';
      case 'thinking':
        return '分析中...';
      case 'generating':
        return '生成代码中...';
      case 'executing':
        return '执行中...';
      case 'error':
        return '出现错误';
      default:
        return '未知状态';
    }
  };

  if (agentState.status === 'idle' && !agentState.currentTask) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI工作流程</h2>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">🤖</div>
            <h3 className="text-lg font-medium mb-2">AI工作流就绪</h3>
            <p className="text-sm">输入自然语言指令开始操作</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">AI工作流程</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current Status */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">{getStatusIcon(agentState.status)}</span>
            <div>
              <h3 className="font-medium text-gray-900">当前状态</h3>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(agentState.status)}`}>
                {getStatusText(agentState.status)}
              </div>
            </div>
          </div>

          {agentState.currentTask && (
            <div className="mt-3 p-3 bg-gray-50 rounded border">
              <div className="text-sm font-medium text-gray-700 mb-1">当前任务</div>
              <div className="text-sm text-gray-900">{agentState.currentTask}</div>
            </div>
          )}
        </div>

        {/* Recent Generated Code */}
        {agentState.generatedCode.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">最新生成的代码</h4>
            <div className="space-y-2">
              {agentState.generatedCode.slice(-3).reverse().map((code) => (
                <div key={code.id} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{code.description}</span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(code.timestamp)}
                    </span>
                  </div>
                  <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
                    {code.code}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tool Calls */}
        {agentState.toolCalls.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">最新工具调用</h4>
            <div className="space-y-2">
              {agentState.toolCalls.slice(-3).reverse().map((toolCall) => (
                <div key={toolCall.id} className="border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">{toolCall.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        toolCall.status === 'success' ? 'bg-green-100 text-green-800' :
                        toolCall.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {toolCall.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(toolCall.timestamp)}
                    </span>
                  </div>

                  {toolCall.error && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      {toolCall.error}
                    </div>
                  )}

                  {toolCall.executionTime && (
                    <div className="text-xs text-gray-500">
                      执行时间: {toolCall.executionTime}ms
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Tools */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">可用工具</h4>
          <div className="grid grid-cols-2 gap-2">
            {agentState.availableTools.length > 0 ? (
              agentState.availableTools.map((tool, index) => (
                <div key={index} className="text-sm p-2 bg-gray-50 rounded border">
                  {tool}
                </div>
              ))
            ) : (
              <div className="col-span-2 text-sm text-gray-500 italic">
                暂无可用工具
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowViewer;