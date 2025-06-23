import React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  code: string;
  language?: string;
  height?: string;
  theme?: string;
  readOnly?: boolean;
  onCodeChange?: (code: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  language = 'javascript',
  height = '200px',
  theme = 'vs-dark',
  readOnly = true,
  onCodeChange
}) => {
  const handleEditorChange = (value: string | undefined) => {
    if (onCodeChange && value !== undefined) {
      onCodeChange(value);
    }
  };

  return (
    <div className="code-editor-container border rounded-lg overflow-hidden">
      <div className="bg-gray-800 text-white px-3 py-1 text-xs font-mono flex justify-between items-center">
        <span>{language.toUpperCase()}</span>
        <span className="text-gray-400">Generated Code</span>
      </div>
      <Editor
        height={height}
        language={language}
        value={code}
        theme={theme}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: 'on',
          folding: true,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          renderWhitespace: 'selection',
          guides: {
            bracketPairs: 'active'
          },
          smoothScrolling: true,
          cursorBlinking: 'blink',
          cursorSmoothCaretAnimation: 'on'
        }}
        onChange={handleEditorChange}
      />
    </div>
  );
};

export default CodeEditor;