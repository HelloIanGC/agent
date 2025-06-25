import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as GC from '@grapecity/spread-sheets';
import '@grapecity/spread-sheets/styles/gc.spread.sheets.excel2013white.css';
import { useAppStore } from '../store/useAppStore';
import { WebSocketService } from '../services/WebSocketService';

// Extend window interface for global access
declare global {
  interface Window {
    spread: GC.Spread.Sheets.Workbook | null;
    GC: typeof GC;
  }
}

interface SpreadSheetComponentProps {
  webSocketService: WebSocketService;
}

const SpreadSheetComponent: React.FC<SpreadSheetComponentProps> = ({ webSocketService }) => {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const workbookRef = useRef<GC.Spread.Sheets.Workbook | null>(null);
  const { setSpreadJSInitialized } = useAppStore();

  const handleToolCall = useCallback((message: any) => {
    const { id: toolCallId, name, args } = message.data;
    console.log(`🚀 FRONTEND: Received tool call ${name} (${toolCallId}) with args:`, args);

    try {
      if (!window.spread) throw new Error('SpreadJS is not initialized.');

      switch (name) {
        case 'query_context7': {
            // This tool should be handled by the backend.
            // If it reaches the frontend, it's a logic error.
            // We'll send back an error to unblock the agent flow.
            const errorMsg = "Error: query_context7 cannot be executed on the frontend.";
            console.error(`❌ FRONTEND: Failed ${toolCallId}`, errorMsg);
            webSocketService.send({
                type: 'tool_response',
                data: { id: toolCallId, error: errorMsg }
            });
            break;
        }

        case 'execute_spreadjs': {
          const { code, validate } = args;
          const executeFunction = new Function('spread', 'GC', code);
          executeFunction(window.spread, window.GC);

          const validateFunction = new Function('spread', 'GC', `var sheet = spread.getActiveSheet(); ${validate}`);
          const result = validateFunction(window.spread, window.GC);

          console.log(`✅ FRONTEND: Success ${toolCallId}`, result);
          webSocketService.send({
            type: 'tool_response',
            data: { id: toolCallId, result: { success: true, result } }
          });
          break;
        }

        case 'query_spreadjs': {
          const { queries } = args;
          const results = queries.map((query: string) => {
            try {
              const executeFunction = new Function('spread', 'GC', `return (() => { ${query} })();`);
              const result = executeFunction(window.spread, window.GC);
              return { success: true, result };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              return { success: false, error: errorMessage };
            }
          });

          console.log(`✅ FRONTEND: Success ${toolCallId}`, results);
          webSocketService.send({
            type: 'tool_response',
            data: { id: toolCallId, result: results }
          });
          break;
        }

        case 'query_user': {
          const { question } = args;
          const answer = prompt(question);
          webSocketService.send({
            type: 'tool_response',
            data: { id: toolCallId, result: { answer: answer || '' } }
          });
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ FRONTEND: Failed ${toolCallId}`, errorMessage);
      webSocketService.send({
        type: 'tool_response',
        data: { id: toolCallId, error: errorMessage }
      });
    }
  }, [webSocketService]);

  useEffect(() => {
    const unsubscribe = webSocketService.onMessage((message) => {
      if (message.type === 'tool_call') {
        handleToolCall(message);
      }
    });
    return () => unsubscribe();
  }, [webSocketService, handleToolCall]);

  useEffect(() => {
    if (!containerRef.current || workbookRef.current) return; // Prevent re-initialization

    // The license key is expected to be set globally now, perhaps in index.html or another script
    // GC.Spread.Sheets.LicenseKey = licenseKey;

    const workbook = new GC.Spread.Sheets.Workbook(containerRef.current);
    workbookRef.current = workbook;
    window.spread = workbook;
    window.GC = GC;

    const sheet = workbook.getActiveSheet();
    workbook.suspendPaint();

    // Re-add car sales data
    const headers = [['销售日期', '品牌', '车型', '颜色', '价格(万元)', '销售员', '客户类型', '销售渠道', '优惠金额(万元)', '净销售额(万元)']];
    sheet.setArray(0, 0, headers);
    const salesData = [
        ['2024-01-15', '奔驰', 'C 200L', '珍珠白', 35.8, '张明', '个人客户', '4S店', 2.5, 33.3],
        ['2024-01-16', '宝马', 'X3 xDrive25i', '矿石灰', 42.5, '李华', '企业客户', '4S店', 3.2, 39.3],
        ['2024-01-18', '奥迪', 'A4L 40 TFSI', '曜石黑', 32.8, '王强', '个人客户', '在线销售', 1.8, 31.0],
        ['2024-01-20', '特斯拉', 'Model 3', '珍珠白', 26.1, '赵敏', '个人客户', '官网直销', 0.0, 26.1],
        ['2024-01-22', '比亚迪', '汉EV', '苍穹灰', 22.9, '陈刚', '个人客户', '4S店', 1.2, 21.7],
        ['2024-01-25', '蔚来', 'ES6', '星云紫', 39.8, '刘洋', '个人客户', '服务中心', 2.0, 37.8],
        ['2024-01-28', '丰田', '凯美瑞', '极地白', 21.9, '杨丽', '企业客户', '4S店', 1.5, 20.4],
        ['2024-01-30', '本田', '雅阁', '奥夫特黑', 18.9, '周涛', '个人客户', '4S店', 1.0, 17.9],
        ['2024-02-02', '奔驰', 'GLC 260L', '极地白', 45.2, '张明', '个人客户', '4S店', 3.5, 41.7],
        ['2024-02-05', '宝马', '5系 525Li', '碳黑色', 46.8, '李华', '企业客户', '4S店', 4.0, 42.8],
        ['2024-02-08', '理想', 'L9', '银色', 45.9, '马超', '个人客户', '服务中心', 2.5, 43.4],
        ['2024-02-10', '小鹏', 'G9', '星河银', 35.9, '孙悟', '个人客户', '服务中心', 1.8, 34.1],
        ['2024-02-12', '特斯拉', 'Model Y', '深海蓝', 30.1, '赵敏', '个人客户', '官网直销', 0.0, 30.1],
        ['2024-02-15', '奥迪', 'Q5L 40 TFSI', '探戈红', 41.2, '王强', '企业客户', '4S店', 2.8, 38.4],
        ['2024-02-18', '凯迪拉克', 'XT5', '钻石黑', 32.5, '胡斌', '个人客户', '4S店', 2.2, 30.3],
        ['2024-02-20', '沃尔沃', 'XC60', '雷神之锤蓝', 38.7, '吴刚', '个人客户', '4S店', 2.5, 36.2],
        ['2024-02-22', '雷克萨斯', 'ES 300h', '珍珠白', 33.8, '朱红', '个人客户', '4S店', 1.5, 32.3],
        ['2024-02-25', '保时捷', 'Macan', '火山橙', 62.3, '钱进', '个人客户', '4S店', 3.8, 58.5],
        ['2024-02-28', '路虎', '揽胜极光', '富士白', 41.9, '孙丽', '企业客户', '4S店', 3.2, 38.7],
        ['2024-03-01', '捷豹', 'XEL', '圣托里尼黑', 28.9, '周明', '个人客户', '4S店', 2.0, 26.9]
    ];
    sheet.setArray(1, 0, salesData);

    // Formatting and column widths
    const columnWidths = [100, 80, 120, 80, 100, 80, 90, 100, 110, 110];
    columnWidths.forEach((width, index) => sheet.setColumnWidth(index, width));

    workbook.resumePaint();

    setSpreadJSInitialized(true);
    setIsLoading(false);

  }, [setSpreadJSInitialized]);

  return (
    <div className="h-full w-full flex flex-col">
      {isLoading && <div className="p-2 text-sm text-gray-500">Loading SpreadJS...</div>}
      <div ref={containerRef} className="flex-1 w-full h-full" />
    </div>
  );
};

export default SpreadSheetComponent;