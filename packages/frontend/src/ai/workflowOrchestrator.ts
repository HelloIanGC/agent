import { AIDecisionEngine, UserRequest, AIDecision, SpreadJSContext, OperationType } from './aiDecisionEngine';
import { AIService } from './aiService';

// Workflow execution result
export interface WorkflowResult {
  success: boolean;
  operationType: OperationType;
  executionSteps: ExecutionStep[];
  finalResult?: any;
  generatedCode?: string;
  error?: string;
  metrics: {
    totalTime: number;
    aiTime: number;
    mcpTime: number;
    executionTime: number;
  };
}

export interface ExecutionStep {
  step: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
}

// MCP service interface for WebSocket communication
interface MCPService {
  queryContext7(topic: string): Promise<any>;
  executeQueries(queries: string[]): Promise<any>;
  executeOperation(code: string, description: string): Promise<any>;
}

// Quality validation result
interface CodeQualityResult {
  isValid: boolean;
  score: number; // 0-1 quality score
  issues: string[];
  suggestions: string[];
}

export class WorkflowOrchestrator {
  private decisionEngine: AIDecisionEngine;
  private aiService: AIService;
  private mcpService: MCPService;

  constructor(mcpService: MCPService) {
    this.decisionEngine = new AIDecisionEngine();
    this.aiService = new AIService();
    this.mcpService = mcpService;
  }

