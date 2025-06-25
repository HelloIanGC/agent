import React, { useState } from 'react';

// New component for collapsible JSON/string content
const CollapsibleResultViewer: React.FC<{ title: string; content: any; status: 'success' | 'error' }> = ({ title, content, status }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const summary = contentString.substring(0, 150) + (contentString.length > 150 ? '...' : '');

    const bgColor = status === 'success' ? 'bg-green-50' : 'bg-red-50';
    const textColor = status === 'success' ? 'text-green-800' : 'text-red-800';
    const borderColor = status === 'success' ? 'border-green-200' : 'border-red-200';

    return (
        <div className={`mt-2 border-t pt-2 ${borderColor}`}>
             <div className={`text-xs p-2 rounded ${bgColor}`}>
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <span className={`font-semibold ${textColor}`}>{title}</span>
                    <button className="text-xs text-gray-500 hover:text-gray-700">
                        {isExpanded ? '收起' : '展开'}
                    </button>
                </div>
                {isExpanded ? (
                    <pre className="whitespace-pre-wrap break-all mt-2">{contentString}</pre>
                ) : (
                    <p className="whitespace-pre-wrap break-all mt-2 text-gray-600">{summary}</p>
                )}
            </div>
        </div>
    );
};

export default CollapsibleResultViewer;