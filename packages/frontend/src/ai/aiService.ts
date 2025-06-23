import OpenAI from 'openai';

interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface AIRequest {
  prompt: string;
  context?: any;
  maxTokens?: number;
  temperature?: number;
}

interface AIResponse {
  success: boolean;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

interface SpreadJSContext {
  currentSheet: string;
  selectedRange?: string;
  cellData?: any;
  workbookInfo?: any;
}

export class AIService {
  private config: OpenRouterConfig;
  private openai: OpenAI;

  constructor() {
    this.config = {
      apiKey: (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '',
      model: (import.meta as any).env?.VITE_OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      baseUrl: 'https://openrouter.ai/api/v1'
    };

    if (!this.config.apiKey) {
      console.warn('OpenRouter API key not configured. AI features will be limited.');
    }

    // Initialize OpenAI client with OpenRouter configuration
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
      dangerouslyAllowBrowser: true, // Required for client-side usage
      defaultHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'SpreadJS MCP System'
      }
    });
  }

  async generateSpreadJSCode(
    userRequest: string,
    spreadjsContext: SpreadJSContext,
    context7Docs?: string
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(userRequest, spreadjsContext, context7Docs);

      const request: AIRequest = {
        prompt: userPrompt,
        maxTokens: 2000,
        temperature: 0.1
      };

      return await this.callOpenRouterWithSDK(systemPrompt, request);
    } catch (error: unknown) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'AI service error'
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are a SpreadJS expert assistant. Your role is to:

1. Convert natural language requests into executable SpreadJS JavaScript code
2. Use SpreadJS API correctly and efficiently
3. Follow best practices for SpreadJS development
4. Ensure code is safe and doesn't contain dangerous operations
5. Provide clear, concise code with comments

IMPORTANT RULES:
- Only use SpreadJS APIs and standard JavaScript
- Do not use eval(), Function(), setTimeout(), or other dangerous functions
- Do not access window, document, localStorage, or other browser APIs
- Focus on spreadsheet operations: cells, ranges, worksheets, formatting, etc.
- Always wrap operations in try-catch blocks for error handling
- Use the provided variables: spread, workbook, sheet, commandManager

