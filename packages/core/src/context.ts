import {
    Splitter,
    CodeChunk,
    AstCodeSplitter,
    JsonSplitter
} from './splitter';
import {
    Embedding,
    EmbeddingVector,
    OpenAIEmbedding
} from './embedding';
import {
    VectorDatabase,
    VectorDocument,
    VectorSearchResult,
    HybridSearchRequest,
    HybridSearchOptions,
    HybridSearchResult
} from './vectordb';
import { SemanticSearchResult } from './types';
import { envManager } from './utils/env-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileSynchronizer } from './sync/synchronizer';

import {RTK_C_AstCodeSplitter} from './splitter/rtk-c-ast-splitter';

const DEFAULT_SUPPORTED_EXTENSIONS = [
    // Programming languages
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.m', '.mm',
    // Text and markup files
    '.md', '.markdown', '.ipynb',
    // Data formats
    '.json',
    // '.txt', '.yaml', '.yml', '.xml', '.html', '.htm',
    // '.css', '.scss', '.less', '.sql', '.sh', '.bash', '.env'
];

const DEFAULT_IGNORE_PATTERNS = [
    // Common build output and dependency directories
    'node_modules/**',
    'dist/**',
    'build/**',
    'out/**',
    'target/**',
    'coverage/**',
    '.nyc_output/**',

    // IDE and editor files
    '.vscode/**',
    '.idea/**',
    '*.swp',
    '*.swo',

    // Version control
    '.git/**',
    '.svn/**',
    '.hg/**',

    // Cache directories
    '.cache/**',
    '__pycache__/**',
    '.pytest_cache/**',

    // Logs and temporary files
    'logs/**',
    'tmp/**',
    'temp/**',
    '*.log',

    // Environment and config files
    '.env',
    '.env.*',
    '*.local',

    // Minified and bundled files
    '*.min.js',
    '*.min.css',
    '*.min.map',
    '*.bundle.js',
    '*.bundle.css',
    '*.chunk.js',
    '*.vendor.js',
    '*.polyfills.js',
    '*.runtime.js',
    '*.map', // source map files
    'node_modules', '.git', '.svn', '.hg', 'build', 'dist', 'out',
    'target', '.vscode', '.idea', '__pycache__', '.pytest_cache',
    'coverage', '.nyc_output', 'logs', 'tmp', 'temp'
];

export interface ContextConfig {
    embedding?: Embedding;
    vectorDatabase?: VectorDatabase;
    codeSplitter?: Splitter;
    supportedExtensions?: string[];
    ignorePatterns?: string[];
    customExtensions?: string[]; // New: custom extensions from MCP
    customIgnorePatterns?: string[]; // New: custom ignore patterns from MCP
}

export class Context {
    private embedding: Embedding;
    private vectorDatabase: VectorDatabase;
    private codeSplitter: Splitter;
    private c_codeSplitter: Splitter;
    private jsonSplitter: JsonSplitter;
    private supportedExtensions: string[];
    private ignorePatterns: string[];
    private synchronizers = new Map<string, FileSynchronizer>();

    constructor(config: ContextConfig = {}) {
        // Initialize services
        this.embedding = config.embedding || new OpenAIEmbedding({
            apiKey: envManager.get('OPENAI_API_KEY') || 'your-openai-api-key',
            model: 'text-embedding-3-small',
            ...(envManager.get('OPENAI_BASE_URL') && { baseURL: envManager.get('OPENAI_BASE_URL') })
        });

        if (!config.vectorDatabase) {
            throw new Error('VectorDatabase is required. Please provide a vectorDatabase instance in the config.');
        }
        this.vectorDatabase = config.vectorDatabase;

        this.codeSplitter = config.codeSplitter || new AstCodeSplitter(2500, 300);
        this.jsonSplitter = new JsonSplitter(1000, 100);
        this.c_codeSplitter = new RTK_C_AstCodeSplitter(5000, 300);

        // Load custom extensions from environment variables
        const envCustomExtensions = this.getCustomExtensionsFromEnv();

        // Combine default extensions with config extensions and env extensions
        const allSupportedExtensions = [
            ...DEFAULT_SUPPORTED_EXTENSIONS,
            ...(config.supportedExtensions || []),
            ...(config.customExtensions || []),
            ...envCustomExtensions
        ];
        // Remove duplicates
        this.supportedExtensions = [...new Set(allSupportedExtensions)];

        // Load custom ignore patterns from environment variables  
        const envCustomIgnorePatterns = this.getCustomIgnorePatternsFromEnv();

        // Start with default ignore patterns
        const allIgnorePatterns = [
            ...DEFAULT_IGNORE_PATTERNS,
            ...(config.ignorePatterns || []),
            ...(config.customIgnorePatterns || []),
            ...envCustomIgnorePatterns
        ];
        // Remove duplicates
        this.ignorePatterns = [...new Set(allIgnorePatterns)];

        console.log(`[Context] 🔧 Initialized with ${this.supportedExtensions.length} supported extensions and ${this.ignorePatterns.length} ignore patterns`);
        if (envCustomExtensions.length > 0) {
            console.log(`[Context] 📎 Loaded ${envCustomExtensions.length} custom extensions from environment: ${envCustomExtensions.join(', ')}`);
        }
        if (envCustomIgnorePatterns.length > 0) {
            console.log(`[Context] 🚫 Loaded ${envCustomIgnorePatterns.length} custom ignore patterns from environment: ${envCustomIgnorePatterns.join(', ')}`);
        }
    }

    /**
     * Get embedding instance
     */
    getEmbedding(): Embedding {
        return this.embedding;
    }

    /**
     * Get vector database instance
     */
    getVectorDatabase(): VectorDatabase {
        return this.vectorDatabase;
    }

    /**
     * Get code splitter instance
     */
    getCodeSplitter(): Splitter {
        return this.codeSplitter;
    }

    /**
     * Get JSON splitter instance
     */
    getJsonSplitter(): JsonSplitter {
        return this.jsonSplitter;
    }

    /**
     * Get supported extensions
     */
    getSupportedExtensions(): string[] {
        return [...this.supportedExtensions];
    }

    /**
     * Get ignore patterns
     */
    getIgnorePatterns(): string[] {
        return [...this.ignorePatterns];
    }

    /**
     * Get synchronizers map
     */
    getSynchronizers(): Map<string, FileSynchronizer> {
        return new Map(this.synchronizers);
    }

    /**
     * Set synchronizer for a collection
     */
    setSynchronizer(collectionName: string, synchronizer: FileSynchronizer): void {
        this.synchronizers.set(collectionName, synchronizer);
    }

    /**
     * Public wrapper for loadIgnorePatterns private method
     */
    async getLoadedIgnorePatterns(codebasePath: string): Promise<void> {
        return this.loadIgnorePatterns(codebasePath);
    }

    /**
     * Public wrapper for prepareCollection private method
     */
    async getPreparedCollection(codebasePath: string): Promise<void> {
        return this.prepareCollection(codebasePath);
    }

    /**
     * Get isHybrid setting from environment variable with default true
     */
    private getIsHybrid(): boolean {
        const isHybridEnv = envManager.get('HYBRID_MODE');
        if (isHybridEnv === undefined || isHybridEnv === null) {
            return true; // Default to true
        }
        return isHybridEnv.toLowerCase() === 'true';
    }

