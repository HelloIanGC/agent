export class Context7Client {
    constructor() {
        this.baseUrl = 'https://context7.com/api/v1/llmstxt';
        this.spreadjsDocUrl = 'developer_mescius_com-spreadjs-docs-llms.txt';
    }
    async querySpreadJSDocumentation(topic, maxTokens = 5000) {
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
        }
        catch (error) {
            console.error('[Context7Client] Error querying documentation:', error);
            return {
                success: false,
                documents: [],
                totalTokens: 0,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    transformContext7Response(data, topic) {
        try {
            const documents = [];
            // Handle JSON response format (type=json parameter)
            if (typeof data === 'object' && data !== null) {
                // Check for different JSON response structures
                let items = [];
                if (data.results && Array.isArray(data.results)) {
                    items = data.results;
                }
                else if (data.items && Array.isArray(data.items)) {
                    items = data.items;
                }
                else if (data.codeList && Array.isArray(data.codeList)) {
                    items = data.codeList;
                }
                else if (Array.isArray(data)) {
                    items = data;
                }
                else {
                    console.log('[Context7Client] JSON response structure:', Object.keys(data));
                    // If it's a single object, treat it as one item
                    items = [data];
                }
                // Take top 3 most relevant results and convert them directly
                items.slice(0, 3).forEach((item, index) => {
                    const doc = this.parseContext7Item(item, topic, index);
                    if (doc) {
                        documents.push(doc);
                    }
                });
            }
            // Handle legacy text-based markdown format
            else if (typeof data === 'string') {
                const parsedDocs = this.parseMarkdownDocuments(data, topic);
                documents.push(...parsedDocs.slice(0, 3)); // Take top 3
            }
            if (documents.length === 0) {
                console.log('[Context7Client] No documentation found for topic:', topic);
                return {
                    success: true,
                    documents: [],
                    totalTokens: 0
                };
            }
            // Documents are already sorted by Context7's relevance, no need to re-sort
            const totalTokens = documents.reduce((sum, doc) => sum + (doc.content.length / 4), 0);
            return {
                success: true,
                documents,
                totalTokens: Math.round(totalTokens)
            };
        }
        catch (error) {
            console.error('[Context7Client] Error transforming response:', error);
            return {
                success: false,
                documents: [],
                totalTokens: 0,
                error: 'Failed to process documentation response'
            };
        }
    }
    parseMarkdownDocuments(markdownText, topic) {
        const documents = [];
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
    parseMarkdownSection(section, topic, index) {
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
                }
                else if (trimmedLine.startsWith('DESCRIPTION:')) {
                    description = trimmedLine.substring(12).trim();
                    currentField = 'description';
                }
                else if (trimmedLine.startsWith('SOURCE:')) {
                    source = trimmedLine.substring(7).trim();
                    currentField = 'source';
                }
                else if (trimmedLine.startsWith('LANGUAGE:')) {
                    language = trimmedLine.substring(9).trim();
                    currentField = 'language';
                }
                else if (trimmedLine.startsWith('CODE:')) {
                    currentField = 'code';
                }
                else if (trimmedLine === '```' && currentField === 'code') {
                    codeStarted = !codeStarted;
                }
                else if (codeStarted && currentField === 'code') {
                    code += line + '\n';
                }
                else if (currentField === 'description' && trimmedLine && !trimmedLine.startsWith('TITLE:') && !trimmedLine.startsWith('SOURCE:') && !trimmedLine.startsWith('LANGUAGE:') && !trimmedLine.startsWith('CODE:')) {
                    description += ' ' + trimmedLine;
                }
            }
            if (!title) {
                console.warn('Markdown section missing title, skipping:', section.substring(0, 100));
                return null;
            }
            const codeExamples = code.trim() ? [code.trim()] : [];
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
                apiMethods: [], // No need to extract API methods
                relevanceScore: 100 - (index * 10) // Simple scoring based on order
            };
        }
        catch (error) {
            console.error('Error parsing markdown section:', error);
            return null;
        }
    }
    parseContext7Item(item, topic, index) {
        try {
            // Extract data from Context7 response format
            const { codeTitle, codeDescription, codeLanguage, codeTokens, codeId, pageTitle, codeList, relevance } = item;
            if (!codeList || !Array.isArray(codeList) || codeList.length === 0) {
                console.warn('Context7 item has no codeList:', item);
                return null;
            }
            // Extract code examples from codeList
            const codeExamples = [];
            codeList.forEach((codeItem) => {
                if (codeItem.code) {
                    codeExamples.push(codeItem.code);
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
                apiMethods: [], // Context7 already provides relevant results, no need to extract methods
                relevanceScore: (relevance || 0) * 100 // Use Context7's relevance score
            };
        }
        catch (error) {
            console.error('Error parsing Context7 item:', error);
            return null;
        }
    }
}
