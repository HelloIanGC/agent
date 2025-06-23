import { Context7Response, Context7Document } from './types.js';

export class Context7Client {
  private baseUrl = 'https://context7.com/api/v1/llmstxt';
  private spreadjsDocUrl = 'gist_githubusercontent_com-shutongx-99f7b888d6abe65cc9b38f01a54b018d-raw-9559badf7caf04430cd7de20b8aadf125e3bd038-llms.txt';

  // Fallback SpreadJS API reference
  private fallbackApiReference = {
    setValue: 'spread.getActiveSheet().setValue(row, col, value)',
    getValue: 'spread.getActiveSheet().getValue(row, col)',
    getSelections: 'spread.getActiveSheet().getSelections()',
    setSelections: 'spread.getActiveSheet().setSelections(selections)',
    backColor: 'sheet.getRange(row, col, rowCount, colCount).backColor(color)',
    foreColor: 'sheet.getRange(row, col, rowCount, colCount).foreColor(color)',
    setFormula: 'sheet.setFormula(row, col, formula)',
    sort: 'sheet.sort(row, col, rowCount, colCount, sortInfo)',
    charts: 'sheet.charts.add(name, type, x, y, width, height, dataRange)'
  };

  async querySpreadJSDocumentation(
    topic: string,
    maxTokens: number = 2000
  ): Promise<Context7Response> {
    try {
      const url = `${this.baseUrl}/${this.spreadjsDocUrl}?type=json&tokens=${maxTokens}&topic=${encodeURIComponent(topic)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'content-type': 'application/json',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        }
      });

      if (!response.ok) {
        throw new Error(`Context7 API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      console.log("Query Context7 Success, data length:", data.length);

      // Transform the response to match our interface
      return this.transformContext7Response(data, topic);
    } catch (error) {
      console.error('Error querying Context7:', error);

      // Return fallback documentation based on topic
      const fallbackDocuments = this.generateFallbackDocumentation(topic);

      return {
        success: true,
        documents: fallbackDocuments,
        totalResults: fallbackDocuments.length,
        queryTime: 0
      };
    }
  }

  private transformContext7Response(data: any, topic: string): Context7Response {
    const startTime = Date.now();
    const documents: Context7Document[] = [];

    console.log('Transforming Context7 response, data type:', typeof data, 'isArray:', Array.isArray(data));

    if (Array.isArray(data)) {
      // Context7 returns an array of code examples
      data.forEach((item: any, index: number) => {
        try {
          const doc = this.parseContext7Item(item, topic, index);
          if (doc) {
            documents.push(doc);
          }
        } catch (error) {
          console.error('Error parsing Context7 item:', error, item);
        }
      });
    } else {
      console.warn('Context7 response is not an array:', data);
    }

    console.log('Parsed', documents.length, 'documents from Context7 response');

    return {
      success: true,
      documents,
      totalResults: documents.length,
      queryTime: Date.now() - startTime
    };
  }

