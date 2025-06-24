import { LIMITS, ERROR_MESSAGES } from '../constants';

/**
 * 统一的代码安全验证器 - 解决重复代码问题
 */
export class CodeValidator {
  private static instance: CodeValidator;

  // 危险模式定义
  private readonly dangerousPatterns = [
    { pattern: /eval\s*\(/i, message: 'eval() function is not allowed' },
    { pattern: /Function\s*\(/i, message: 'Function() constructor is not allowed' },
    { pattern: /setTimeout|setInterval/i, message: 'Timer functions are not allowed' },
    { pattern: /XMLHttpRequest|fetch\s*\(/i, message: 'Network requests are not allowed' },
    { pattern: /document\.|window\./i, message: 'DOM/window access is not allowed' },
    { pattern: /localStorage|sessionStorage/i, message: 'Storage APIs are not allowed' },
    { pattern: /import\s*\(/i, message: 'Dynamic imports are not allowed' },
    { pattern: /require\s*\(/i, message: 'CommonJS requires are not allowed' }
  ];

  // 允许的模式定义
  private readonly allowedPatterns = [
    /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/,  // Variable assignments
    /\bspread\b/,                      // SpreadJS references
    /\bsheet\b/,                       // Sheet references
    /\bworkbook\b/,                    // Workbook references
    /\bcommandManager\b/               // Command manager references
  ];

  public static getInstance(): CodeValidator {
    if (!CodeValidator.instance) {
      CodeValidator.instance = new CodeValidator();
    }
    return CodeValidator.instance;
  }

  /**
   * 验证代码安全性
   */
  public validateSafety(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基本检查
    if (!code || code.trim().length === 0) {
      errors.push('Code cannot be empty');
      return { isValid: false, errors };
    }

    // 长度检查
    if (code.length > LIMITS.MAX_CODE_LENGTH) {
      errors.push(`Code is too long (>${LIMITS.MAX_CODE_LENGTH} characters)`);
    }

    // 危险模式检查
    for (const { pattern, message } of this.dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(message);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证SpreadJS API使用
   */
  public validateSpreadJSUsage(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否使用了SpreadJS API
    const hasSpreadJSAPI = /spread\.|sheet\.|workbook\.|commandManager\./.test(code);
    if (!hasSpreadJSAPI && code.length > LIMITS.MIN_CODE_LENGTH_FOR_VALIDATION) {
      errors.push('Code should use SpreadJS APIs (spread, sheet, workbook, commandManager)');
    }

    // 检查是否有基本的错误处理
    if (code.length > LIMITS.MIN_CODE_LENGTH_FOR_VALIDATION) {
      if (!code.includes('try') || !code.includes('catch')) {
        errors.push('Code should include try-catch blocks for error handling');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 完整验证（安全性 + SpreadJS使用）
   */
  public validateCode(code: string): { isValid: boolean; errors: string[] } {
    const safetyResult = this.validateSafety(code);
    if (!safetyResult.isValid) {
      return safetyResult;
    }

    const usageResult = this.validateSpreadJSUsage(code);
    return {
      isValid: usageResult.isValid,
      errors: [...safetyResult.errors, ...usageResult.errors]
    };
  }

  /**
   * 快速安全检查（仅检查危险操作）
   */
  public isCodeSafe(code: string): boolean {
    return this.validateSafety(code).isValid;
  }

  /**
   * 检查代码是否有允许的模式
   */
  public hasAllowedPatterns(code: string): boolean {
    if (code.length <= LIMITS.MIN_CODE_LENGTH_FOR_VALIDATION) {
      return true; // 短代码不需要检查
    }

    return this.allowedPatterns.some(pattern => pattern.test(code));
  }
}