// MCP Server本地常量定义
export const TIMEOUTS = {
  OPERATION_TIMEOUT: 15000,        // 操作超时 15秒
  QUERY_TIMEOUT: 10000,           // 查询超时 10秒
  VALIDATION_TIMEOUT: 5000,       // 验证超时 5秒
  RECONNECT_DELAY: 2000           // 重连延迟 2秒
} as const;

export const LIMITS = {
  MAX_CODE_LENGTH: 10000,         // 最大代码长度
  MIN_CODE_LENGTH_FOR_VALIDATION: 50, // 验证的最小代码长度
  MAX_RECONNECT_ATTEMPTS: 5,      // 最大重连次数
  MAX_TOOL_CALLS_DISPLAY: 3       // 最大显示的工具调用数量
} as const;

export const ERROR_MESSAGES = {
  CODE_UNSAFE: 'Code contains potentially dangerous operations',
  OPERATION_TIMEOUT: 'Operation timed out',
  QUERY_TIMEOUT: 'Query timed out',
  VALIDATION_FAILED: 'Validation failed',
  CONNECTION_LOST: 'Connection lost',
  AI_ERROR: 'AI service error'
} as const;

export const SCORING = {
  RELEVANCE_WEIGHT: 10,           // 相关性评分权重
  MAX_RELEVANCE_SCORE: 100,       // 最大相关性分数
  DEFAULT_AI_CONFIDENCE: 70       // 默认AI置信度
} as const;

export const API_CONFIG = {
  CONTEXT7: {
    DEFAULT_MAX_TOKENS: 2000,
    QUERY_MAX_TOKENS: 3000
  },
  OPENROUTER: {
    MAX_TOKENS: {
      TOPIC_GENERATION: 20,
      QUERY_GENERATION: 800,
      CODE_GENERATION: 1500
    },
    TEMPERATURE: {
      TOPIC: 0.2,
      QUERY: 0.3,
      CODE: 0.1
    }
  }
} as const;