Code structure should be:
\`\`\`javascript
try {
  // Your SpreadJS code here
  // Use spread, workbook, sheet, commandManager variables
} catch (error) {
  console.error('Operation failed:', error);
  throw error;
}
\`\`\``;
  }

  private buildUserPrompt(
    userRequest: string,
    context: SpreadJSContext,
    docs?: string
  ): string {
    let prompt = `User Request: ${userRequest}\n\n`;

    prompt += `Current SpreadJS Context:\n`;
    prompt += `- Active Sheet: ${context.currentSheet}\n`;
    if (context.selectedRange) {
      prompt += `- Selected Range: ${context.selectedRange}\n`;
    }
    if (context.cellData) {
      prompt += `- Current Cell Data: ${JSON.stringify(context.cellData, null, 2)}\n`;
    }

    if (docs) {
      prompt += `\nRelevant SpreadJS Documentation:\n${docs}\n`;
    }

    prompt += `\nPlease generate SpreadJS JavaScript code to fulfill this request.
The code should be executable and handle potential errors gracefully.
Provide only the JavaScript code without additional explanations.`;

    return prompt;
  }

  private async callOpenRouterWithSDK(systemPrompt: string, request: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) {
      return {
        success: false,
        content: '',
        error: 'OpenRouter API key not configured'
      };
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.prompt }
        ],
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.1,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content received from AI model');
      }

      return {
        success: true,
        content: choice.message.content,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        } : undefined
      };
    } catch (error: unknown) {
      console.error('OpenAI SDK error:', error);

      if (error instanceof OpenAI.APIError) {
        return {
          success: false,
          content: '',
          error: `OpenRouter API error: ${error.status} - ${error.message}`
        };
      }

      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown OpenAI SDK error'
      };
    }
  }

  async queryContext7AndGenerate(
    userRequest: string,
    spreadjsContext: SpreadJSContext
  ): Promise<AIResponse> {
    try {
      // First, query Context7 for relevant documentation
      const context7Response = await fetch('http://localhost:3001/tools/query_context7', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: userRequest,
          tokens: 5000
        })
      });

      if (!context7Response.ok) {
        throw new Error(`Context7 query failed: ${context7Response.status}`);
      }

      const context7Data = await context7Response.json();
      const context7Docs = this.extractContext7Documentation(context7Data.result);

      // Generate code with enhanced documentation
      return await this.generateSpreadJSCode(userRequest, spreadjsContext, context7Docs);
    } catch (error: unknown) {
      console.warn('Context7 query failed, generating without docs:', error);
      // Fallback: generate without Context7 documentation
      return await this.generateSpreadJSCode(userRequest, spreadjsContext);
    }
  }

  private extractContext7Documentation(context7Result: any): string {
    if (!context7Result?.success || !context7Result?.documents) {
      return '';
    }

    // Extract most relevant documentation
    const topDocs = context7Result.documents
      .slice(0, 3) // Top 3 most relevant docs
      .map((doc: any) => `${doc.title}:\n${doc.content}\n\nCode Examples:\n${doc.codeExamples?.join('\n\n') || 'No examples available'}`)
      .join('\n\n---\n\n');

    return topDocs;
  }

  extractCode(aiResponse: string): string {
    // Extract JavaScript code from AI response
    const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)```/g;
    const matches = aiResponse.match(codeBlockRegex);

    if (matches && matches.length > 0) {
      // Get the first code block and remove the markdown formatting
      return matches[0]
        .replace(/```(?:javascript|js)?\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim();
    }

    // If no code blocks found, look for lines that appear to be JavaScript
    const lines = aiResponse.split('\n');
    const codeLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 &&
             (trimmed.includes('spread.') ||
              trimmed.includes('sheet.') ||
              trimmed.includes('workbook.') ||
              trimmed.includes('commandManager.') ||
              trimmed.startsWith('try') ||
              trimmed.startsWith('catch') ||
              trimmed.includes('function') ||
              trimmed.includes('const ') ||
              trimmed.includes('let ') ||
              trimmed.includes('var '));
    });

    return codeLines.length > 0 ? codeLines.join('\n') : aiResponse.trim();
  }

  validateGeneratedCode(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/i, message: 'eval() function is not allowed' },
      { pattern: /Function\s*\(/i, message: 'Function() constructor is not allowed' },
      { pattern: /setTimeout|setInterval/i, message: 'Timer functions are not allowed' },
      { pattern: /XMLHttpRequest|fetch\s*\(/i, message: 'Network requests are not allowed' },
      { pattern: /document\.|window\./i, message: 'DOM/window access is not allowed' },
      { pattern: /localStorage|sessionStorage/i, message: 'Storage APIs are not allowed' }
    ];

    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(code)) {
        errors.push(message);
      }
    });

    // Check for SpreadJS API usage
    const hasSpreadJSAPI = /spread\.|sheet\.|workbook\.|commandManager\./.test(code);
    if (!hasSpreadJSAPI) {
      errors.push('Code should use SpreadJS APIs (spread, sheet, workbook, commandManager)');
    }

    // Check for try-catch blocks
    if (!code.includes('try') || !code.includes('catch')) {
      errors.push('Code should include try-catch blocks for error handling');
    }

    // Check code length
    if (code.length > 10000) {
      errors.push('Code is too long (>10KB)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Test connection to OpenRouter API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hello, can you respond with just "OK"?' }],
        max_tokens: 10,
        temperature: 0
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        return {
          success: true,
          message: `Connection successful. Model: ${this.config.model}`
        };
      } else {
        return {
          success: false,
          message: 'No response content received'
        };
      }
    } catch (error: unknown) {
      console.error('Connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): { model: string; hasApiKey: boolean; baseUrl: string } {
    return {
      model: this.config.model,
      hasApiKey: !!this.config.apiKey,
      baseUrl: this.config.baseUrl
    };
  }
}

// Export singleton instance
export const aiService = new AIService();