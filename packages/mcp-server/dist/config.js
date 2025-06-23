"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.Config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from project root directory
const possibleEnvPaths = [
    path_1.default.resolve(process.cwd(), '../../.env'), // From packages/mcp-server
    path_1.default.resolve(process.cwd(), '.env'), // From current directory
    path_1.default.resolve(__dirname, '../../../.env'), // From dist/src
];
let envLoaded = false;
for (const envPath of possibleEnvPaths) {
    const result = dotenv_1.default.config({ path: envPath });
    if (!result.error) {
        console.log(`✅ Environment loaded from: ${envPath}`);
        envLoaded = true;
        break;
    }
}
if (!envLoaded) {
    console.warn('⚠️ No .env file found, using system environment variables');
}
// Debug environment variables
console.log('🔧 Environment check:');
console.log('- OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
console.log('- OPENROUTER_MODEL:', process.env.OPENROUTER_MODEL);
console.log('- Current working directory:', process.cwd());
class Config {
    constructor() {
        this.server = {
            port: parseInt(process.env.MCP_SERVER_PORT || '3001', 10),
            host: process.env.MCP_SERVER_HOST || 'localhost',
            maxCodeLength: parseInt(process.env.MAX_CODE_LENGTH || '10000', 10),
            executionTimeout: parseInt(process.env.EXECUTION_TIMEOUT || '15000', 10),
            queryTimeout: parseInt(process.env.QUERY_TIMEOUT || '10000', 10),
            logLevel: process.env.LOG_LEVEL || 'info',
            nodeEnv: process.env.NODE_ENV || 'development'
        };
        this.context7 = {
            baseUrl: process.env.CONTEXT7_BASE_URL || 'https://context7.com/api/v1/llmstxt',
            spreadjsDocUrl: process.env.CONTEXT7_SPREADJS_DOC_URL || 'gist_githubusercontent_com-shutongx-99f7b888d6abe65cc9b38f01a54b018d-raw-9559badf7caf04430cd7de20b8aadf125e3bd038-llms.txt'
        };
        this.security = {
            maxCodeLength: this.server.maxCodeLength,
            executionTimeout: this.server.executionTimeout,
            queryTimeout: this.server.queryTimeout,
            allowedPatterns: [
                /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/, // Variable assignments
                /\bspread\b/, // SpreadJS references
                /\bsheet\b/, // Sheet references
                /\bworkbook\b/, // Workbook references
                /\bcommandManager\b/ // Command manager references
            ],
            blockedPatterns: [
                /eval\s*\(/,
                /Function\s*\(/,
                /setTimeout\s*\(/,
                /setInterval\s*\(/,
                /XMLHttpRequest/,
                /fetch\s*\(/,
                /import\s*\(/,
                /require\s*\(/,
                /window\./,
                /document\./,
                /localStorage/,
                /sessionStorage/,
                /location\./,
                /history\./,
                /navigator\./,
                /alert\s*\(/,
                /confirm\s*\(/,
                /prompt\s*\(/
            ]
        };
        this.validate();
    }
    validate() {
        const errors = [];
        if (this.server.port < 1 || this.server.port > 65535) {
            errors.push('Server port must be between 1 and 65535');
        }
        if (this.server.maxCodeLength < 100 || this.server.maxCodeLength > 50000) {
            errors.push('Max code length must be between 100 and 50000');
        }
        if (this.server.executionTimeout < 1000 || this.server.executionTimeout > 60000) {
            errors.push('Execution timeout must be between 1000 and 60000 milliseconds');
        }
        if (this.server.queryTimeout < 1000 || this.server.queryTimeout > 30000) {
            errors.push('Query timeout must be between 1000 and 30000 milliseconds');
        }
        if (!this.context7.baseUrl.startsWith('http')) {
            errors.push('Context7 base URL must be a valid HTTP/HTTPS URL');
        }
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }
    isDevelopment() {
        return this.server.nodeEnv === 'development';
    }
    isProduction() {
        return this.server.nodeEnv === 'production';
    }
}
exports.Config = Config;
// Export singleton instance
exports.config = new Config();
