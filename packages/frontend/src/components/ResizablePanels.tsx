import React from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  leftPanel,
  rightPanel,
}) => {
  return (
    <PanelGroup direction="horizontal" className="w-full h-full">
      <Panel defaultSize={40} minSize={25}>
        {leftPanel}
      </Panel>
      <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-blue-500 transition-colors duration-200" />
      <Panel minSize={30}>
        {rightPanel}
      </Panel>
    </PanelGroup>
  );
};

export default ResizablePanels;