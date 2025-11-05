/**
 * Request body for indexing a codebase
 */
export type IndexRequest = {
  /** Action type */
  action: 'index';
  /** Absolute path to the codebase directory */
  codebasePath: string;
  /** Unique session ID for tracking progress */
  sessionId?: string;
};

/**
 * Request body for searching the codebase
 */
export type SearchRequest = {
  /** Action type */
  action: 'search';
  /** Path to the indexed codebase */
  codebasePath: string;
  /** Search query in natural language */
  query: string;
  /** Maximum number of results to return (default: 5) */
  maxResults?: number;
  /** Similarity threshold (0-1, default: 0.5) */
  threshold?: number;
  /** Optional filter expression for metadata fields */
  filter?: string;
};

/**
 * Request body for getting collections list
 */
export type GetCollectionsRequest = {
  /** Action type */
  action: 'get_collections';
};

/**
 * Request body for clearing a collection
 */
export type ClearRequest = {
  /** Action type */
  action: 'clear';
  /** Path to the codebase collection to clear */
  codebasePath: string;
};

/**
 * Request body for getting relative paths
 */
export type GetRelativePathsRequest = {
  /** Action type */
  action: 'get_relative_paths';
  /** Path to the indexed codebase */
  codebasePath: string;
};

/**
 * Collection information
 */
export type Collection = {
  /** Collection name */
  name: string;
  /** Original codebase path */
  path: string;
};

/**
 * Indexing statistics
 */
export type IndexStats = {
  /** Number of files indexed */
  indexedFiles: number;
  /** Total number of code chunks created */
  totalChunks: number;
};

/**
 * Search result item
 */
export type SearchResult = {
  /** Relative path to the file */
  relativePath: string;
  /** Starting line number */
  startLine: number;
  /** Ending line number */
  endLine: number;
  /** Code content */
  content: string;
  /** Similarity score (0-1) */
  score: number;
};

/**
 * Success response for indexing
 */
export type IndexResponse = {
  /** Success indicator */
  success: true;
  /** Indexing statistics */
  stats: IndexStats;
};

/**
 * Success response for search
 */
export type SearchResponse = {
  /** Success indicator */
  success: true;
  /** Array of search results */
  results: SearchResult[];
};

/**
 * Success response for getting collections
 */
export type GetCollectionsResponse = {
  /** Success indicator */
  success: true;
  /** List of available collections */
  collections: Collection[];
};

/**
 * Success response for clearing collection
 */
export type ClearResponse = {
  /** Success indicator */
  success: true;
};

/**
 * Success response for getting relative paths
 */
export type GetRelativePathsResponse = {
  /** Success indicator */
  success: true;
  /** Array of unique relative paths in the collection */
  relativePaths: string[];
};

/**
 * Error response
 */
export type ErrorResponse = {
  /** Error message */
  error: string;
};

/**
 * Progress data for Server-Sent Events
 */
export type ProgressData = {
  /** Current phase of indexing */
  phase: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Optional progress message */
  message?: string;
  /** Timestamp of the update */
  timestamp: number;
  /** Whether indexing is currently active */
  isActive: boolean;
};
