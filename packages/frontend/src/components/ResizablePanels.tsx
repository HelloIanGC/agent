import React, { useState, useRef, useCallback, ReactNode } from 'react';

interface ResizablePanelsProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  leftInitialWidth?: number;
  rightInitialWidth?: number;
  leftMinWidth?: number;
  rightMinWidth?: number;
  leftMaxWidth?: number;
  rightMaxWidth?: number;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  leftInitialWidth = 320,
  rightInitialWidth = 350,
  leftMinWidth = 250,
  rightMinWidth = 300,
  leftMaxWidth = 500,
  rightMaxWidth = 600
}) => {
  const [leftWidth, setLeftWidth] = useState(leftInitialWidth);
  const [rightWidth, setRightWidth] = useState(rightInitialWidth);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftStartX = useRef<number>(0);
  const rightStartX = useRef<number>(0);
  const leftStartWidth = useRef<number>(0);
  const rightStartWidth = useRef<number>(0);

  // 处理左侧分割器拖拽移动
  const handleLeftMouseMove = useCallback((e: MouseEvent) => {
    const deltaX = e.clientX - leftStartX.current;
    const newWidth = leftStartWidth.current + deltaX;

    // 限制在最小值和最大值之间
    const clampedWidth = Math.min(Math.max(newWidth, leftMinWidth), leftMaxWidth);
    setLeftWidth(clampedWidth);
  }, [leftMinWidth, leftMaxWidth]);

  // 处理右侧分割器拖拽移动
  const handleRightMouseMove = useCallback((e: MouseEvent) => {
    const deltaX = rightStartX.current - e.clientX; // 注意方向相反
    const newWidth = rightStartWidth.current + deltaX;

    // 限制在最小值和最大值之间
    const clampedWidth = Math.min(Math.max(newWidth, rightMinWidth), rightMaxWidth);
    setRightWidth(clampedWidth);
  }, [rightMinWidth, rightMaxWidth]);

  // 处理左侧分割器拖拽结束
  const handleLeftMouseUp = useCallback(() => {
    setIsResizingLeft(false);
    document.removeEventListener('mousemove', handleLeftMouseMove);
    document.removeEventListener('mouseup', handleLeftMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleLeftMouseMove]);

  // 处理右侧分割器拖拽结束
  const handleRightMouseUp = useCallback(() => {
    setIsResizingRight(false);
    document.removeEventListener('mousemove', handleRightMouseMove);
    document.removeEventListener('mouseup', handleRightMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleRightMouseMove]);

  // 处理左侧分割器拖拽开始
  const handleLeftMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    leftStartX.current = e.clientX;
    leftStartWidth.current = leftWidth;

    document.addEventListener('mousemove', handleLeftMouseMove);
    document.addEventListener('mouseup', handleLeftMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth, handleLeftMouseMove, handleLeftMouseUp]);

  // 处理右侧分割器拖拽开始
  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    rightStartX.current = e.clientX;
    rightStartWidth.current = rightWidth;

    document.addEventListener('mousemove', handleRightMouseMove);
    document.addEventListener('mouseup', handleRightMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightWidth, handleRightMouseMove, handleRightMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* 左侧面板 */}
      <div
        className="flex-shrink-0 bg-white border-r border-gray-300"
        style={{ width: `${leftWidth}px` }}
      >
        {leftPanel}
      </div>

      {/* 左侧分割器 */}
      <div
        className={`w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 group relative ${
          isResizingLeft ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleLeftMouseDown}
      >
        {/* 拖拽指示器 */}
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
        </div>
      </div>

      {/* 中心面板 */}
      <div className="flex-1 min-w-0">
        {centerPanel}
      </div>

      {/* 右侧分割器 */}
      <div
        className={`w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 group relative ${
          isResizingRight ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleRightMouseDown}
      >
        {/* 拖拽指示器 */}
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
        </div>
      </div>

      {/* 右侧面板 */}
      <div
        className="flex-shrink-0 bg-white border-l border-gray-300"
        style={{ width: `${rightWidth}px` }}
      >
        {rightPanel}
      </div>

      {/* 拖拽时的遮罩层 */}
      {(isResizingLeft || isResizingRight) && (
        <div className="fixed inset-0 z-50 cursor-col-resize" style={{ pointerEvents: 'none' }} />
      )}
    </div>
  );
};

export default ResizablePanels;