import React, { useEffect, useRef, useState } from 'react';
import * as GC from '@grapecity/spread-sheets';
import '@grapecity/spread-sheets/styles/gc.spread.sheets.excel2013white.css';
import { useAppStore } from '../store/useAppStore';

// Extend window interface for global access
declare global {
  interface Window {
    spread: GC.Spread.Sheets.Workbook;
  }
}

interface SpreadSheetComponentProps {
  onReady: () => void;
}

const SpreadSheetComponent: React.FC<SpreadSheetComponentProps> = ({ onReady }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workbookRef = useRef<GC.Spread.Sheets.Workbook | null>(null);
  const { setSpreadJSInitialized } = useAppStore();

  // console.log('SpreadSheetComponent render - isLoading:', isLoading, 'error:', error);

  useEffect(() => {
    console.log('SpreadJS useEffect triggered');

    // Prevent duplicate initialization
    if (workbookRef.current) {
      console.log('SpreadJS already initialized, skipping...');
      return;
    }

    const initSpreadJS = () => {
      if (!containerRef.current) {
        console.error('Container ref is null');
        setError('Container not found');
        setIsLoading(false);
        return;
      }

      // Double check to prevent race conditions
      if (workbookRef.current) {
        console.log('Workbook already exists, aborting initialization');
        return;
      }

      console.log('Container found:', containerRef.current);
      console.log('Container dimensions:', {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });

      try {
        console.log('Creating SpreadJS workbook...');

        // Clear any existing content
        containerRef.current.innerHTML = '';

        const workbook = new GC.Spread.Sheets.Workbook(containerRef.current, {
          sheetCount: 1,
          allowUserResize: true,
          allowUserZoom: true,
          newTabVisible: false,
          tabStripVisible: true,
          allowSheetReorder: false,
          allowContextMenu: true
        });

        console.log('SpreadJS workbook created successfully:', workbook);

        // Store references
        workbookRef.current = workbook;
        window.spread = workbook;

        // Get the active sheet
        const sheet = workbook.getActiveSheet();
        console.log('Active sheet:', sheet);

        if (!sheet) {
          throw new Error('Failed to get active sheet');
        }

        // Add some test data (without problematic formatting)
        sheet.setValue(0, 0, 'SpreadJS AI Agent System');
        sheet.setValue(1, 0, '欢迎使用SpreadJS AI助手');
        sheet.setValue(2, 0, '请通过聊天界面与AI助手交互');
        sheet.setValue(3, 0, 'System Ready!');

        // Set column width for better display
        sheet.setColumnWidth(0, 300);

        console.log('Sample data added successfully');

        // Force a repaint
        workbook.repaint();

        console.log('Workbook repainted');

        setSpreadJSInitialized(true);
        setIsLoading(false);
        onReady();

        console.log('SpreadJS initialization complete');

      } catch (err) {
        console.error('Error initializing SpreadJS:', err);
        console.error('Error stack:', err instanceof Error ? err.stack : 'No stack');
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        setIsLoading(false);
      }
    };

    // Start initialization with delay
    const timer = setTimeout(initSpreadJS, 200);

    return () => {
      clearTimeout(timer);
      console.log('Cleanup called');

      // Only destroy if we have a workbook and it's not already being cleaned up
      if (workbookRef.current) {
        try {
          workbookRef.current.destroy();
        } catch (err) {
          console.warn('Error destroying workbook:', err);
        }
        workbookRef.current = null;
      }
    };
  }, []); // Empty dependency array to prevent re-runs

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-50">
        <div className="text-center p-4">
          <div className="text-red-600 font-semibold">SpreadJS Error</div>
          <div className="text-red-500 text-sm mt-1">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white relative">
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{
          minHeight: '400px',
          position: 'relative'
        }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
          <div className="text-center">
            <div className="text-gray-600">Loading SpreadJS...</div>
            <div className="text-xs text-gray-400 mt-1">正在初始化电子表格组件</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpreadSheetComponent;