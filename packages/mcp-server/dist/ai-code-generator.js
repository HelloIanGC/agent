"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AICodeGenerator = void 0;
class AICodeGenerator {
    /**
     * 核心方法：Agent式的SpreadJS代码生成和验证
     * 包含完整的执行-验证-修正循环
     */
    async generateSpreadJSCode(context) {
        try {
            // 构建AI提示，包含Context7文档和用户需求
            const aiPrompt = this.buildAIPrompt(context);
            // 调用AI服务生成代码
            const aiResult = await this.callAIService(aiPrompt);
            return {
                success: true,
                code: aiResult.code,
                explanation: aiResult.explanation,
                confidence: aiResult.confidence,
                documentationUsed: this.extractUsedDocumentation(context.documentationContext)
            };
        }
        catch (error) {
            return {
                success: false,
                code: '',
                explanation: 'AI code generation failed',
                confidence: 0,
                documentationUsed: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
   * 构建AI提示，包含Context7文档和用户需求
   */
    buildAIPrompt(context) {
        return {
            messages: [
                {
                    role: "system",
                    content: `You are a SpreadJS code generator. Your task is to read the provided documentation and generate accurate JavaScript code.

CRITICAL CONTEXT:
- The 'spread' variable is already initialized (GC.Spread.Sheets.Workbook instance)
- Use spread.getActiveSheet() to get the current worksheet
- Generate ONLY executable code, no setup or initialization needed

DOCUMENTATION PROVIDED:
${this.formatDocumentation(context.documentationContext)}

Your job is to understand the user's request and generate the appropriate SpreadJS code based on the documentation examples.`
                },
                {
                    role: "user",
                    content: `Generate SpreadJS code for this request: "${context.userRequest}"`
                }
            ],
            function_call: {
                name: "generate_spreadjs_code",
                description: "Generate SpreadJS code based on documentation and user request",
                parameters: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "Executable JavaScript code for SpreadJS"
                        },
                        explanation: {
                            type: "string",
                            description: "Brief explanation of the generated code"
                        },
                        confidence: {
                            type: "number",
                            description: "Confidence score from 0-100"
                        }
                    },
                    required: ["code", "explanation", "confidence"]
                }
            }
        };
    }
    /**
   * Agent式的完整执行流程：生成-执行-验证-修正
   */
    async executeAsAgent(context) {
        const maxRetries = context.maxRetries || 3;
        let attempts = 0;
        while (attempts < maxRetries) {
            attempts++;
            try {
                // 1. 获取执行前状态
                const preState = await this.getSpreadJSState(context.userRequest);
                // 2. 生成代码
                const aiResult = await this.callAIService(this.buildAIPrompt(context));
                // 3. 执行代码
                const executionResult = await this.executeCode(aiResult.code);
                if (!executionResult.success) {
                    console.log(`Execution failed on attempt ${attempts}: ${executionResult.error}`);
                    continue;
                }
                // 4. 获取执行后状态
                const postState = await this.getSpreadJSState(context.userRequest);
                // 5. 验证结果
                const validation = await this.validateExecution(context.userRequest, preState, postState, aiResult.code);
                if (validation.success) {
                    return {
                        success: true,
                        code: aiResult.code,
                        explanation: aiResult.explanation,
                        confidence: aiResult.confidence,
                        documentationUsed: this.extractUsedDocumentation(context.documentationContext),
                        executionAttempts: attempts,
                        validationResult: validation,
                        finalState: postState
                    };
                }
                // 验证失败，生成修正代码
                console.log(`Validation failed on attempt ${attempts}:`, validation.differences);
                if (attempts < maxRetries) {
                    // 尝试修正
                    const correctionResult = await this.generateCorrection(context, validation, aiResult.code);
                    if (correctionResult) {
                        // 更新context用于下次尝试
                        context.userRequest = `修正之前的错误: ${validation.differences.join(', ')}. 原始需求: ${context.userRequest}`;
                    }
                }
            }
            catch (error) {
                console.log(`Error on attempt ${attempts}:`, error);
                if (attempts >= maxRetries) {
                    return {
                        success: false,
                        code: '',
                        explanation: 'Agent execution failed after multiple attempts',
                        confidence: 0,
                        documentationUsed: [],
                        executionAttempts: attempts,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }
        }
        return {
            success: false,
            code: '',
            explanation: 'Max retries exceeded',
            confidence: 0,
            documentationUsed: [],
            executionAttempts: attempts,
            error: 'Failed to complete task after multiple attempts'
        };
    }
    /**
     * 获取当前SpreadJS状态（智能查询方式）
     */
    async getSpreadJSState(userRequest) {
        // 基于用户请求智能生成查询代码，避免全量状态序列化
        const stateQueries = this.generateStateQueries(userRequest);
        // 使用现有的execute_spreadjs_queries工具进行精准查询
        // 这里应该调用MCPTools.executeSpreadJSQueries
        // 暂时返回模拟数据
        return {
            timestamp: Date.now(),
            relevantData: {
            // 只包含与用户请求相关的数据
            }
        };
    }
    /**
     * 基于用户请求生成相关的状态查询
     */
    generateStateQueries(userRequest) {
        const queries = [];
        const request = userRequest.toLowerCase();
        // 智能分析用户请求，只查询相关状态
        if (request.includes('a1') || request.includes('第一个单元格')) {
            queries.push({
                id: 'check_a1',
                code: 'const sheet = spread.getActiveSheet(); return { cell: "A1", value: sheet.getValue(0, 0), format: sheet.getStyle(0, 0) };',
                description: 'Check A1 cell current state',
                resultKey: 'a1_state'
            });
        }
        // 可以根据更多模式添加其他查询
        if (request.includes('选中') || request.includes('selection')) {
            queries.push({
                id: 'check_selection',
                code: 'const sheet = spread.getActiveSheet(); return { selection: sheet.getSelections() };',
                description: 'Check current selection',
                resultKey: 'selection_state'
            });
        }
        // 如果没有特定模式，添加基础查询
        if (queries.length === 0) {
            queries.push({
                id: 'basic_state',
                code: 'const sheet = spread.getActiveSheet(); return { activeCell: sheet.getActiveRowIndex() + "," + sheet.getActiveColumnIndex() };',
                description: 'Check basic spreadsheet state',
                resultKey: 'basic_state'
            });
        }
        return queries;
    }
    /**
     * 执行代码
     */
    async executeCode(code) {
        try {
            // 这里需要通过MCP工具执行代码
            console.log("Executing code:", code);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Execution failed'
            };
        }
    }
    /**
     * 验证执行结果
     */
    async validateExecution(userRequest, preState, postState, executedCode) {
        // AI分析用户需求的期望结果，并与实际状态对比
        const validationPrompt = this.buildValidationPrompt(userRequest, preState, postState, executedCode);
        const validationResult = await this.callValidationAI(validationPrompt);
        return validationResult;
    }
    /**
     * 生成修正代码
     */
    async generateCorrection(context, validation, failedCode) {
        const correctionPrompt = this.buildCorrectionPrompt(context, validation, failedCode);
        try {
            const correctionResult = await this.callAIService(correctionPrompt);
            return { success: true, correctionCode: correctionResult.code };
        }
        catch (error) {
            return { success: false };
        }
    }
    /**
     * 构建验证提示词
     */
    buildValidationPrompt(userRequest, preState, postState, executedCode) {
        return {
            messages: [
                {
                    role: "system",
                    content: `You are a SpreadJS validation expert. Compare the expected outcome with actual results.

Your task:
1. Analyze the user's request to understand what they wanted to achieve
2. Compare the before/after states to see what actually happened
3. Determine if the execution was successful`
                },
                {
                    role: "user",
                    content: `User Request: "${userRequest}"

Executed Code: ${executedCode}

Before State: ${JSON.stringify(preState)}
After State: ${JSON.stringify(postState)}

Did the execution achieve the user's goal?`
                }
            ],
            function_call: {
                name: "validate_execution",
                parameters: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        expectedState: { type: "object" },
                        actualState: { type: "object" },
                        differences: { type: "array", items: { type: "string" } },
                        needsCorrection: { type: "boolean" }
                    },
                    required: ["success", "differences", "needsCorrection"]
                }
            }
        };
    }
    /**
     * 构建修正提示词
     */
    buildCorrectionPrompt(context, validation, failedCode) {
        return {
            messages: [
                {
                    role: "system",
                    content: `You are a SpreadJS debugging expert. Generate corrective code based on validation failures.

Previous code failed validation. Generate corrected code based on the differences found.`
                },
                {
                    role: "user",
                    content: `Original Request: "${context.userRequest}"

Failed Code: ${failedCode}

Validation Issues: ${validation.differences.join('; ')}

Generate corrected SpreadJS code that addresses these issues.`
                }
            ],
            function_call: {
                name: "generate_spreadjs_code",
                parameters: {
                    type: "object",
                    properties: {
                        code: { type: "string" },
                        explanation: { type: "string" },
                        confidence: { type: "number" }
                    },
                    required: ["code", "explanation", "confidence"]
                }
            }
        };
    }
    /**
   * 调用AI进行验证
   * 使用相同的OpenRouter配置
   */
    async callValidationAI(prompt) {
        try {
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) {
                throw new Error('OPENROUTER_API_KEY not configured');
            }
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3001',
                    'X-Title': 'SpreadJS MCP System'
                },
                body: JSON.stringify({
                    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
                    messages: prompt.messages,
                    max_tokens: 1000,
                    temperature: 0.1,
                    functions: prompt.function_call ? [prompt.function_call] : undefined,
                    function_call: prompt.function_call ? { name: prompt.function_call.name } : undefined
                })
            });
            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status}`);
            }
            const completion = await response.json();
            const choice = completion.choices?.[0];
            if (choice?.message?.function_call) {
                const functionArgs = JSON.parse(choice.message.function_call.arguments || '{}');
                return {
                    success: functionArgs.success || false,
                    expectedState: functionArgs.expectedState || {},
                    actualState: functionArgs.actualState || {},
                    differences: functionArgs.differences || [],
                    needsCorrection: functionArgs.needsCorrection || false
                };
            }
            // Handle regular response
            const content = choice?.message?.content || '';
            return this.parseValidationResponse(content);
        }
        catch (error) {
            console.error('Validation AI Error:', error);
            // 验证失败时的默认响应
            return {
                success: false,
                expectedState: {},
                actualState: {},
                differences: ['Validation AI service unavailable'],
                needsCorrection: true
            };
        }
    }
    /**
     * 解析验证响应
     */
    parseValidationResponse(content) {
        const successMatch = content.toLowerCase().includes('success') && !content.toLowerCase().includes('fail');
        const differences = [];
        if (content.includes('mismatch') || content.includes('error') || content.includes('fail')) {
            differences.push('Execution result validation failed');
        }
        return {
            success: successMatch && differences.length === 0,
            expectedState: {},
            actualState: {},
            differences,
            needsCorrection: differences.length > 0
        };
    }
    /**
   * 调用AI服务生成代码
   * 使用与前端相同的OpenRouter配置
   */
    async callAIService(prompt) {
        try {
            // 检查环境变量
            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) {
                throw new Error('OPENROUTER_API_KEY not configured in environment');
            }
            // 使用fetch直接调用OpenRouter API（避免依赖冲突）
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3001',
                    'X-Title': 'SpreadJS MCP System'
                },
                body: JSON.stringify({
                    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
                    messages: prompt.messages,
                    max_tokens: 2000,
                    temperature: 0.1,
                    functions: prompt.function_call ? [prompt.function_call] : undefined,
                    function_call: prompt.function_call ? { name: prompt.function_call.name } : undefined
                })
            });
            if (!response.ok) {
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
            }
            const completion = await response.json();
            const choice = completion.choices?.[0];
            if (!choice) {
                throw new Error('No response from AI model');
            }
            // Handle function call response
            if (choice.message?.function_call) {
                const functionArgs = JSON.parse(choice.message.function_call.arguments || '{}');
                return {
                    code: functionArgs.code || '',
                    explanation: functionArgs.explanation || 'AI generated SpreadJS code',
                    confidence: functionArgs.confidence || 70
                };
            }
            // Handle regular response and extract code
            const content = choice.message?.content || '';
            const extractedCode = this.extractCodeFromResponse(content);
            return {
                code: extractedCode,
                explanation: 'AI generated SpreadJS code based on documentation',
                confidence: 75
            };
        }
        catch (error) {
            console.error('AI Service Error:', error);
            // 如果AI调用失败，返回基础模板而不是抛出错误
            return {
                code: `// AI service error: ${error instanceof Error ? error.message : 'Unknown error'}\nconst sheet = spread.getActiveSheet();\n// Please implement manually`,
                explanation: 'AI service error - basic template provided',
                confidence: 20
            };
        }
    }
    /**
     * 从AI响应中提取代码
     */
    extractCodeFromResponse(response) {
        // 查找代码块
        const codeBlockMatch = response.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }
        // 查找包含spread的行
        const lines = response.split('\n');
        const codeLines = lines.filter(line => line.includes('spread.') ||
            line.includes('sheet.') ||
            line.includes('const sheet') ||
            line.includes('getValue') ||
            line.includes('setValue'));
        return codeLines.length > 0 ? codeLines.join('\n') : response.trim();
    }
    /**
     * 格式化Context7文档供AI使用
     */
    formatDocumentation(docs) {
        if (!docs.success || !docs.documents) {
            return "No documentation available";
        }
        return docs.documents.map(doc => `
Title: ${doc.title || 'Untitled'}
Content: ${doc.content || 'No content'}
Code Examples:
${doc.codeExamples ? doc.codeExamples.join('\n---\n') : 'No examples'}
`).join('\n=================\n');
    }
    /**
     * 提取使用的文档
     */
    extractUsedDocumentation(docs) {
        if (!docs.success || !docs.documents) {
            return [];
        }
        return docs.documents.map(doc => doc.title || 'Untitled Document');
    }
}
exports.AICodeGenerator = AICodeGenerator;
