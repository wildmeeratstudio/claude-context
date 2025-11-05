import { NextRequest, NextResponse } from 'next/server';
import { getContext, validateCredentials } from '../lib/context';

export type SearchRequest = {
  /** Path to the indexed codebase */
  codebasePath: string;
  /** Search query in natural language */
  query: string;
  /** Maximum number of results to return (default: 5) */
  maxResults?: number;
  /** Similarity threshold (0-1, default: 0.5) */
  threshold?: number;
  /** Optional filter expression for metadata fields (e.g., relativePath == "src/utils.ts") */
  filter?: string;
};

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

export type SearchResponse = {
  /** Success indicator */
  success: true;
  /** Array of search results */
  results: SearchResult[];
};

export type ErrorResponse = {
  /** Error message */
  error: string;
};

/**
 * Search codebase
 * @description Perform semantic search on an indexed codebase using natural language queries
 * @body SearchRequest
 * @response 200:SearchResponse:Search completed successfully
 * @response 400:ErrorResponse:Missing required parameters or credentials
 * @response 500:ErrorResponse:Internal server error
 * @tag Search
 * @openapi
 */
export async function POST(request: NextRequest) {
  let context = null;

  try {
    const validation = validateCredentials();
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { codebasePath, query, maxResults = 5, threshold = 0.5, filter = "" } = body;

    const maxResultsNum = typeof maxResults === 'string' ? parseInt(maxResults, 10) : maxResults;

    console.log(`Search request: codebasePath=${codebasePath}, query=${query}, maxResults=${maxResultsNum}`);

    if (!codebasePath || !query) {
      return NextResponse.json(
        { error: 'Project path and query are required for search' },
        { status: 400 }
      );
    }

    context = await getContext();
    const results = await context.semanticSearch(
      codebasePath,
      query,
      maxResultsNum,
      threshold,
      filter
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    context = null;
  }
}
