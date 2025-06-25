import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import CodeEditor from '../CodeEditor';
import { ToolCall } from '../../../../shared/types';

const ExecuteSpreadJSCallViewer: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  const [isCodeExpanded, setIsCodeExpanded] = useState(true);
  const [isValidationExpanded, setIsValidationExpanded] = useState(false);

  const code = toolCall.args?.code || '';
  const validate = toolCall.args?.validate || '';

  return (
    <div className="mt-2 space-y-2 text-xs">
      <div className="bg-gray-50 border border-gray-200 rounded">
        <button
          onClick={() => setIsCodeExpanded(!isCodeExpanded)}
          className="w-full flex items-center justify-between p-2 text-left font-medium text-gray-700 hover:bg-gray-100"
        >
          <span>执行代码</span>
          {isCodeExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {isCodeExpanded && <div className="p-2"><CodeEditor code={code} language="javascript" readOnly /></div>}
      </div>

      {validate && (
        <div className="bg-gray-50 border border-gray-200 rounded">
          <button
            onClick={() => setIsValidationExpanded(!isValidationExpanded)}
            className="w-full flex items-center justify-between p-2 text-left font-medium text-gray-700 hover:bg-gray-100"
          >
            <span>验证逻辑</span>
            {isValidationExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {isValidationExpanded && <div className="p-2"><CodeEditor code={validate} language="javascript" readOnly /></div>}
        </div>
      )}
    </div>
  );
};

export default ExecuteSpreadJSCallViewer;