  /**
   * Execute complete workflow from user request to SpreadJS operation
   */
  async executeUserRequest(userRequest: UserRequest): Promise<WorkflowResult> {
    const startTime = Date.now();
    const executionSteps: ExecutionStep[] = [];
    let aiTime = 0;
    let mcpTime = 0;
    let executionTime = 0;

    try {
      // Step 1: Analyze user request with AI Decision Engine
      const step1 = this.createExecutionStep('analyze_request', 'Analyzing user request with AI Decision Engine');
      executionSteps.push(step1);

      const aiStartTime = Date.now();
      const decision = this.decisionEngine.analyzeRequest(userRequest);
      aiTime += Date.now() - aiStartTime;

      this.completeStep(step1, decision);

      // Step 2: Validate decision
      const step2 = this.createExecutionStep('validate_decision', 'Validating AI decision');
      executionSteps.push(step2);

      const validation = this.decisionEngine.validateDecision(decision, userRequest.context);
      if (!validation.isValid) {
        throw new Error(`Decision validation failed: ${validation.issues.join(', ')}`);
      }

      this.completeStep(step2, validation);

      // Step 3: Gather required context from SpreadJS
      const step3 = this.createExecutionStep('gather_context', 'Gathering SpreadJS context information');
      executionSteps.push(step3);

      const mcpStartTime1 = Date.now();
      const contextQueries = this.generateContextQueries(decision, userRequest.context);
      const contextResult = await this.mcpService.executeQueries(contextQueries);
      mcpTime += Date.now() - mcpStartTime1;

      this.completeStep(step3, contextResult);

      // Step 4: Query Context7 for relevant documentation
      const step4 = this.createExecutionStep('query_context7', 'Querying Context7 for relevant documentation');
      executionSteps.push(step4);

      const mcpStartTime2 = Date.now();
      const context7Result = await this.mcpService.queryContext7(decision.context7Query);
      mcpTime += Date.now() - mcpStartTime2;

      this.completeStep(step4, context7Result);

      // Step 5: Generate SpreadJS code with AI
      const step5 = this.createExecutionStep('generate_code', 'Generating SpreadJS code with AI');
      executionSteps.push(step5);

      const aiStartTime2 = Date.now();
      const enhancedContext = this.enhanceContextWithMCPResults(userRequest.context, contextResult);
      const context7Docs = this.extractContext7Documentation(context7Result);

      const aiResponse = await this.aiService.generateSpreadJSCode(
        userRequest.text,
        enhancedContext,
        context7Docs
      );
      aiTime += Date.now() - aiStartTime2;

      if (!aiResponse.success) {
        throw new Error(`AI code generation failed: ${aiResponse.error}`);
      }

      this.completeStep(step5, aiResponse);

      // Step 6: Validate generated code quality
      const step6 = this.createExecutionStep('validate_code', 'Validating generated code quality');
      executionSteps.push(step6);

      const generatedCode = this.aiService.extractCode(aiResponse.content);
      const qualityResult = this.validateCodeQuality(generatedCode, decision);

      if (!qualityResult.isValid) {
        throw new Error(`Generated code quality validation failed: ${qualityResult.issues.join(', ')}`);
      }

      this.completeStep(step6, qualityResult);

      // Step 7: Execute operation in SpreadJS
      const step7 = this.createExecutionStep('execute_operation', 'Executing operation in SpreadJS');
      executionSteps.push(step7);

      const execStartTime = Date.now();
      const executionResult = await this.mcpService.executeOperation(
        generatedCode,
        `AI-generated operation: ${decision.operationType}`
      );
      executionTime = Date.now() - execStartTime;

      this.completeStep(step7, executionResult);

      // Step 8: Verify execution result
      const step8 = this.createExecutionStep('verify_result', 'Verifying execution result');
      executionSteps.push(step8);

      const verificationResult = this.verifyExecutionResult(executionResult, decision);
      this.completeStep(step8, verificationResult);

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        operationType: decision.operationType,
        executionSteps,
        finalResult: executionResult,
        generatedCode,
        metrics: {
          totalTime,
          aiTime,
          mcpTime,
          executionTime
        }
      };

    } catch (error) {
      // Mark the last step as error if it exists
      const lastStep = executionSteps[executionSteps.length - 1];
      if (lastStep && lastStep.status === 'running') {
        lastStep.status = 'error';
        lastStep.error = error instanceof Error ? error.message : 'Unknown error';
        lastStep.endTime = Date.now();
      }

      const totalTime = Date.now() - startTime;

      return {
        success: false,
        operationType: OperationType.DATA, // Default fallback
        executionSteps,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          totalTime,
          aiTime,
          mcpTime,
          executionTime
        }
      };
    }
  }

  /**
   * Generate context queries based on AI decision
   */
  private generateContextQueries(decision: AIDecision, _: SpreadJSContext): string[] {
    // Generate context queries based on AI decision
    const queries: string[] = [];

    // Always get basic sheet information
    queries.push('spread.getActiveSheet().name()');
    queries.push('spread.getActiveSheet().getRowCount()');
    queries.push('spread.getActiveSheet().getColumnCount()');

    // Add decision-specific queries based on operation type
    switch (decision.operationType) {
      case OperationType.DATA:
        queries.push('spread.getActiveSheet().getSelection()');
        queries.push('spread.getActiveSheet().getActiveCell()');
        break;
      case OperationType.FORMAT:
        queries.push('spread.getActiveSheet().getSelection()');
        break;
      case OperationType.FORMULA:
        queries.push('spread.getActiveSheet().getActiveCell()');
        queries.push('spread.getActiveSheet().getSelection()');
        break;
      case OperationType.CHART:
        queries.push('spread.getActiveSheet().getSelection()');
        break;
      default:
        queries.push('spread.getActiveSheet().getSelection()');
    }

    return queries;
  }

  /**
   * Enhance context with MCP query results
   */
  private enhanceContextWithMCPResults(baseContext: SpreadJSContext, mcpResults: any): SpreadJSContext {
    return {
      ...baseContext,
      // Merge MCP results into context
      ...mcpResults?.results || {},
      // Add metadata from MCP execution
      mcpMetadata: {
        executionTime: mcpResults?.metadata?.executionTime || 0,
        queryCount: mcpResults?.metadata?.queryCount || 0,
        errors: mcpResults?.metadata?.errors || []
      }
    };
  }

  /**
   * Extract documentation from Context7 results
   */
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

  /**
   * Validate code quality and safety
   */
  private validateCodeQuality(code: string, decision: AIDecision): CodeQualityResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // Security validation
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout|setInterval/i,
      /document\.|window\./i,
      /localStorage|sessionStorage/i,
      /fetch\s*\(/i,
      /XMLHttpRequest/i
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(code)) {
        issues.push(`Potentially dangerous pattern detected: ${pattern.source}`);
        score -= 0.3;
      }
    });

    // Code structure validation
    if (!code.includes('try') || !code.includes('catch')) {
      suggestions.push('Add try-catch blocks for better error handling');
      score -= 0.1;
    }

    // SpreadJS API usage validation
    const spreadJSPatterns = [
      /spread\./,
      /workbook\./,
      /sheet\./,
      /commandManager\./
    ];

    const hasSpreadJSAPI = spreadJSPatterns.some(pattern => pattern.test(code));
    if (!hasSpreadJSAPI) {
      issues.push('Code does not appear to use SpreadJS APIs');
      score -= 0.4;
    }

    // Complexity check based on decision
    const codeLines = code.split('\n').filter(line => line.trim().length > 0).length;
    const expectedComplexity = decision.estimatedComplexity;

    if (codeLines < expectedComplexity * 2) {
      suggestions.push('Generated code may be too simple for the requested operation');
      score -= 0.1;
    } else if (codeLines > expectedComplexity * 10) {
      suggestions.push('Generated code may be overly complex');
      score -= 0.1;
    }

    // Safety level check
    if (decision.safetyLevel === 'restricted' && score > 0.6) {
      issues.push('High-risk operation requires additional validation');
      score -= 0.2;
    }

    return {
      isValid: issues.length === 0 && score >= 0.5,
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }

  /**
   * Verify execution result matches expectations
   */
  private verifyExecutionResult(executionResult: any, decision: AIDecision): any {
    const verification = {
      success: executionResult?.success || false,
      matchesOperation: true,
      hasExpectedOutput: true,
      executionTime: executionResult?.result?.executionTime || 0
    };

    // Check if execution time is reasonable for complexity
    const maxExpectedTime = decision.estimatedComplexity * 1000; // 1s per complexity point
    if (verification.executionTime > maxExpectedTime) {
      verification.matchesOperation = false;
    }

    // Check for specific operation results
    if (decision.operationType === OperationType.CHART && !executionResult?.result?.affectedElements?.some((el: string) => el.includes('chart'))) {
      verification.hasExpectedOutput = false;
    }

    return verification;
  }

  /**
   * Create a new execution step
   */
  private createExecutionStep(step: string, description: string): ExecutionStep {
    return {
      step,
      description,
      status: 'running',
      startTime: Date.now()
    };
  }

  /**
   * Mark execution step as completed
   */
  private completeStep(step: ExecutionStep, result: any): void {
    step.status = 'completed';
    step.endTime = Date.now();
    step.result = result;
  }

  /**
   * Get workflow status for real-time monitoring
   */
  getWorkflowStatus(): string {
    // This could be extended to provide real-time status updates
    return 'Workflow orchestrator ready';
  }

  /**
   * Preview operation before execution (safety feature)
   */
  async previewOperation(userRequest: UserRequest): Promise<{
    decision: AIDecision;
    estimatedImpact: string;
    safetyWarnings: string[];
  }> {
    const decision = this.decisionEngine.analyzeRequest(userRequest);

    const estimatedImpact = this.estimateOperationImpact(decision, userRequest.context);
    const safetyWarnings = this.generateSafetyWarnings(decision);

    return {
      decision,
      estimatedImpact,
      safetyWarnings
    };
  }

  /**
   * Estimate the impact of an operation
   */
  private estimateOperationImpact(decision: AIDecision, context: SpreadJSContext): string {
    const impacts: string[] = [];

    switch (decision.operationType) {
      case OperationType.DATA:
        impacts.push('May modify cell values and data structure');
        break;
      case OperationType.FORMAT:
        impacts.push('Will change visual appearance of cells');
        break;
      case OperationType.FORMULA:
        impacts.push('Will add or modify formulas and calculations');
        break;
      case OperationType.CHART:
        impacts.push('Will create new chart elements');
        break;
      case OperationType.CONDITIONAL:
        impacts.push('Will add conditional formatting rules');
        break;
      case OperationType.WORKSHEET:
        impacts.push('May modify worksheet structure');
        break;
      case OperationType.VALIDATION:
        impacts.push('Will add data validation constraints');
        break;
    }

    if (context.selectedRange) {
      impacts.push(`Target range: ${context.selectedRange}`);
    }

    return impacts.join('; ');
  }

  /**
   * Generate safety warnings based on decision
   */
  private generateSafetyWarnings(decision: AIDecision): string[] {
    const warnings: string[] = [];

    if (decision.safetyLevel === 'restricted') {
      warnings.push('⚠️ This operation involves potentially destructive changes');
    }

    if (decision.safetyLevel === 'caution') {
      warnings.push('⚠️ This operation may modify or delete data');
    }

    if (decision.confidence < 0.7) {
      warnings.push('⚠️ AI confidence is low - please review the operation carefully');
    }

    if (decision.estimatedComplexity >= 4) {
      warnings.push('⚠️ This is a complex operation that may take longer to execute');
    }

    return warnings;
  }
}