  private parseContext7Item(item: any, topic: string, index: number): Context7Document | null {
    try {
      // Extract data from Context7 response format
      const {
        codeTitle,
        codeDescription,
        codeLanguage,
        codeTokens,
        codeId,
        pageTitle,
        codeList,
        relevance
      } = item;

      if (!codeList || !Array.isArray(codeList) || codeList.length === 0) {
        console.warn('Context7 item has no codeList:', item);
        return null;
      }

      // Extract code examples from codeList
      const codeExamples: string[] = [];
      const apiMethods: string[] = [];

      codeList.forEach((codeItem: any) => {
        if (codeItem.code) {
          codeExamples.push(codeItem.code);

          // Extract API methods from the code
          const methods = this.extractApiMethods(codeItem.code);
          methods.forEach(method => {
            if (!apiMethods.includes(method)) {
              apiMethods.push(method);
            }
          });
        }
      });

      // Create content from the structured data
      const content = `
# ${codeTitle || `SpreadJS Example ${index + 1}`}

## Description
${codeDescription || 'No description available'}

## Source
${pageTitle || 'SpreadJS Documentation'}
${codeId ? `URL: ${codeId}` : ''}

## Code Examples
${codeExamples.map((code, idx) => `\`\`\`${codeLanguage || 'javascript'}\n${code}\n\`\`\``).join('\n\n')}
      `.trim();

      return {
        title: codeTitle || `SpreadJS Example ${index + 1}`,
        content,
        codeExamples,
        apiMethods,
        relevanceScore: (relevance || 0) * 100 // Convert to 0-100 scale
      };

    } catch (error) {
      console.error('Error parsing Context7 item:', error);
      return null;
    }
  }

  private parseContentToDocument(content: string, topic: string): Context7Document {
    // Extract code examples (code blocks between ``` or similar patterns)
    const codeExamples = this.extractCodeExamples(content);

    // Extract API methods (patterns like .methodName( or methodName: function)
    const apiMethods = this.extractApiMethods(content);

    // Calculate relevance score based on topic occurrence
    const relevanceScore = this.calculateRelevanceScore(content, topic);

    return {
      title: `SpreadJS Documentation - ${topic}`,
      content,
      codeExamples,
      apiMethods,
      relevanceScore
    };
  }

  private extractCodeExamples(content: string): string[] {
    const codeExamples: string[] = [];

    // Match code blocks with ```
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeExamples.push(match[1].trim());
    }

    // Match inline code or single line examples
    const inlineCodeRegex = /`([^`]+)`/g;
    while ((match = inlineCodeRegex.exec(content)) !== null) {
      if (match[1].includes('spread') || match[1].includes('sheet') || match[1].includes('cell')) {
        codeExamples.push(match[1]);
      }
    }

    return codeExamples;
  }

  private extractApiMethods(content: string): string[] {
    const apiMethods: string[] = [];

    // Match method calls like .methodName(
    const methodCallRegex = /\.(\w+)\s*\(/g;
    let match;
    while ((match = methodCallRegex.exec(content)) !== null) {
      if (!apiMethods.includes(match[1])) {
        apiMethods.push(match[1]);
      }
    }

    // Match function definitions
    const functionDefRegex = /(\w+)\s*:\s*function|function\s+(\w+)/g;
    while ((match = functionDefRegex.exec(content)) !== null) {
      const methodName = match[1] || match[2];
      if (methodName && !apiMethods.includes(methodName)) {
        apiMethods.push(methodName);
      }
    }

    return apiMethods;
  }

  private calculateRelevanceScore(content: string, topic: string): number {
    const contentLower = content.toLowerCase();
    const topicLower = topic.toLowerCase();

    // Simple relevance scoring based on keyword occurrence
    const topicWords = topicLower.split(/\s+/);
    let score = 0;

    topicWords.forEach(word => {
      const occurrences = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += occurrences * 10; // Weight each occurrence
    });

    // Normalize score to 0-100 range
    return Math.min(100, score);
  }

  // Generate fallback documentation when Context7 is not available
  private generateFallbackDocumentation(topic: string): Context7Document[] {
    const topicLower = topic.toLowerCase();
    const relevantApis = [];

    // Match relevant APIs based on topic
    if (topicLower.includes('setvalue') || topicLower.includes('设置') || topicLower.includes('值')) {
      relevantApis.push({
        name: 'setValue',
        code: this.fallbackApiReference.setValue,
        description: 'Set value to a specific cell'
      });
    }

    if (topicLower.includes('getselections') || topicLower.includes('selection') || topicLower.includes('选择')) {
      relevantApis.push({
        name: 'getSelections',
        code: this.fallbackApiReference.getSelections,
        description: 'Get current cell selections (returns array)'
      });
    }

    if (topicLower.includes('color') || topicLower.includes('颜色') || topicLower.includes('背景')) {
      relevantApis.push({
        name: 'backColor',
        code: this.fallbackApiReference.backColor,
        description: 'Set background color for cell range'
      });
    }

    if (topicLower.includes('formula') || topicLower.includes('公式') || topicLower.includes('计算')) {
      relevantApis.push({
        name: 'setFormula',
        code: this.fallbackApiReference.setFormula,
        description: 'Set formula for a cell'
      });
    }

    if (topicLower.includes('sort') || topicLower.includes('排序')) {
      relevantApis.push({
        name: 'sort',
        code: this.fallbackApiReference.sort,
        description: 'Sort data in a range'
      });
    }

    if (topicLower.includes('chart') || topicLower.includes('图表')) {
      relevantApis.push({
        name: 'charts',
        code: this.fallbackApiReference.charts,
        description: 'Add chart to the sheet'
      });
    }

    // If no specific APIs matched, provide basic ones
    if (relevantApis.length === 0) {
      relevantApis.push(
        {
          name: 'setValue',
          code: this.fallbackApiReference.setValue,
          description: 'Set value to a specific cell'
        },
        {
          name: 'getSelections',
          code: this.fallbackApiReference.getSelections,
          description: 'Get current cell selections (returns array)'
        }
      );
    }

    // Create documentation with code examples
    const content = relevantApis.map(api =>
      `## ${api.name}\n${api.description}\n\`\`\`javascript\n${api.code}\n\`\`\`\n`
    ).join('\n');

    const codeExamples = relevantApis.map(api => api.code);

    return [{
      title: `SpreadJS Fallback Documentation - ${topic}`,
      content,
      codeExamples,
      apiMethods: relevantApis.map(api => api.name),
      relevanceScore: 90
    }];
  }
}