import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Code,
  Settings,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import CodeEditor from './CodeEditor';
import { useConnectionStatus, useAgentState } from '../store/useAppStore';

interface AgentStateViewerProps {
  // No props needed, will use store directly
}

// New component to render execute_spreadjs tool calls specifically
const ExecuteSpreadJSCall: React.FC<{ toolCall: any }> = ({ toolCall }) => {
  const [isResultExpanded, setIsResultExpanded] = useState(true);

  // Safely access nested properties
  const code = toolCall.args?.code || '';
  const validate = toolCall.args?.validate || '';
  const result = toolCall.result;
  const error = toolCall.error;

  const toggleResult = () => setIsResultExpanded(!isResultExpanded);

  return (
    <div className="mt-2 space-y-3 text-xs">
      {/* Code Section */}
      <div>
        <label className="block font-semibold text-gray-800 mb-1">执行代码:</label>
        <CodeEditor code={code} language="javascript" readOnly />
      </div>

      {/* Validate Section */}
      {validate && (
        <div>
          <label className="block font-semibold text-gray-800 mb-1">验证逻辑:</label>
          <CodeEditor code={validate} language="javascript" readOnly />
        </div>
      )}

      {/* Result Section */}
      {(result || error) && (
        <div className="mt-2">
          <button
            onClick={toggleResult}
            className="w-full flex items-center justify-between text-left font-semibold text-gray-800"
          >
            执行结果:
            {isResultExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {isResultExpanded && (
            <pre
              className={`p-2 rounded border overflow-x-auto text-xs mt-1 ${
                result?.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              {JSON.stringify(result || error, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

const AgentStateViewer: React.FC<AgentStateViewerProps> = () => {
  const connectionStatus = useConnectionStatus();
  const agentState = useAgentState();
  const [expandedSections, setExpandedSections] = useState({
    tools: true,
    toolCalls: true,
    generatedCode: true
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-green-300 bg-green-50';
      case 'error':
        return 'border-red-300 bg-red-50';
      case 'pending':
        return 'border-yellow-300 bg-yellow-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Agent 状态监控</h2>
        <div className={`mt-1 text-sm font-medium ${
          connectionStatus === 'connected' ? 'text-green-600' :
          connectionStatus === 'connecting' ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          状态: {connectionStatus === 'connected' ? '已连接' :
                connectionStatus === 'connecting' ? '连接中' : '已断开'}
        </div>
        {agentState.currentTask && (
          <div className="mt-1 text-sm text-gray-600">
            当前任务: {agentState.currentTask}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Available Tools */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('tools')}
            className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span className="font-medium">可用工具 ({agentState.availableTools.length})</span>
            </div>
            {expandedSections.tools ?
              <ChevronDown className="w-4 h-4" /> :
              <ChevronRight className="w-4 h-4" />
            }
          </button>

          {expandedSections.tools && (
            <div className="p-3 space-y-2">
              {agentState.availableTools.length === 0 ? (
                <div className="text-sm text-gray-500 italic">暂无可用工具</div>
              ) : (
                agentState.availableTools.map((toolName, index) => (
                  <div key={index} className="text-sm p-2 bg-gray-50 rounded border">
                    <div className="font-medium">{toolName}</div>
                    <div className="text-gray-600 text-xs mt-1">
                      {toolName === 'query_context7' && '查询Context7文档和代码示例'}
                      {toolName === 'query_spreadjs' && '执行SpreadJS查询操作'}
                      {toolName === 'execute_spreadjs' && '执行SpreadJS操作代码'}
                      {toolName === 'query_user' && '确认用户意图'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Tool Calls History */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('toolCalls')}
            className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          >
            <div className="flex items-center space-x-2">
              <Code className="w-4 h-4" />
              <span className="font-medium">工具调用历史 ({agentState.toolCalls.length})</span>
            </div>
            {expandedSections.toolCalls ?
              <ChevronDown className="w-4 h-4" /> :
              <ChevronRight className="w-4 h-4" />
            }
          </button>

          {expandedSections.toolCalls && (
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {agentState.toolCalls.length === 0 ? (
                <div className="text-sm text-gray-500 italic">暂无工具调用</div>
              ) : (
                agentState.toolCalls.slice().reverse().map((toolCall) => (
                  <div key={toolCall.id} className={`p-2 rounded border ${getStatusColor(toolCall.status)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(toolCall.status)}
                        <span className="font-medium text-sm">{toolCall.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {toolCall.timestamp && (
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(toolCall.timestamp)}
                          </span>
                        )}
                        <button
                          onClick={() => toggleItem(toolCall.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expandedItems[toolCall.id] ?
                            <ChevronDown className="w-3 h-3" /> :
                            <ChevronRight className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    </div>

                    {expandedItems[toolCall.id] && (
                      toolCall.name === 'execute_spreadjs' ? (
                        <ExecuteSpreadJSCall toolCall={toolCall} />
                      ) : (
                        <div className="mt-2 space-y-2 text-xs">
                          {toolCall.args && (
                            <div>
                              <div className="font-medium text-gray-700">参数:</div>
                              <pre className="bg-white p-2 rounded border overflow-x-auto">
                                {JSON.stringify(toolCall.args, null, 2)}
                              </pre>
                            </div>
                          )}
                          {toolCall.result && (
                            <div>
                              <div className="font-medium text-gray-700">结果:</div>
                              <pre className="bg-white p-2 rounded border overflow-x-auto max-h-32">
                                {JSON.stringify(toolCall.result, null, 2)}
                              </pre>
                            </div>
                          )}
                          {toolCall.error && (
                            <div>
                              <div className="font-medium text-gray-700">错误:</div>
                              <pre className="bg-white p-2 rounded border text-red-600 overflow-x-auto">
                                {JSON.stringify(toolCall.error, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Generated Code */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('generatedCode')}
            className="w-full px-3 py-2 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg"
          >
            <div className="flex items-center space-x-2">
              <Code className="w-4 h-4" />
              <span className="font-medium">生成的代码 ({agentState.generatedCode.length})</span>
            </div>
            {expandedSections.generatedCode ?
              <ChevronDown className="w-4 h-4" /> :
              <ChevronRight className="w-4 h-4" />
            }
          </button>

          {expandedSections.generatedCode && (
            <div className="p-3 space-y-3">
              {agentState.generatedCode.length === 0 ? (
                <div className="text-sm text-gray-500 italic">暂无生成的代码</div>
              ) : (
                agentState.generatedCode.slice().reverse().map((codeItem, index) => (
                  <div key={index} className="border border-gray-200 rounded">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{codeItem.description}</span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(codeItem.timestamp)}
                        </span>
                      </div>
                    </div>
                    <div className="p-2">
                      <CodeEditor
                        code={codeItem.code}
                        language="javascript"
                        height="150px"
                        theme="vs-light"
                        readOnly={true}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentStateViewer;