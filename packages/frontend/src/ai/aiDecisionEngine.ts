// AI Decision Engine for analyzing user requests and determining optimal execution strategies
export enum OperationType {
  DATA = 'data',           // Data manipulation: insert, delete, sort, filter
  FORMAT = 'format',       // Cell/range formatting: colors, fonts, borders
  FORMULA = 'formula',     // Formula and calculation operations
  CHART = 'chart',         // Chart creation and management
  CONDITIONAL = 'conditional', // Conditional formatting
  WORKSHEET = 'worksheet', // Worksheet management operations
  VALIDATION = 'validation' // Data validation rules
}

export interface UserRequest {
  text: string;
  context: SpreadJSContext;
}

export interface SpreadJSContext {
  currentSheet: string;
  selectedRange?: string;
  cellData?: any;
  workbookInfo?: any;
  sheetNames?: string[];
  activeCell?: string;
}

export interface AIDecision {
  operationType: OperationType;
  confidence: number;           // 0-1 score of decision confidence
  requiredContext: string[];    // Context queries needed
  context7Query: string;        // Optimized Context7 search terms
  priority: 'low' | 'medium' | 'high';
  estimatedComplexity: number;  // 1-5 scale
  safetyLevel: 'safe' | 'caution' | 'restricted';
}

export interface ContextStrategy {
  queries: string[];
  contextLevel: 'minimal' | 'standard' | 'comprehensive';
  requiredData: string[];
}

// Operation patterns for intelligent recognition
const OPERATION_PATTERNS = {
  [OperationType.DATA]: [
    /sort|order|arrange|organize/i,
    /insert|add|create.*row|create.*column/i,
    /delete|remove|clear/i,
    /filter|find|search|where/i,
    /copy|paste|move|cut/i,
    /fill|populate|auto.*fill/i
  ],
  [OperationType.FORMAT]: [
    /color|colour|background|foreground/i,
    /font|text.*size|bold|italic|underline/i,
    /border|outline|edge/i,
    /align|center|left|right|justify/i,
    /format|style|appearance/i,
    /width|height|size.*column|size.*row/i
  ],
  [OperationType.FORMULA]: [
    /formula|calculate|compute|sum|average|count/i,
    /function|=.*\(/i,
    /total|subtotal|aggregate/i,
    /math|arithmetic|operation/i,
    /percentage|percent|ratio/i
  ],
  [OperationType.CHART]: [
    /chart|graph|plot/i,
    /bar.*chart|column.*chart|pie.*chart|line.*chart/i,
    /visualization|visualize|display.*data/i,
    /diagram|graphic/i
  ],
  [OperationType.CONDITIONAL]: [
    /conditional.*format|format.*condition/i,
    /highlight.*if|color.*if|format.*when/i,
    /rule|criteria|condition/i,
    /greater.*than|less.*than|equal.*to/i
  ],
  [OperationType.WORKSHEET]: [
    /sheet|worksheet|tab/i,
    /new.*sheet|add.*sheet|create.*sheet/i,
    /rename.*sheet|delete.*sheet/i,
    /switch.*to|go.*to.*sheet/i
  ],
  [OperationType.VALIDATION]: [
    /validation|validate|restrict/i,
    /dropdown|list|options/i,
    /limit|constraint|rule/i,
    /allow.*only|must.*be/i
  ]
};

// Context requirements for each operation type
const CONTEXT_REQUIREMENTS: Record<OperationType, ContextStrategy> = {
  [OperationType.DATA]: {
    queries: ['getActiveRange()', 'getSelectedData()'],
    contextLevel: 'minimal',
    requiredData: ['selectedRange', 'cellData']
  },
  [OperationType.FORMAT]: {
    queries: ['getActiveRange()', 'getCurrentStyles()'],
    contextLevel: 'minimal',
    requiredData: ['selectedRange', 'currentFormatting']
  },
  [OperationType.FORMULA]: {
    queries: ['getActiveRange()', 'getCurrentFormulas()'],
    contextLevel: 'standard',
    requiredData: ['selectedRange', 'cellData', 'existingFormulas']
  },
  [OperationType.CHART]: {
    queries: ['getSelectedData()', 'getSheetRowCount()', 'getSheetColumnCount()'],
    contextLevel: 'comprehensive',
    requiredData: ['selectedRange', 'cellData', 'sheetStructure']
  },
  [OperationType.CONDITIONAL]: {
    queries: ['getActiveRange()', 'getSelectedData()'],
    contextLevel: 'standard',
    requiredData: ['selectedRange', 'cellData']
  },
  [OperationType.WORKSHEET]: {
    queries: ['getSheetNames()'],
    contextLevel: 'minimal',
    requiredData: ['worksheetStructure', 'sheetNames']
  },
  [OperationType.VALIDATION]: {
    queries: ['getActiveRange()'],
    contextLevel: 'standard',
    requiredData: ['selectedRange']
  }
};

export class AIDecisionEngine {
  /**
   * Analyze user request and determine the optimal execution strategy
   */
  analyzeRequest(userRequest: UserRequest): AIDecision {
    const operationType = this.identifyOperationType(userRequest.text);
    const confidence = this.calculateConfidence(userRequest.text, operationType);
    const contextStrategy = this.determineContextStrategy(operationType, userRequest.context);
    const context7Query = this.optimizeContext7Query(userRequest.text, operationType);
    const priority = this.assessPriority(operationType, userRequest.text);
    const complexity = this.estimateComplexity(userRequest.text, operationType);
    const safetyLevel = this.assessSafetyLevel(userRequest.text, operationType);

    return {
      operationType,
      confidence,
      requiredContext: contextStrategy.queries,
      context7Query,
      priority,
      estimatedComplexity: complexity,
      safetyLevel
    };
  }

  /**
   * Identify the primary operation type from user text
   */
  private identifyOperationType(userText: string): OperationType {
    const scores: Record<OperationType, number> = {
      [OperationType.DATA]: 0,
      [OperationType.FORMAT]: 0,
      [OperationType.FORMULA]: 0,
      [OperationType.CHART]: 0,
      [OperationType.CONDITIONAL]: 0,
      [OperationType.WORKSHEET]: 0,
      [OperationType.VALIDATION]: 0
    };

    // Score each operation type based on pattern matching
    Object.entries(OPERATION_PATTERNS).forEach(([type, patterns]) => {
      patterns.forEach(pattern => {
        if (pattern.test(userText)) {
          scores[type as OperationType] += 1;
        }
      });
    });

    // Find the highest scoring operation type
    const topOperation = Object.entries(scores).reduce((a, b) =>
      scores[a[0] as OperationType] > scores[b[0] as OperationType] ? a : b
    );

    return topOperation[0] as OperationType;
  }

  /**
   * Calculate confidence score for the decision
   */
  private calculateConfidence(userText: string, operationType: OperationType): number {
    const patterns = OPERATION_PATTERNS[operationType];
    let matches = 0;

    patterns.forEach(pattern => {
      if (pattern.test(userText)) {
        matches++;
      }
    });

    // Confidence based on pattern matches and text clarity
    const patternScore = Math.min(matches / patterns.length, 1);
    const lengthScore = Math.min(userText.length / 50, 1); // Longer text usually clearer
    const specificityScore = this.assessSpecificity(userText);

    return (patternScore * 0.5 + lengthScore * 0.2 + specificityScore * 0.3);
  }

  /**
   * Determine what context information is needed
   */
  private determineContextStrategy(operationType: OperationType, currentContext: SpreadJSContext): ContextStrategy {
    const baseStrategy = CONTEXT_REQUIREMENTS[operationType];

    // Adapt strategy based on current context availability
    const adaptedQueries = baseStrategy.queries.filter(query => {
      // Only include queries for missing context
      if (query.includes('getActiveRange') && !currentContext.selectedRange) return true;
      if (query.includes('getSelectedData') && !currentContext.cellData) return true;
      if (query.includes('getSheetNames') && !currentContext.sheetNames) return true;
      return true; // Default to including all queries for now
    });

    return {
      ...baseStrategy,
      queries: adaptedQueries
    };
  }

  /**
   * Optimize Context7 query terms for better documentation retrieval
   */
  private optimizeContext7Query(userText: string, operationType: OperationType): string {
    const baseTerms: Record<OperationType, string[]> = {
      [OperationType.DATA]: ['data manipulation', 'sort', 'filter', 'insert', 'delete'],
      [OperationType.FORMAT]: ['cell formatting', 'style', 'font', 'color', 'border'],
      [OperationType.FORMULA]: ['formula', 'calculation', 'function', 'SUM', 'AVERAGE'],
      [OperationType.CHART]: ['chart', 'graph', 'visualization', 'plot'],
      [OperationType.CONDITIONAL]: ['conditional formatting', 'rule', 'criteria'],
      [OperationType.WORKSHEET]: ['worksheet', 'sheet', 'tab', 'workbook'],
      [OperationType.VALIDATION]: ['data validation', 'dropdown', 'constraint', 'rule']
    };

    // Extract key terms from user text
    const extractedTerms = this.extractKeyTerms(userText);
    const relevantTerms = baseTerms[operationType];

    // Combine and prioritize terms
    const combinedTerms = [...new Set([...extractedTerms, ...relevantTerms])];

    return combinedTerms.slice(0, 5).join(' '); // Top 5 terms
  }

  /**
   * Assess operation priority
   */
  private assessPriority(operationType: OperationType, userText: string): 'low' | 'medium' | 'high' {
    // Priority based on operation type and urgency indicators
    const urgencyIndicators = /urgent|immediately|now|asap|quickly/i;
    const isUrgent = urgencyIndicators.test(userText);

    const highPriorityOps = [OperationType.DATA, OperationType.FORMULA];
    const mediumPriorityOps = [OperationType.FORMAT, OperationType.CONDITIONAL];

    if (isUrgent || highPriorityOps.includes(operationType)) return 'high';
    if (mediumPriorityOps.includes(operationType)) return 'medium';
    return 'low';
  }

  /**
   * Estimate operation complexity
   */
  private estimateComplexity(userText: string, operationType: OperationType): number {
    const complexityFactors = {
      multipleOperations: /and|also|then|plus|additionally/i.test(userText) ? 2 : 1,
      conditionalLogic: /if|when|where|condition/i.test(userText) ? 1.5 : 1,
      multipleRanges: /range|ranges|columns|rows/ig.test(userText) ? 1.3 : 1,
      chartComplexity: operationType === OperationType.CHART ? 1.5 : 1
    };

    const baseComplexity = {
      [OperationType.DATA]: 2,
      [OperationType.FORMAT]: 1,
      [OperationType.FORMULA]: 3,
      [OperationType.CHART]: 4,
      [OperationType.CONDITIONAL]: 3,
      [OperationType.WORKSHEET]: 2,
      [OperationType.VALIDATION]: 2
    }[operationType];

    return Math.min(5, Math.round(baseComplexity *
      complexityFactors.multipleOperations *
      complexityFactors.conditionalLogic *
      complexityFactors.multipleRanges *
      complexityFactors.chartComplexity
    ));
  }

  /**
   * Assess safety level of the operation
   */
  private assessSafetyLevel(userText: string, operationType: OperationType): 'safe' | 'caution' | 'restricted' {
    const destructiveIndicators = /delete|remove|clear|drop|destroy/i;
    const massOperations = /all|entire|whole|every/i;

    if (destructiveIndicators.test(userText) && massOperations.test(userText)) {
      return 'restricted';
    }

    if (destructiveIndicators.test(userText) || operationType === OperationType.WORKSHEET) {
      return 'caution';
    }

    return 'safe';
  }

  /**
   * Assess specificity of user request
   */
  private assessSpecificity(userText: string): number {
    const specificityIndicators = [
      /[A-Z]\d+|[A-Z]+\d+/g, // Cell references
      /\d+/g, // Numbers
      /column|row|sheet|range/i, // Specific terms
      /"[^"]+"/g, // Quoted strings
      /\b(red|blue|green|yellow|bold|italic)\b/i // Specific values
    ];

    let specificityScore = 0;
    specificityIndicators.forEach(indicator => {
      const matches = userText.match(indicator);
      if (matches) {
        specificityScore += matches.length * 0.1;
      }
    });

    return Math.min(1, specificityScore);
  }

  /**
   * Extract key terms from user text for Context7 querying
   */
  private extractKeyTerms(text: string): string[] {
    // Remove common words and extract meaningful terms
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 10); // Top 10 meaningful terms
  }

  /**
   * Validate if the decision makes sense given the context
   */
  validateDecision(decision: AIDecision, context: SpreadJSContext): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if required context is available or can be obtained
    if (decision.requiredContext.length > 10) {
      issues.push('Too many context queries required - may impact performance');
    }

    // Validate safety level
    if (decision.safetyLevel === 'restricted' && decision.confidence < 0.8) {
      issues.push('High-risk operation with low confidence - requires user confirmation');
    }

    // Check complexity vs context
    if (decision.estimatedComplexity > 4 && !context.selectedRange) {
      issues.push('Complex operation without clear target range');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}