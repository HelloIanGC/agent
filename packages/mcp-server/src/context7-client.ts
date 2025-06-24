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
            console.log(`[Context7Client] Received JSON response from Context7`);

            let documents: Context7Document[] = [];
            // Handle different JSON response structures
            if (data.results && Array.isArray(data.results)) {
                documents = data.results;
            } else if (data.items && Array.isArray(data.items)) {
                documents = data.items;
            } else if (data.codeList && Array.isArray(data.codeList)) {
                documents = data.codeList;
            } else if (Array.isArray(data)) {
                documents = data;
            } else if (typeof data === 'object' && data !== null) {
                // If it's a single object, treat it as one item
                documents = [data];
            }

            documents = documents.slice(0, 3).map((doc: any) => ({
                codeTitle: doc.codeTitle,
                codeDescription: doc.codeDescription,
                pageTitle: doc.pageTitle,
                codeList: doc.codeList.slice(0, 3),
                relevance: doc.relevance
            }));

            const totalTokens = documents.reduce((sum, doc: any) => sum + (doc.codeTokens || 0), 0);

            return {
                success: true,
                documents,
                totalTokens: Math.round(totalTokens)
            };

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
}