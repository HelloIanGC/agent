import React, { useEffect, useRef, useState } from 'react';
import * as GC from '@grapecity/spread-sheets';
import '@grapecity/spread-sheets/styles/gc.spread.sheets.excel2013white.css';
import { useAppStore } from '../store/useAppStore';

// Extend window interface for global access
declare global {
  interface Window {
    spread: GC.Spread.Sheets.Workbook;
    GC: typeof GC;
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
        window.GC = GC;

        // Get the active sheet
        const sheet = workbook.getActiveSheet();
        console.log('Active sheet:', sheet);

        if (!sheet) {
          throw new Error('Failed to get active sheet');
        }

        workbook.suspendPaint();

        // 创建汽车销售数据集
        // 表头
        const headers = [['销售日期', '品牌', '车型', '颜色', '价格(万元)', '销售员', '客户类型', '销售渠道', '优惠金额(万元)', '净销售额(万元)']];
        sheet.setArray(0, 0, headers);

        // 汽车销售数据
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

        // 填充数据
        salesData.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            const actualRow = rowIndex + 1;
            // 设置数字格式
            if (colIndex === 4 || colIndex === 8 || colIndex === 9) { // 价格列
              sheet.getCell(actualRow, colIndex).formatter('¥#,##0.0');
            }

            // 设置日期格式
            if (colIndex === 0) {
              sheet.getCell(actualRow, colIndex).formatter('yyyy-mm-dd');
            }
          });
        });

        // 设置列宽
        const columnWidths = [100, 80, 120, 80, 100, 80, 90, 100, 110, 110];
        columnWidths.forEach((width, index) => {
          sheet.setColumnWidth(index, width);
        });

        // Force a repaint
        workbook.resumePaint();

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