    /**
     * Generate collection name based on codebase path and hybrid mode
     * The collection name encodes the path using base64url for reversibility
     */
    public getCollectionName(codebasePath: string): string {
        const isHybrid = this.getIsHybrid();
        const normalizedPath = path.resolve(codebasePath);

        // Encode path as base64url (URL-safe base64)
        const encodedPath = Buffer.from(normalizedPath)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        const prefix = isHybrid === true ? 'hybrid_code_chunks' : 'code_chunks';
        return `${prefix}_${encodedPath}`;
    }

    /**
     * Decode collection name to get the original codebase path
     * @param collectionName Collection name to decode
     * @returns Original codebase path or null if invalid format
     */
    public getPathFromCollectionName(collectionName: string): string | null {
        try {
            // Extract the encoded path after the prefix
            const match = collectionName.match(/^(?:hybrid_code_chunks|code_chunks)_(.+)$/);
            if (!match) {
                return null;
            }

            const encodedPath = match[1];

            // Convert base64url back to base64
            let base64 = encodedPath
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }

            // Decode base64 to get original path
            const decodedPath = Buffer.from(base64, 'base64').toString('utf-8');
            return decodedPath;
        } catch (error) {
            console.error('[Context] Failed to decode collection name:', error);
            return null;
        }
    }

    /**
     * Index a codebase for semantic search
     * @param codebasePath Codebase root path OR a single file path
     *                     - If a directory: indexes all supported files recursively
     *                     - If a file: indexes only that file
     *                     Each unique path gets its own collection for isolation
     * @param progressCallback Optional progress callback function
     * @param forceReindex Whether to recreate the collection even if it exists
     * @returns Indexing statistics
     */
    async indexCodebase(
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
        forceReindex: boolean = false,
        description: string | null = null
    ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
        const isHybrid = this.getIsHybrid();
        const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
        console.log(`[Context] 🚀 Starting to index codebase with ${searchType}: ${codebasePath}`);

        // Check if codebasePath is a file - if so, we need directory for ignore patterns but keep file path for collection
        let ignorePatternPath = codebasePath;
        let isSingleFile = false;
        try {
            const stats = await fs.promises.stat(codebasePath);
            if (stats.isFile()) {
                ignorePatternPath = path.dirname(codebasePath);
                isSingleFile = true;
                console.log(`[Context] 📄 Single file detected: ${codebasePath}`);
                console.log(`[Context] 📂 Using directory for ignore patterns: ${ignorePatternPath}`);
            }
        } catch (error) {
            console.warn(`[Context] ⚠️  Could not stat path: ${codebasePath}`);
        }

        // 1. Load ignore patterns from directory (or codebase root if it's a directory)
        await this.loadIgnorePatterns(ignorePatternPath);

        // 2. Check and prepare vector collection (use original codebasePath for unique collection name)
        progressCallback?.({ phase: 'Preparing collection...', current: 0, total: 100, percentage: 0 });
        console.log(`Debug2: Preparing vector collection for codebase${forceReindex ? ' (FORCE REINDEX)' : ''}`);
        await this.prepareCollection(codebasePath, forceReindex, description);

        // 3. Recursively traverse codebase to get all supported files
        progressCallback?.({ phase: 'Scanning files...', current: 5, total: 100, percentage: 5 });
        const codeFiles = await this.getCodeFiles(codebasePath);
        console.log(`[Context] 📁 Found ${codeFiles.length} code files`);

        if (codeFiles.length === 0) {
            progressCallback?.({ phase: 'No files to index', current: 100, total: 100, percentage: 100 });
            return { indexedFiles: 0, totalChunks: 0, status: 'completed' };
        }

        // 3. Process each file with streaming chunk processing
        // Reserve 10% for preparation, 90% for actual indexing
        const indexingStartPercentage = 10;
        const indexingEndPercentage = 100;
        const indexingRange = indexingEndPercentage - indexingStartPercentage;

        const result = await this.processFileList(
            codeFiles,
            codebasePath,
            (filePath, fileIndex, totalFiles) => {
                // Calculate progress percentage
                const progressPercentage = indexingStartPercentage + (fileIndex / totalFiles) * indexingRange;

                console.log(`[Context] 📊 Processed ${fileIndex}/${totalFiles} files`);
                progressCallback?.({
                    phase: `Processing files (${fileIndex}/${totalFiles})...`,
                    current: fileIndex,
                    total: totalFiles,
                    percentage: Math.round(progressPercentage)
                });
            }
        );

        console.log(`[Context] ✅ Codebase indexing completed! Processed ${result.processedFiles} files in total, generated ${result.totalChunks} code chunks`);

        // Flush data to make it immediately available
        try {
            const collectionName = this.getCollectionName(codebasePath);
            console.log(`[Context] 💾 Flushing ${result.totalChunks} chunks to collection...`);
            await this.vectorDatabase.flush(collectionName);
            console.log(`[Context] ✅ Data flushed successfully`);
        } catch (error) {
            console.warn(`[Context] ⚠️  Flush failed (non-critical):`, error);
        }

        progressCallback?.({
            phase: 'Indexing complete!',
            current: result.processedFiles,
            total: codeFiles.length,
            percentage: 100
        });

        return {
            indexedFiles: result.processedFiles,
            totalChunks: result.totalChunks,
            status: result.status
        };
    }

    async reindexByChange(
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void
    ): Promise<{ added: number, removed: number, modified: number }> {
        const collectionName = this.getCollectionName(codebasePath);
        const synchronizer = this.synchronizers.get(collectionName);

        if (!synchronizer) {
            // Load project-specific ignore patterns before creating FileSynchronizer
            await this.loadIgnorePatterns(codebasePath);

            // To be safe, let's initialize if it's not there.
            const newSynchronizer = new FileSynchronizer(codebasePath, this.ignorePatterns);
            await newSynchronizer.initialize();
            this.synchronizers.set(collectionName, newSynchronizer);
        }

        const currentSynchronizer = this.synchronizers.get(collectionName)!;

        progressCallback?.({ phase: 'Checking for file changes...', current: 0, total: 100, percentage: 0 });
        const { added, removed, modified } = await currentSynchronizer.checkForChanges();
        const totalChanges = added.length + removed.length + modified.length;

        if (totalChanges === 0) {
            progressCallback?.({ phase: 'No changes detected', current: 100, total: 100, percentage: 100 });
            console.log('[Context] ✅ No file changes detected.');
            return { added: 0, removed: 0, modified: 0 };
        }

        console.log(`[Context] 🔄 Found changes: ${added.length} added, ${removed.length} removed, ${modified.length} modified.`);

        let processedChanges = 0;
        const updateProgress = (phase: string) => {
            processedChanges++;
            const percentage = Math.round((processedChanges / (removed.length + modified.length + added.length)) * 100);
            progressCallback?.({ phase, current: processedChanges, total: totalChanges, percentage });
        };

        // Handle removed files
        for (const file of removed) {
            await this.deleteFileChunks(collectionName, file);
            updateProgress(`Removed ${file}`);
        }

        // Handle modified files
        for (const file of modified) {
            await this.deleteFileChunks(collectionName, file);
            updateProgress(`Deleted old chunks for ${file}`);
        }

        // Handle added and modified files
        const filesToIndex = [...added, ...modified].map(f => path.join(codebasePath, f));

        if (filesToIndex.length > 0) {
            await this.processFileList(
                filesToIndex,
                codebasePath,
                (filePath, fileIndex, totalFiles) => {
                    updateProgress(`Indexed ${filePath} (${fileIndex}/${totalFiles})`);
                }
            );
        }

        console.log(`[Context] ✅ Re-indexing complete. Added: ${added.length}, Removed: ${removed.length}, Modified: ${modified.length}`);
        progressCallback?.({ phase: 'Re-indexing complete!', current: totalChanges, total: totalChanges, percentage: 100 });

        return { added: added.length, removed: removed.length, modified: modified.length };
    }

    /**
     * Index a single file into the codebase collection
     * @param filePath Absolute path to the file
     * @param codebasePath Base path of the codebase (for collection name)
     * @param progressCallback Optional progress callback
     * @returns Indexing statistics
     */
    async indexFile(
        filePath: string,
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void
    ): Promise<{ indexedChunks: number; status: 'completed' | 'error' }> {
        const isHybrid = this.getIsHybrid();
        const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
        console.log(`[Context] 📄 Indexing single file with ${searchType}: ${filePath}`);

        try {
            // 1. Validate file
            progressCallback?.({ phase: 'Validating file...', current: 0, total: 100, percentage: 0 });
            await this.validateFile(filePath);

            // 2. Ensure collection exists
            progressCallback?.({ phase: 'Preparing collection...', current: 10, total: 100, percentage: 10 });
            const collectionName = this.getCollectionName(codebasePath);
            const hasCollection = await this.vectorDatabase.hasCollection(collectionName);

            if (!hasCollection) {
                console.log(`[Context] 📋 Collection doesn't exist, creating it...`);
                await this.prepareCollection(codebasePath, false);
            }

            // 3. Process the file
            progressCallback?.({ phase: 'Processing file...', current: 30, total: 100, percentage: 30 });
            console.log(`[Context] 📊 Processing file: ${filePath}`);

            const result = await this.processFileList(
                [filePath],
                codebasePath,
                () => {
                    progressCallback?.({ phase: 'Generating embeddings...', current: 70, total: 100, percentage: 70 });
                }
            );

            console.log(`[Context] 📊 File processing complete: ${result.processedFiles} files, ${result.totalChunks} chunks`);

            // 4. Flush data to make it immediately available
            progressCallback?.({ phase: 'Flushing data...', current: 80, total: 100, percentage: 80 });
            try {
                await this.vectorDatabase.flush(collectionName);
                console.log(`[Context] ✅ Data flushed to collection ${collectionName}`);
            } catch (error) {
                console.warn(`[Context] ⚠️  Flush failed (non-critical):`, error);
            }

            // 5. Verify data was inserted
            progressCallback?.({ phase: 'Verifying insertion...', current: 90, total: 100, percentage: 90 });
            const relativePath = path.relative(codebasePath, filePath);
            const escapedPath = relativePath.replace(/\\/g, '\\\\');

            try {
                const verifyResults = await this.vectorDatabase.query(
                    collectionName,
                    `relativePath == "${escapedPath}"`,
                    ['id'],
                    10
                );
                console.log(`[Context] ✓ Verification query: Found ${verifyResults.length} chunks for file ${relativePath}`);
            } catch (error) {
                console.warn(`[Context] ⚠️  Verification query failed:`, error);
            }

            // 5. Get overall collection stats
            try {
                const stats = await this.getIndexStats(codebasePath);
                console.log(`[Context] 📊 Collection stats: ${stats.totalChunks} total chunks, ${stats.uniqueFiles} unique files`);
            } catch (error) {
                console.warn(`[Context] ⚠️  Could not get collection stats:`, error);
            }

            progressCallback?.({ phase: 'File indexed!', current: 100, total: 100, percentage: 100 });
            console.log(`[Context] ✅ File indexed successfully: ${result.totalChunks} chunks created`);

            return {
                indexedChunks: result.totalChunks,
                status: 'completed'
            };
        } catch (error) {
            console.error(`[Context] ❌ Failed to index file ${filePath}:`, error);
            if (error instanceof Error) {
                console.error('[Context] Error stack:', error.stack);
            }
            progressCallback?.({ phase: 'Error indexing file', current: 0, total: 100, percentage: 0 });
            return {
                indexedChunks: 0,
                status: 'error'
            };
        }
    }

    /**
     * Update an existing file in the index
     * This removes old chunks and re-indexes the file
     * @param filePath Absolute path to the file
     * @param codebasePath Base path of the codebase
     * @param progressCallback Optional progress callback
     * @returns Update statistics
     */
    async updateFile(
        filePath: string,
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void
    ): Promise<{ updatedChunks: number; status: 'completed' | 'error' }> {
        console.log(`[Context] 🔄 Updating file in index: ${filePath}`);

        try {
            // 1. Validate file
            progressCallback?.({ phase: 'Validating file...', current: 0, total: 100, percentage: 0 });
            await this.validateFile(filePath);

            const collectionName = this.getCollectionName(codebasePath);
            const relativePath = path.relative(codebasePath, filePath);

            // 2. Delete existing chunks
            progressCallback?.({ phase: 'Removing old chunks...', current: 20, total: 100, percentage: 20 });
            await this.deleteFileChunks(collectionName, relativePath);

            // 3. Re-index the file
            progressCallback?.({ phase: 'Re-indexing file...', current: 40, total: 100, percentage: 40 });
            const result = await this.processFileList(
                [filePath],
                codebasePath,
                () => {
                    progressCallback?.({ phase: 'Generating embeddings...', current: 70, total: 100, percentage: 70 });
                }
            );

            // 4. Flush data
            progressCallback?.({ phase: 'Flushing data...', current: 90, total: 100, percentage: 90 });
            try {
                await this.vectorDatabase.flush(collectionName);
                console.log(`[Context] ✅ Data flushed for updated file`);
            } catch (error) {
                console.warn(`[Context] ⚠️  Flush failed (non-critical):`, error);
            }

            progressCallback?.({ phase: 'File updated!', current: 100, total: 100, percentage: 100 });
            console.log(`[Context] ✅ File updated successfully: ${result.totalChunks} chunks`);

            return {
                updatedChunks: result.totalChunks,
                status: 'completed'
            };
        } catch (error) {
            console.error(`[Context] ❌ Failed to update file ${filePath}:`, error);
            progressCallback?.({ phase: 'Error updating file', current: 0, total: 100, percentage: 0 });
            return {
                updatedChunks: 0,
                status: 'error'
            };
        }
    }

    /**
     * Remove a file from the index
     * @param filePath Absolute path to the file
     * @param codebasePath Base path of the codebase
     * @returns Number of chunks deleted
     */
    async removeFile(
        filePath: string,
        codebasePath: string
    ): Promise<{ deletedChunks: number; status: 'completed' | 'error' }> {
        console.log(`[Context] 🗑️  Removing file from index: ${filePath}`);

        try {
            const collectionName = this.getCollectionName(codebasePath);
            const relativePath = path.relative(codebasePath, filePath);

            // Check if collection exists
            const hasCollection = await this.vectorDatabase.hasCollection(collectionName);
            if (!hasCollection) {
                console.log(`[Context] ⚠️  Collection doesn't exist, nothing to remove`);
                return { deletedChunks: 0, status: 'completed' };
            }

            // Query to count chunks before deletion
            const escapedPath = relativePath.replace(/\\/g, '\\\\');
            const results = await this.vectorDatabase.query(
                collectionName,
                `relativePath == "${escapedPath}"`,
                ['id']
            );

            const chunkCount = results.length;

            // Delete chunks
            await this.deleteFileChunks(collectionName, relativePath);

            console.log(`[Context] ✅ File removed: ${chunkCount} chunks deleted`);
            return {
                deletedChunks: chunkCount,
                status: 'completed'
            };
        } catch (error) {
            console.error(`[Context] ❌ Failed to remove file ${filePath}:`, error);
            return {
                deletedChunks: 0,
                status: 'error'
            };
        }
    }

    /**
     * Validate that a file exists and is supported
     * @param filePath Path to validate
     */
    private async validateFile(filePath: string): Promise<void> {
        // Check file exists and get stats
        let stats;
        try {
            stats = await fs.promises.stat(filePath);
        } catch (error) {
            throw new Error(`File does not exist: ${filePath}`);
        }

        // Check file is not a directory
        if (stats.isDirectory()) {
            throw new Error(`Path is a directory, not a file: ${filePath}`);
        }

        // Check extension is supported
        const ext = path.extname(filePath);
        if (!this.supportedExtensions.includes(ext)) {
            throw new Error(`File extension ${ext} is not supported. Supported extensions: ${this.supportedExtensions.join(', ')}`);
        }
    }

    private async deleteFileChunks(collectionName: string, relativePath: string): Promise<void> {
        // Escape backslashes for Milvus query expression (Windows path compatibility)
        const escapedPath = relativePath.replace(/\\/g, '\\\\');
        const results = await this.vectorDatabase.query(
            collectionName,
            `relativePath == "${escapedPath}"`,
            ['id']
        );

        if (results.length > 0) {
            const ids = results.map(r => r.id as string).filter(id => id);
            if (ids.length > 0) {
                await this.vectorDatabase.delete(collectionName, ids);
                console.log(`[Context] Deleted ${ids.length} chunks for file ${relativePath}`);
            }
        }
    }

    /**
     * Semantic search with unified implementation
     * @param codebasePath Codebase path to search in
     * @param query Search query
     * @param topK Number of results to return
     * @param threshold Similarity threshold
     */
    async semanticSearch(codebasePath: string, query: string, topK: number = 5, threshold: number = 0.5, filterExpr?: string): Promise<SemanticSearchResult[]> {
        const isHybrid = this.getIsHybrid();
        const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
        console.log(`[Context] 🔍 Executing ${searchType}: "${query}" in ${codebasePath}`);

        const collectionName = this.getCollectionName(codebasePath);
        console.log(`[Context] 🔍 Using collection: ${collectionName}`);

        // Check if collection exists and has data
        const hasCollection = await this.vectorDatabase.hasCollection(collectionName);
        if (!hasCollection) {
            console.log(`[Context] ⚠️  Collection '${collectionName}' does not exist. Please index the codebase first.`);
            return [];
        }

        if (isHybrid === true) {
            try {
                // Check collection stats to see if it has data
                const stats = await this.vectorDatabase.query(collectionName, '', ['id'], 1);
                console.log(`[Context] 🔍 Collection '${collectionName}' exists and appears to have data`);
            } catch (error) {
                console.log(`[Context] ⚠️  Collection '${collectionName}' exists but may be empty or not properly indexed:`, error);
            }

            // 1. Generate query vector
            console.log(`[Context] 🔍 Generating embeddings for query: "${query}"`);
            const queryEmbedding: EmbeddingVector = await this.embedding.embed(query);
            console.log(`[Context] ✅ Generated embedding vector with dimension: ${queryEmbedding.vector.length}`);
            console.log(`[Context] 🔍 First 5 embedding values: [${queryEmbedding.vector.slice(0, 5).join(', ')}]`);

            // 2. Prepare hybrid search requests
            const searchRequests: HybridSearchRequest[] = [
                {
                    data: queryEmbedding.vector,
                    anns_field: "vector",
                    param: { "nprobe": 10 },
                    limit: topK
                },
                {
                    data: query,
                    anns_field: "sparse_vector",
                    param: { "drop_ratio_search": 0.2 },
                    limit: topK
                }
            ];

            console.log(`[Context] 🔍 Search request 1 (dense): anns_field="${searchRequests[0].anns_field}", vector_dim=${queryEmbedding.vector.length}, limit=${searchRequests[0].limit}`);
            console.log(`[Context] 🔍 Search request 2 (sparse): anns_field="${searchRequests[1].anns_field}", query_text="${query}", limit=${searchRequests[1].limit}`);

            // 3. Execute hybrid search
            console.log(`[Context] 🔍 Executing hybrid search with RRF reranking...`);
            const searchResults: HybridSearchResult[] = await this.vectorDatabase.hybridSearch(
                collectionName,
                searchRequests,
                {
                    rerank: {
                        strategy: 'rrf',
                        params: { k: 100 }
                    },
                    limit: topK,
                    filterExpr
                }
            );

            console.log(`[Context] 🔍 Raw search results count: ${searchResults.length}`);

            // 4. Convert to semantic search result format
            const results: SemanticSearchResult[] = searchResults.map(result => ({
                content: result.document.content,
                relativePath: result.document.relativePath,
                startLine: result.document.startLine,
                endLine: result.document.endLine,
                language: result.document.metadata.language || 'unknown',
                score: result.score
            }));

            console.log(`[Context] ✅ Found ${results.length} relevant hybrid results`);
            if (results.length > 0) {
                console.log(`[Context] 🔍 Top result score: ${results[0].score}, path: ${results[0].relativePath}`);
            }

            return results;
        } else {
            // Regular semantic search
            // 1. Generate query vector
            const queryEmbedding: EmbeddingVector = await this.embedding.embed(query);

            // 2. Search in vector database
            const searchResults: VectorSearchResult[] = await this.vectorDatabase.search(
                collectionName,
                queryEmbedding.vector,
                { topK, threshold, filterExpr }
            );

            // 3. Convert to semantic search result format
            const results: SemanticSearchResult[] = searchResults.map(result => ({
                content: result.document.content,
                relativePath: result.document.relativePath,
                startLine: result.document.startLine,
                endLine: result.document.endLine,
                language: result.document.metadata.language || 'unknown',
                score: result.score
            }));

            console.log(`[Context] ✅ Found ${results.length} relevant results`);
            return results;
        }
    }

    /**
     * Check if index exists for codebase
     * @param codebasePath Codebase path to check
     * @returns Whether index exists
     */
    async hasIndex(codebasePath: string): Promise<boolean> {
        const collectionName = this.getCollectionName(codebasePath);
        return await this.vectorDatabase.hasCollection(collectionName);
    }

    /**
     * Get statistics about the indexed codebase
     * @param codebasePath Codebase path
     * @returns Statistics including total chunks and file count
     */
    async getIndexStats(codebasePath: string): Promise<{ totalChunks: number; uniqueFiles: number; collectionName: string }> {
        const collectionName = this.getCollectionName(codebasePath);

        const hasCollection = await this.vectorDatabase.hasCollection(collectionName);
        if (!hasCollection) {
            return { totalChunks: 0, uniqueFiles: 0, collectionName };
        }

        try {
            // Query all documents to count them
            const allDocs = await this.vectorDatabase.query(collectionName, '', ['id', 'relativePath'], 100000);

            // Count unique files
            const uniquePaths = new Set(allDocs.map(doc => doc.relativePath));

            return {
                totalChunks: allDocs.length,
                uniqueFiles: uniquePaths.size,
                collectionName
            };
        } catch (error) {
            console.warn(`[Context] ⚠️  Failed to get index stats:`, error);
            return { totalChunks: 0, uniqueFiles: 0, collectionName };
        }
    }

    /**
     * Clear index
     * @param codebasePath Codebase path to clear index for
     * @param progressCallback Optional progress callback function
     */
    async clearIndex(
        codebasePath: string,
        progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void
    ): Promise<void> {
        console.log(`[Context] 🧹 Cleaning index data for ${codebasePath}...`);

        progressCallback?.({ phase: 'Checking existing index...', current: 0, total: 100, percentage: 0 });

        const collectionName = this.getCollectionName(codebasePath);
        const collectionExists = await this.vectorDatabase.hasCollection(collectionName);

        progressCallback?.({ phase: 'Removing index data...', current: 50, total: 100, percentage: 50 });

        if (collectionExists) {
            await this.vectorDatabase.dropCollection(collectionName);
        }

        // Delete snapshot file
        await FileSynchronizer.deleteSnapshot(codebasePath);

        progressCallback?.({ phase: 'Index cleared', current: 100, total: 100, percentage: 100 });
        console.log('[Context] ✅ Index data cleaned');
    }

    /**
     * Update ignore patterns (merges with default patterns and existing patterns)
     * @param ignorePatterns Array of ignore patterns to add to defaults
     */
    updateIgnorePatterns(ignorePatterns: string[]): void {
        // Merge with default patterns and any existing custom patterns, avoiding duplicates
        const mergedPatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];
        const uniquePatterns: string[] = [];
        const patternSet = new Set(mergedPatterns);
        patternSet.forEach(pattern => uniquePatterns.push(pattern));
        this.ignorePatterns = uniquePatterns;
        console.log(`[Context] 🚫 Updated ignore patterns: ${ignorePatterns.length} new + ${DEFAULT_IGNORE_PATTERNS.length} default = ${this.ignorePatterns.length} total patterns`);
    }

    /**
     * Add custom ignore patterns (from MCP or other sources) without replacing existing ones
     * @param customPatterns Array of custom ignore patterns to add
     */
    addCustomIgnorePatterns(customPatterns: string[]): void {
        if (customPatterns.length === 0) return;

        // Merge current patterns with new custom patterns, avoiding duplicates
        const mergedPatterns = [...this.ignorePatterns, ...customPatterns];
        const uniquePatterns: string[] = [];
        const patternSet = new Set(mergedPatterns);
        patternSet.forEach(pattern => uniquePatterns.push(pattern));
        this.ignorePatterns = uniquePatterns;
        console.log(`[Context] 🚫 Added ${customPatterns.length} custom ignore patterns. Total: ${this.ignorePatterns.length} patterns`);
    }

    /**
     * Reset ignore patterns to defaults only
     */
    resetIgnorePatternsToDefaults(): void {
        this.ignorePatterns = [...DEFAULT_IGNORE_PATTERNS];
        console.log(`[Context] 🔄 Reset ignore patterns to defaults: ${this.ignorePatterns.length} patterns`);
    }

    /**
     * Update embedding instance
     * @param embedding New embedding instance
     */
    updateEmbedding(embedding: Embedding): void {
        this.embedding = embedding;
        console.log(`[Context] 🔄 Updated embedding provider: ${embedding.getProvider()}`);
    }

    /**
     * Update vector database instance
     * @param vectorDatabase New vector database instance
     */
    updateVectorDatabase(vectorDatabase: VectorDatabase): void {
        this.vectorDatabase = vectorDatabase;
        console.log(`[Context] 🔄 Updated vector database`);
    }

    /**
     * Update splitter instance
     * @param splitter New splitter instance
     */
    updateSplitter(splitter: Splitter): void {
        this.codeSplitter = splitter;
        console.log(`[Context] 🔄 Updated splitter instance`);
    }

    /**
     * Prepare vector collection
     */
    private async prepareCollection(codebasePath: string, forceReindex: boolean = false, description: string | null = null): Promise<void> {
        const isHybrid = this.getIsHybrid();
        const collectionType = isHybrid === true ? 'hybrid vector' : 'vector';
        console.log(`[Context] 🔧 Preparing ${collectionType} collection for codebase: ${codebasePath}${forceReindex ? ' (FORCE REINDEX)' : ''}`);
        const collectionName = this.getCollectionName(codebasePath);
        console.log(`[Context] collection name ${collectionName}: ${description}`);

        // Check if collection already exists
        const collectionExists = await this.vectorDatabase.hasCollection(collectionName);

        if (collectionExists && !forceReindex) {
            console.log(`📋 Collection ${collectionName} already exists, skipping creation`);
            return;
        }

        if (collectionExists && forceReindex) {
            console.log(`[Context] 🗑️  Dropping existing collection ${collectionName} for force reindex...`);
            await this.vectorDatabase.dropCollection(collectionName);
            console.log(`[Context] ✅ Collection ${collectionName} dropped successfully`);
        }

        console.log(`[Context] 🔍 Detecting embedding dimension for ${this.embedding.getProvider()} provider...`);
        const dimension = await this.embedding.detectDimension();
        console.log(`[Context] 📏 Detected dimension: ${dimension} for ${this.embedding.getProvider()}`);
        const dirName = path.basename(codebasePath);

        if (isHybrid === true) {
            await this.vectorDatabase.createHybridCollection(collectionName, dimension, description || `Hybrid Index for ${dirName}`);
        } else {
            await this.vectorDatabase.createCollection(collectionName, dimension, description || `Index for ${dirName}`);
        }

        console.log(`[Context] ✅ Collection ${collectionName} created successfully (dimension: ${dimension})`);
    }

    /**
     * Recursively get all code files in the codebase
     */
    private async getCodeFiles(codebasePath: string): Promise<string[]> {
        const files: string[] = [];

        // Check if the initial path is a file rather than a directory
        try {
            const initialStats = await fs.promises.stat(codebasePath);
            if (initialStats.isFile()) {
                // If it's a file, just return it if it has a supported extension
                const ext = path.extname(codebasePath);
                if (this.supportedExtensions.includes(ext)) {
                    console.log(`[Context] 📄 Single file detected: ${codebasePath}`);
                    return [codebasePath];
                } else {
                    console.warn(`[Context] ⚠️  File has unsupported extension ${ext}: ${codebasePath}`);
                    return [];
                }
            }
        } catch (error) {
            console.warn(`[Context] ⚠️  Could not access path: ${codebasePath}`);
            return [];
        }

        const traverseDirectory = async (currentPath: string) => {
            try {
                // Verify path is actually a directory before trying to read it
                const stats = await fs.promises.stat(currentPath);
                if (!stats.isDirectory()) {
                    console.warn(`[Context] ⚠️  Skipping non-directory path: ${currentPath}`);
                    return;
                }

                const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);

                    // Check if path matches ignore patterns
                    if (this.matchesIgnorePattern(fullPath, codebasePath)) {
                        continue;
                    }

                    try {
                        // For symlinks and other edge cases, verify the actual type
                        if (entry.isSymbolicLink()) {
                            const linkStats = await fs.promises.stat(fullPath);
                            if (linkStats.isDirectory()) {
                                await traverseDirectory(fullPath);
                            } else if (linkStats.isFile()) {
                                const ext = path.extname(entry.name);
                                if (this.supportedExtensions.includes(ext)) {
                                    files.push(fullPath);
                                }
                            }
                        } else if (entry.isDirectory()) {
                            await traverseDirectory(fullPath);
                        } else if (entry.isFile()) {
                            const ext = path.extname(entry.name);
                            if (this.supportedExtensions.includes(ext)) {
                                files.push(fullPath);
                            }
                        }
                    } catch (error) {
                        // Skip entries that cause errors (broken symlinks, permission issues, etc.)
                        console.warn(`[Context] ⚠️  Skipping problematic entry ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
                        continue;
                    }
                }
            } catch (error) {
                // Handle errors when reading directory
                if ((error as NodeJS.ErrnoException).code === 'ENOTDIR') {
                    console.warn(`[Context] ⚠️  Path is not a directory, skipping: ${currentPath}`);
                } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
                    console.warn(`[Context] ⚠️  Permission denied, skipping: ${currentPath}`);
                } else {
                    console.warn(`[Context] ⚠️  Error reading directory ${currentPath}: ${error instanceof Error ? error.message : String(error)}`);
                }
                return;
            }
        };

        await traverseDirectory(codebasePath);
        return files;
    }

    /**
 * Process a list of files with streaming chunk processing
 * @param filePaths Array of file paths to process
 * @param codebasePath Base path for the codebase
 * @param onFileProcessed Callback called when each file is processed
 * @returns Object with processed file count and total chunk count
 */
    private async processFileList(
        filePaths: string[],
        codebasePath: string,
        onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void
    ): Promise<{ processedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
        const isHybrid = this.getIsHybrid();
        const EMBEDDING_BATCH_SIZE = Math.max(1, parseInt(envManager.get('EMBEDDING_BATCH_SIZE') || '100', 10));
        const CHUNK_LIMIT = 450000;
        console.log(`[Context] 🔧 Using EMBEDDING_BATCH_SIZE: ${EMBEDDING_BATCH_SIZE}`);

        let chunkBuffer: Array<{ chunk: CodeChunk; codebasePath: string }> = [];
        let processedFiles = 0;
        let totalChunks = 0;
        let limitReached = false;

        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];

            try {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                const language = this.getLanguageFromExtension(path.extname(filePath));
                const splitter = this.selectSplitter(language);
                const chunks = await splitter.split(content, language, filePath);

                console.log(`[Context] 📝 File ${path.basename(filePath)} (${language}): ${chunks.length} chunks generated from ${Math.round(content.length / 1024)}KB`);

                // Log files with many chunks or large content
                if (chunks.length > 50) {
                    console.warn(`[Context] ⚠️  File ${filePath} generated ${chunks.length} chunks (${Math.round(content.length / 1024)}KB)`);
                } else if (content.length > 100000) {
                    console.log(`📄 Large file ${filePath}: ${Math.round(content.length / 1024)}KB -> ${chunks.length} chunks`);
                }

                if (chunks.length === 0) {
                    console.warn(`[Context] ⚠️  No chunks generated for ${filePath}`);
                }

                // Add chunks to buffer
                for (const chunk of chunks) {
                    chunkBuffer.push({ chunk, codebasePath });
                    totalChunks++;

                    // Process batch when buffer reaches EMBEDDING_BATCH_SIZE
                    if (chunkBuffer.length >= EMBEDDING_BATCH_SIZE) {
                        try {
                            await this.processChunkBuffer(chunkBuffer);
                        } catch (error) {
                            const searchType = isHybrid === true ? 'hybrid' : 'regular';
                            console.error(`[Context] ❌ Failed to process chunk batch for ${searchType}:`, error);
                            if (error instanceof Error) {
                                console.error('[Context] Stack trace:', error.stack);
                            }
                        } finally {
                            chunkBuffer = []; // Always clear buffer, even on failure
                        }
                    }

                    // Check if chunk limit is reached
                    if (totalChunks >= CHUNK_LIMIT) {
                        console.warn(`[Context] ⚠️  Chunk limit of ${CHUNK_LIMIT} reached. Stopping indexing.`);
                        limitReached = true;
                        break; // Exit the inner loop (over chunks)
                    }
                }

                processedFiles++;
                onFileProcessed?.(filePath, i + 1, filePaths.length);

                if (limitReached) {
                    break; // Exit the outer loop (over files)
                }

            } catch (error) {
                console.warn(`[Context] ⚠️  Skipping file ${filePath}: ${error}`);
            }
        }

        // Process any remaining chunks in the buffer
        if (chunkBuffer.length > 0) {
            const searchType = isHybrid === true ? 'hybrid' : 'regular';
            console.log(`📝 Processing final batch of ${chunkBuffer.length} chunks for ${searchType}`);
            try {
                await this.processChunkBuffer(chunkBuffer);
            } catch (error) {
                console.error(`[Context] ❌ Failed to process final chunk batch for ${searchType}:`, error);
                if (error instanceof Error) {
                    console.error('[Context] Stack trace:', error.stack);
                }
            }
        }

        return {
            processedFiles,
            totalChunks,
            status: limitReached ? 'limit_reached' : 'completed'
        };
    }

    /**
 * Process accumulated chunk buffer
 */
    private async processChunkBuffer(chunkBuffer: Array<{ chunk: CodeChunk; codebasePath: string }>): Promise<void> {
        if (chunkBuffer.length === 0) return;

        // Extract chunks and ensure they all have the same codebasePath
        const chunks = chunkBuffer.map(item => item.chunk);
        const codebasePath = chunkBuffer[0].codebasePath;

        // Estimate tokens (rough estimation: 1 token ≈ 4 characters)
        const estimatedTokens = chunks.reduce((sum, chunk) => sum + Math.ceil(chunk.content.length / 4), 0);

        const isHybrid = this.getIsHybrid();
        const searchType = isHybrid === true ? 'hybrid' : 'regular';
        console.log(`[Context] 🔄 Processing batch of ${chunks.length} chunks (~${estimatedTokens} tokens) for ${searchType}`);
        await this.processChunkBatch(chunks, codebasePath);
    }

    /**
     * Process a batch of chunks
     */
    private async processChunkBatch(chunks: CodeChunk[], codebasePath: string): Promise<void> {
        const isHybrid = this.getIsHybrid();

        // Generate embedding vectors
        const chunkContents = chunks.map(chunk => chunk.content);
        const embeddings = await this.embedding.embedBatch(chunkContents);

        if (isHybrid === true) {
            // Create hybrid vector documents
            const documents: VectorDocument[] = chunks.map((chunk, index) => {
                if (!chunk.metadata.filePath) {
                    throw new Error(`Missing filePath in chunk metadata at index ${index}`);
                }

                // Calculate relative path - handle case where codebasePath is a file
                let relativePath = path.relative(codebasePath, chunk.metadata.filePath);
                if (!relativePath || relativePath === '') {
                    // If codebasePath is the file itself, use just the filename
                    relativePath = path.basename(chunk.metadata.filePath);
                }
                const fileExtension = path.extname(chunk.metadata.filePath);
                const { filePath, startLine, endLine, ...restMetadata } = chunk.metadata;

                return {
                    id: this.generateId(relativePath, chunk.metadata.startLine || 0, chunk.metadata.endLine || 0, chunk.content),
                    content: chunk.content, // Full text content for BM25 and storage
                    vector: embeddings[index].vector, // Dense vector
                    relativePath,
                    startLine: chunk.metadata.startLine || 0,
                    endLine: chunk.metadata.endLine || 0,
                    fileExtension,
                    metadata: {
                        ...restMetadata,
                        codebasePath,
                        language: chunk.metadata.language || 'unknown',
                        chunkIndex: index
                    }
                };
            });

            // Store to vector database
            const collectionName = this.getCollectionName(codebasePath);
            await this.vectorDatabase.insertHybrid(collectionName, documents);
            console.log(`[Context] ✅ Inserted ${documents.length} hybrid documents into ${collectionName}`);
        } else {
            // Create regular vector documents
            const documents: VectorDocument[] = chunks.map((chunk, index) => {
                if (!chunk.metadata.filePath) {
                    throw new Error(`Missing filePath in chunk metadata at index ${index}`);
                }

                // Calculate relative path - handle case where codebasePath is a file
                let relativePath = path.relative(codebasePath, chunk.metadata.filePath);
                if (!relativePath || relativePath === '') {
                    // If codebasePath is the file itself, use just the filename
                    relativePath = path.basename(chunk.metadata.filePath);
                }
                const fileExtension = path.extname(chunk.metadata.filePath);
                const { filePath, startLine, endLine, ...restMetadata } = chunk.metadata;

                return {
                    id: this.generateId(relativePath, chunk.metadata.startLine || 0, chunk.metadata.endLine || 0, chunk.content),
                    vector: embeddings[index].vector,
                    content: chunk.content,
                    relativePath,
                    startLine: chunk.metadata.startLine || 0,
                    endLine: chunk.metadata.endLine || 0,
                    fileExtension,
                    metadata: {
                        ...restMetadata,
                        codebasePath,
                        language: chunk.metadata.language || 'unknown',
                        chunkIndex: index
                    }
                };
            });

            // Store to vector database
            const collectionName = this.getCollectionName(codebasePath);
            await this.vectorDatabase.insert(collectionName, documents);
            console.log(`[Context] ✅ Inserted ${documents.length} documents into ${collectionName}`);
        }
    }

    /**
     * Get programming language based on file extension
     */
    private getLanguageFromExtension(ext: string): string {
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.m': 'objective-c',
            '.mm': 'objective-c',
            '.ipynb': 'jupyter',
            '.json': 'json'
        };
        return languageMap[ext] || 'text';
    }

    /**
     * Smart splitter selection based on file language/format
     * Uses specialized splitters for optimal chunking:
     * - JsonSplitter for JSON files (recursive splitting preserving structure)
     * - AstCodeSplitter for code files (AST-based with LangChain fallback)
     */
    private selectSplitter(language: string): Splitter {
        // RTK
        if (language === 'json') {
            console.log('🔧 Selected JsonSplitter for JSON format');
            return this.jsonSplitter;
        }
        // RTK
        if (language === 'c')
        {
            console.log('🔧 Selected RTK customized for C format');
            return this.c_codeSplitter;

        }
        return this.codeSplitter;
    }

    /**
     * Generate unique ID based on chunk content and location
     * @param relativePath Relative path to the file
     * @param startLine Start line number
     * @param endLine End line number
     * @param content Chunk content
     * @returns Hash-based unique ID
     */
    private generateId(relativePath: string, startLine: number, endLine: number, content: string): string {
        const combinedString = `${relativePath}:${startLine}:${endLine}:${content}`;
        const hash = crypto.createHash('sha256').update(combinedString, 'utf-8').digest('hex');
        return `chunk_${hash.substring(0, 16)}`;
    }

    /**
     * Read ignore patterns from file (e.g., .gitignore)
     * @param filePath Path to the ignore file
     * @returns Array of ignore patterns
     */
    static async getIgnorePatternsFromFile(filePath: string): Promise<string[]> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')); // Filter out empty lines and comments
        } catch (error) {
            console.warn(`[Context] ⚠️  Could not read ignore file ${filePath}: ${error}`);
            return [];
        }
    }

    /**
     * Load ignore patterns from various ignore files in the codebase
     * This method preserves any existing custom patterns that were added before
     * @param codebasePath Path to the codebase
     */
    private async loadIgnorePatterns(codebasePath: string): Promise<void> {
        try {
            let fileBasedPatterns: string[] = [];

            // Load all .xxxignore files in codebase directory
            const ignoreFiles = await this.findIgnoreFiles(codebasePath);
            for (const ignoreFile of ignoreFiles) {
                const patterns = await this.loadIgnoreFile(ignoreFile, path.basename(ignoreFile));
                fileBasedPatterns.push(...patterns);
            }

            // Load global ~/.context/.contextignore
            const globalIgnorePatterns = await this.loadGlobalIgnoreFile();
            fileBasedPatterns.push(...globalIgnorePatterns);

            // Merge file-based patterns with existing patterns (which may include custom MCP patterns)
            if (fileBasedPatterns.length > 0) {
                this.addCustomIgnorePatterns(fileBasedPatterns);
                console.log(`[Context] 🚫 Loaded total ${fileBasedPatterns.length} ignore patterns from all ignore files`);
            } else {
                console.log('📄 No ignore files found, keeping existing patterns');
            }
        } catch (error) {
            console.warn(`[Context] ⚠️ Failed to load ignore patterns: ${error}`);
            // Continue with existing patterns on error - don't reset them
        }
    }

    /**
     * Find all .xxxignore files in the codebase directory
     * @param codebasePath Path to the codebase
     * @returns Array of ignore file paths
     */
    private async findIgnoreFiles(codebasePath: string): Promise<string[]> {
        try {
            const entries = await fs.promises.readdir(codebasePath, { withFileTypes: true });
            const ignoreFiles: string[] = [];

            for (const entry of entries) {
                if (entry.isFile() &&
                    entry.name.startsWith('.') &&
                    entry.name.endsWith('ignore')) {
                    ignoreFiles.push(path.join(codebasePath, entry.name));
                }
            }

            if (ignoreFiles.length > 0) {
                console.log(`📄 Found ignore files: ${ignoreFiles.map(f => path.basename(f)).join(', ')}`);
            }

            return ignoreFiles;
        } catch (error) {
            console.warn(`[Context] ⚠️ Failed to scan for ignore files: ${error}`);
            return [];
        }
    }

    /**
     * Load global ignore file from ~/.context/.contextignore
     * @returns Array of ignore patterns
     */
    private async loadGlobalIgnoreFile(): Promise<string[]> {
        try {
            const homeDir = require('os').homedir();
            const globalIgnorePath = path.join(homeDir, '.context', '.contextignore');
            return await this.loadIgnoreFile(globalIgnorePath, 'global .contextignore');
        } catch (error) {
            // Global ignore file is optional, don't log warnings
            return [];
        }
    }

    /**
     * Load ignore patterns from a specific ignore file
     * @param filePath Path to the ignore file
     * @param fileName Display name for logging
     * @returns Array of ignore patterns
     */
    private async loadIgnoreFile(filePath: string, fileName: string): Promise<string[]> {
        try {
            await fs.promises.access(filePath);
            console.log(`📄 Found ${fileName} file at: ${filePath}`);

            const ignorePatterns = await Context.getIgnorePatternsFromFile(filePath);

            if (ignorePatterns.length > 0) {
                console.log(`[Context] 🚫 Loaded ${ignorePatterns.length} ignore patterns from ${fileName}`);
                return ignorePatterns;
            } else {
                console.log(`📄 ${fileName} file found but no valid patterns detected`);
                return [];
            }
        } catch (error) {
            if (fileName.includes('global')) {
                console.log(`📄 No ${fileName} file found`);
            }
            return [];
        }
    }

    /**
     * Check if a path matches any ignore pattern
     * @param filePath Path to check
     * @param basePath Base path for relative pattern matching
     * @returns True if path should be ignored
     */
    private matchesIgnorePattern(filePath: string, basePath: string): boolean {
        if (this.ignorePatterns.length === 0) {
            return false;
        }

        const relativePath = path.relative(basePath, filePath);
        const normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize path separators

        for (const pattern of this.ignorePatterns) {
            if (this.isPatternMatch(normalizedPath, pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Simple glob pattern matching
     * @param filePath File path to test
     * @param pattern Glob pattern
     * @returns True if pattern matches
     */
    private isPatternMatch(filePath: string, pattern: string): boolean {
        // Handle directory patterns (ending with /)
        if (pattern.endsWith('/')) {
            const dirPattern = pattern.slice(0, -1);
            const pathParts = filePath.split('/');
            return pathParts.some(part => this.simpleGlobMatch(part, dirPattern));
        }

        // Handle file patterns
        if (pattern.includes('/')) {
            // Pattern with path separator - match exact path
            return this.simpleGlobMatch(filePath, pattern);
        } else {
            // Pattern without path separator - match filename in any directory
            const fileName = path.basename(filePath);
            return this.simpleGlobMatch(fileName, pattern);
        }
    }

    /**
     * Simple glob matching supporting * wildcard
     * @param text Text to test
     * @param pattern Pattern with * wildcards
     * @returns True if pattern matches
     */
    private simpleGlobMatch(text: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
            .replace(/\*/g, '.*'); // Convert * to .*

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text);
    }

    /**
     * Get custom extensions from environment variables
     * Supports CUSTOM_EXTENSIONS as comma-separated list
     * @returns Array of custom extensions
     */
    private getCustomExtensionsFromEnv(): string[] {
        const envExtensions = envManager.get('CUSTOM_EXTENSIONS');
        if (!envExtensions) {
            return [];
        }

        try {
            const extensions = envExtensions
                .split(',')
                .map(ext => ext.trim())
                .filter(ext => ext.length > 0)
                .map(ext => ext.startsWith('.') ? ext : `.${ext}`); // Ensure extensions start with dot

            return extensions;
        } catch (error) {
            console.warn(`[Context] ⚠️  Failed to parse CUSTOM_EXTENSIONS: ${error}`);
            return [];
        }
    }

    /**
     * Get custom ignore patterns from environment variables  
     * Supports CUSTOM_IGNORE_PATTERNS as comma-separated list
     * @returns Array of custom ignore patterns
     */
    private getCustomIgnorePatternsFromEnv(): string[] {
        const envIgnorePatterns = envManager.get('CUSTOM_IGNORE_PATTERNS');
        if (!envIgnorePatterns) {
            return [];
        }

        try {
            const patterns = envIgnorePatterns
                .split(',')
                .map(pattern => pattern.trim())
                .filter(pattern => pattern.length > 0);

            return patterns;
        } catch (error) {
            console.warn(`[Context] ⚠️  Failed to parse CUSTOM_IGNORE_PATTERNS: ${error}`);
            return [];
        }
    }

    /**
     * Add custom extensions (from MCP or other sources) without replacing existing ones
     * @param customExtensions Array of custom extensions to add
     */
    addCustomExtensions(customExtensions: string[]): void {
        if (customExtensions.length === 0) return;

        // Ensure extensions start with dot
        const normalizedExtensions = customExtensions.map(ext =>
            ext.startsWith('.') ? ext : `.${ext}`
        );

        // Merge current extensions with new custom extensions, avoiding duplicates
        const mergedExtensions = [...this.supportedExtensions, ...normalizedExtensions];
        const uniqueExtensions: string[] = [...new Set(mergedExtensions)];
        this.supportedExtensions = uniqueExtensions;
        console.log(`[Context] 📎 Added ${customExtensions.length} custom extensions. Total: ${this.supportedExtensions.length} extensions`);
    }

    /**
     * Get current splitter information
     */
    getSplitterInfo(): { type: string; hasBuiltinFallback: boolean; supportedLanguages?: string[]; hasJsonSupport?: boolean } {
        const splitterName = this.codeSplitter.constructor.name;

        const info: { type: string; hasBuiltinFallback: boolean; supportedLanguages?: string[]; hasJsonSupport?: boolean } = {
            type: 'unknown',
            hasBuiltinFallback: false,
            hasJsonSupport: true
        };

        if (splitterName === 'AstCodeSplitter') {
            const { AstCodeSplitter } = require('./splitter/ast-splitter');
            info.type = 'ast';
            info.hasBuiltinFallback = true;
            info.supportedLanguages = AstCodeSplitter.getSupportedLanguages?.() || [];
        } else {
            info.type = 'langchain';
            info.hasBuiltinFallback = false;
        }

        return info;
    }

    /**
     * Check if current splitter supports a specific language
     * @param language Programming language
     */
    isLanguageSupported(language: string): boolean {
        // JSON is always supported via dedicated JsonSplitter
        if (language === 'json') {
            return true;
        }

        const splitterName = this.codeSplitter.constructor.name;

        if (splitterName === 'AstCodeSplitter') {
            const { AstCodeSplitter } = require('./splitter/ast-splitter');
            return AstCodeSplitter.isLanguageSupported(language);
        }

        // LangChain splitter supports most languages
        return true;
    }

    /**
     * Get which strategy would be used for a specific language
     * @param language Programming language
     */
    getSplitterStrategyForLanguage(language: string): { strategy: 'ast' | 'langchain' | 'json'; reason: string } {
        // JSON files use dedicated JsonSplitter
        if (language === 'json') {
            return {
                strategy: 'json',
                reason: 'Using specialized JsonSplitter for recursive JSON splitting'
            };
        }

        const splitterName = this.codeSplitter.constructor.name;

        if (splitterName === 'AstCodeSplitter') {
            const { AstCodeSplitter } = require('./splitter/ast-splitter');
            const isSupported = AstCodeSplitter.isLanguageSupported(language);

            return {
                strategy: isSupported ? 'ast' : 'langchain',
                reason: isSupported
                    ? 'Language supported by AST parser'
                    : 'Language not supported by AST, will fallback to LangChain'
            };
        } else {
            return {
                strategy: 'langchain',
                reason: 'Using LangChain splitter directly'
            };
        }
    }
}
