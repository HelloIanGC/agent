import { Context7Response, Context7Document } from './types.js';

export class Context7Client {
  private baseUrl = 'https://context7.com/api/v1/llmstxt';
  private spreadjsDocUrl = 'developer_mescius_com-spreadjs-docs-llms.txt';

  async querySpreadJSDocumentation(
    topic: string,
    maxTokens: number = 2000
  ): Promise<Context7Response> {
    try {
      console.log(`[Context7Client] Querying SpreadJS documentation for topic: ${topic}`);

      // Use JSON format with proper headers as shown in official documentation
      const url = `${this.baseUrl}/${this.spreadjsDocUrl}?type=json&tokens=${maxTokens}&topic=${encodeURIComponent(topic)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
        }
      });

      if (!response.ok) {
        console.error(`[Context7Client] HTTP error: ${response.status} ${response.statusText}`);
        return {
          success: false,
          documents: [],
          totalTokens: 0,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Parse as JSON since we're using type=json parameter
      const data = await response.json();
      console.log(`[Context7Client] Received JSON response from Context7 with length:`, data.length);

      const result = this.transformContext7Response(data, topic);

      console.log(`[Context7Client] the best document is:`, result.documents[0]);

      return result;

    } catch (error) {
      console.error('[Context7Client] Error querying documentation:', error);
      return {
        success: false,
        documents: [],
        totalTokens: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private transformContext7Response(data: any, topic: string): Context7Response {
    try {
      const documents: Context7Document[] = [];

      // Handle JSON response format (type=json parameter)
      if (typeof data === 'object' && data !== null) {
        // Check for different JSON response structures
        let items = [];

        if (data.results && Array.isArray(data.results)) {
          items = data.results;
        } else if (data.items && Array.isArray(data.items)) {
          items = data.items;
        } else if (data.codeList && Array.isArray(data.codeList)) {
          items = data.codeList;
        } else if (Array.isArray(data)) {
          items = data;
        } else {
          console.log('[Context7Client] JSON response structure:', Object.keys(data));
          // If it's a single object, treat it as one item
          items = [data];
        }

        items.forEach((item: any, index: number) => {
          const doc = this.parseContext7Item(item, topic, index);
          if (doc) {
            documents.push(doc);
          }
        });
      }
      // Handle legacy text-based markdown format
      else if (typeof data === 'string') {
        const parsedDocs = this.parseMarkdownDocuments(data, topic);
        documents.push(...parsedDocs);
      }

      if (documents.length === 0) {
        console.log('[Context7Client] No documentation found for topic:', topic);
        return {
          success: true,
          documents: [],
          totalTokens: 0
        };
      }

      // Sort by relevance score
      documents.sort((a, b) => b.relevanceScore - a.relevanceScore);

      const totalTokens = documents.reduce((sum, doc) => sum + doc.content.length / 4, 0);

      return {
        success: true,
        documents,
        totalTokens: Math.round(totalTokens)
      };

    } catch (error) {
      console.error('[Context7Client] Error transforming response:', error);
      return {
        success: false,
        documents: [],
        totalTokens: 0,
        error: 'Failed to process documentation response'
      };
    }
  }

  private parseMarkdownDocuments(markdownText: string, topic: string): Context7Document[] {
    const documents: Context7Document[] = [];

    // Split by document separator (----------------------------------------)
    const sections = markdownText.split(/^-{20,}$/m).filter(section => section.trim());

    sections.forEach((section, index) => {
      const doc = this.parseMarkdownSection(section.trim(), topic, index);
      if (doc) {
        documents.push(doc);
      }
    });

    return documents;
  }

  private parseMarkdownSection(section: string, topic: string, index: number): Context7Document | null {
    try {
      const lines = section.split('\n');
      let title = '';
      let description = '';
      let source = '';
      let language = '';
      let code = '';

      let currentField = '';
      let codeStarted = false;

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('TITLE:')) {
          title = trimmedLine.substring(6).trim();
          currentField = 'title';
        } else if (trimmedLine.startsWith('DESCRIPTION:')) {
          description = trimmedLine.substring(12).trim();
          currentField = 'description';
        } else if (trimmedLine.startsWith('SOURCE:')) {
          source = trimmedLine.substring(7).trim();
          currentField = 'source';
        } else if (trimmedLine.startsWith('LANGUAGE:')) {
          language = trimmedLine.substring(9).trim();
          currentField = 'language';
        } else if (trimmedLine.startsWith('CODE:')) {
          currentField = 'code';
        } else if (trimmedLine === '```' && currentField === 'code') {
          codeStarted = !codeStarted;
        } else if (codeStarted && currentField === 'code') {
          code += line + '\n';
        } else if (currentField === 'description' && trimmedLine && !trimmedLine.startsWith('TITLE:') && !trimmedLine.startsWith('SOURCE:') && !trimmedLine.startsWith('LANGUAGE:') && !trimmedLine.startsWith('CODE:')) {
          description += ' ' + trimmedLine;
        }
      }

      if (!title) {
        console.warn('Markdown section missing title, skipping:', section.substring(0, 100));
        return null;
      }

      // Extract API methods from code
      const apiMethods = this.extractApiMethods(code);
      const codeExamples = code.trim() ? [code.trim()] : [];

      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(section, topic);

      // Create structured content
      const content = `
# ${title}

## Description
${description}

## Source
${source}

## Code Example
\`\`\`${language}
${code.trim()}
\`\`\`
      `.trim();

      return {
        title,
        content,
        codeExamples,
        apiMethods,
        relevanceScore
      };

    } catch (error) {
      console.error('Error parsing markdown section:', error);
      return null;
    }
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


}