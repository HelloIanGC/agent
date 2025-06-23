# SpreadJS MCP System

基于 MCP (Model Context Protocol) 的 SpreadJS 自然语言接口系统。

## 快速开始

### 1. 安装依赖
```bash
npm install
npm run install:all
```

### 2. 环境配置
创建 `.env` 文件：
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
MCP_SERVER_PORT=3001
FRONTEND_PORT=3000
```

### 3. 启动服务
```bash
npm run dev
```

### 4. 访问应用
- 前端: http://localhost:3000
- MCP Server: http://localhost:3001/health

## 核心功能

- 自然语言操作 SpreadJS
- 实时状态监控
- AI 代码生成
- 安全执行机制