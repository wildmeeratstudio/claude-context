import { Splitter, CodeChunk } from './index';

interface JsonNode {
    path: string;
    value: any;
    depth: number;
    size: number;
}

/**
 * Recursive JSON Splitter for embeddings
 *
 * This splitter implements a strategy optimized for JSON documents:
 * 1. Traverses JSON from deepest levels first
 * 2. Tries to keep nested objects intact
 * 3. Splits large objects at semantic boundaries (object/array boundaries)
 * 4. Preserves path context for each chunk
 *
 * Based on best practices from LlamaIndex and LangChain (2025)
 */
export class JsonSplitter implements Splitter {
    private chunkSize: number = 1000;
    private chunkOverlap: number = 100;

    constructor(chunkSize?: number, chunkOverlap?: number) {
        if (chunkSize) this.chunkSize = chunkSize;
        if (chunkOverlap) this.chunkOverlap = chunkOverlap;
    }

    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
        try {
            // Parse JSON
            const jsonData = JSON.parse(code);

            // Extract chunks using recursive strategy
            const chunks = this.recursiveSplit(jsonData, '', 0);

            // Convert JSON nodes to CodeChunk format with overlap
            return this.createChunksWithOverlap(chunks, code, language, filePath);
        } catch (error) {
            console.warn(`[JsonSplitter] ⚠️  Failed to parse JSON, treating as plain text: ${error}`);
            // Fallback to simple text splitting if JSON is invalid
            return this.fallbackTextSplit(code, language, filePath);
        }
    }

    setChunkSize(chunkSize: number): void {
        this.chunkSize = chunkSize;
    }

    setChunkOverlap(chunkOverlap: number): void {
        this.chunkOverlap = chunkOverlap;
    }

    /**
     * Recursively split JSON data from deepest levels first
     * This approach preserves semantic meaning while respecting size constraints
     */
    private recursiveSplit(data: any, path: string, depth: number): JsonNode[] {
        const nodes: JsonNode[] = [];

        if (data === null || data === undefined) {
            return nodes;
        }

        // Handle arrays
        if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                const itemPath = `${path}[${i}]`;
                const itemNodes = this.recursiveSplit(data[i], itemPath, depth + 1);

                if (itemNodes.length > 0) {
                    nodes.push(...itemNodes);
                } else {
                    // Leaf node or small object
                    const jsonStr = JSON.stringify(data[i], null, 2);
                    nodes.push({
                        path: itemPath,
                        value: data[i],
                        depth,
                        size: jsonStr.length
                    });
                }
            }
        }
        // Handle objects
        else if (typeof data === 'object') {
            const keys = Object.keys(data);

            for (const key of keys) {
                const itemPath = path ? `${path}.${key}` : key;
                const itemNodes = this.recursiveSplit(data[key], itemPath, depth + 1);

                if (itemNodes.length > 0) {
                    nodes.push(...itemNodes);
                } else {
                    // Leaf node or small object
                    const jsonStr = JSON.stringify(data[key], null, 2);
                    nodes.push({
                        path: itemPath,
                        value: data[key],
                        depth,
                        size: jsonStr.length
                    });
                }
            }
        }
        // Handle primitive values
        else {
            const jsonStr = JSON.stringify(data);
            nodes.push({
                path,
                value: data,
                depth,
                size: jsonStr.length
            });
        }

        return nodes;
    }

    /**
     * Group nodes into chunks respecting size constraints
     */
    private createChunksWithOverlap(
        nodes: JsonNode[],
        originalJson: string,
        language: string,
        filePath?: string
    ): CodeChunk[] {
        const chunks: CodeChunk[] = [];
        let currentChunkNodes: JsonNode[] = [];
        let currentSize = 0;

        for (const node of nodes) {
            const nodeSize = node.size + 20; // Add overhead for formatting

            // If adding this node exceeds chunk size and we have content, create a chunk
            if (currentSize + nodeSize > this.chunkSize && currentChunkNodes.length > 0) {
                chunks.push(this.createChunk(currentChunkNodes, language, filePath));

                // Apply overlap by keeping some nodes from previous chunk
                currentChunkNodes = this.applyOverlap(currentChunkNodes);
                currentSize = currentChunkNodes.reduce((sum, n) => sum + n.size, 0);
            }

            currentChunkNodes.push(node);
            currentSize += nodeSize;

            // If single node is too large, split it
            if (nodeSize > this.chunkSize) {
                const largeNodeChunks = this.splitLargeNode(node, language, filePath);
                chunks.push(...largeNodeChunks);
                currentChunkNodes = [];
                currentSize = 0;
            }
        }

        // Add remaining nodes as final chunk
        if (currentChunkNodes.length > 0) {
            chunks.push(this.createChunk(currentChunkNodes, language, filePath));
        }

        // If no chunks created (empty JSON), create a single chunk with original content
        if (chunks.length === 0) {
            chunks.push({
                content: originalJson,
                metadata: {
                    startLine: 1,
                    endLine: originalJson.split('\n').length,
                    language,
                    filePath
                }
            });
        }

        return chunks;
    }

    /**
     * Create a code chunk from a group of JSON nodes
     */
    private createChunk(nodes: JsonNode[], language: string, filePath?: string): CodeChunk {
        // Group nodes into a coherent JSON structure
        const chunkData: any = {};

        for (const node of nodes) {
            this.setNestedValue(chunkData, node.path, node.value);
        }

        const content = JSON.stringify(chunkData, null, 2);
        const lines = content.split('\n').length;

        return {
            content,
            metadata: {
                startLine: 1,
                endLine: lines,
                language,
                filePath
            }
        };
    }

    /**
     * Apply overlap by keeping some nodes from the previous chunk
     */
    private applyOverlap(nodes: JsonNode[]): JsonNode[] {
        if (this.chunkOverlap <= 0 || nodes.length === 0) {
            return [];
        }

        let overlapSize = 0;
        const overlapNodes: JsonNode[] = [];

        // Take nodes from the end until we reach overlap size
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (overlapSize + node.size <= this.chunkOverlap) {
                overlapNodes.unshift(node);
                overlapSize += node.size;
            } else {
                break;
            }
        }

        return overlapNodes;
    }

    /**
     * Split a large node that exceeds chunk size
     */
    private splitLargeNode(node: JsonNode, language: string, filePath?: string): CodeChunk[] {
        const jsonStr = JSON.stringify(node.value, null, 2);
        const lines = jsonStr.split('\n');
        const chunks: CodeChunk[] = [];
        let currentLines: string[] = [];
        let currentSize = 0;

        for (const line of lines) {
            if (currentSize + line.length > this.chunkSize && currentLines.length > 0) {
                chunks.push({
                    content: currentLines.join('\n'),
                    metadata: {
                        startLine: 1,
                        endLine: currentLines.length,
                        language,
                        filePath
                    }
                });
                currentLines = [];
                currentSize = 0;
            }

            currentLines.push(line);
            currentSize += line.length + 1; // +1 for newline
        }

        if (currentLines.length > 0) {
            chunks.push({
                content: currentLines.join('\n'),
                metadata: {
                    startLine: 1,
                    endLine: currentLines.length,
                    language,
                    filePath
                }
            });
        }

        return chunks;
    }

    /**
     * Set a value in nested object using dot notation path
     */
    private setNestedValue(obj: any, path: string, value: any): void {
        if (!path) {
            return;
        }

        const parts = path.split(/\.|\[|\]/).filter(p => p);
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const nextPart = parts[i + 1];

            // Determine if next level should be array or object
            const isNextArray = !isNaN(Number(nextPart));

            if (!(part in current)) {
                current[part] = isNextArray ? [] : {};
            }

            current = current[part];
        }

        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }

    /**
     * Fallback text splitting for invalid JSON
     */
    private fallbackTextSplit(text: string, language: string, filePath?: string): CodeChunk[] {
        const chunks: CodeChunk[] = [];
        const lines = text.split('\n');
        let currentChunk: string[] = [];
        let currentSize = 0;
        let startLine = 1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineSize = line.length + 1;

            if (currentSize + lineSize > this.chunkSize && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.join('\n'),
                    metadata: {
                        startLine,
                        endLine: startLine + currentChunk.length - 1,
                        language,
                        filePath
                    }
                });

                // Apply overlap
                const overlapLines = Math.floor(this.chunkOverlap / 50); // Approximate lines for overlap
                currentChunk = currentChunk.slice(-overlapLines);
                startLine = startLine + currentChunk.length;
                currentSize = currentChunk.reduce((sum, l) => sum + l.length + 1, 0);
            }

            currentChunk.push(line);
            currentSize += lineSize;
        }

        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join('\n'),
                metadata: {
                    startLine,
                    endLine: startLine + currentChunk.length - 1,
                    language,
                    filePath
                }
            });
        }

        return chunks;
    }

    /**
     * Check if JSON splitting is supported (always true for this splitter)
     */
    static isSupported(): boolean {
        return true;
    }
}
