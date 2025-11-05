import { NextRequest, NextResponse } from 'next/server';
import { getContext, validateCredentials } from '../lib/context';

export type GetRelativePathsRequest = {
  /** Path to the indexed codebase */
  codebasePath: string;
};

export type GetRelativePathsResponse = {
  /** Success indicator */
  success: true;
  /** Array of unique relative paths in the collection */
  relativePaths: string[];
};

export type ErrorResponse = {
  /** Error message */
  error: string;
};

/**
 * Get relative paths from collection
 * @description Retrieve all unique relative file paths from an indexed codebase collection
 * @body GetRelativePathsRequest
 * @response 200:GetRelativePathsResponse:Successfully retrieved relative paths
 * @response 400:ErrorResponse:Missing required parameters or credentials
 * @response 404:ErrorResponse:Collection not found
 * @response 500:ErrorResponse:Internal server error
 * @tag Collections
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
    const { codebasePath } = body;

    if (!codebasePath) {
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    context = await getContext();
    const collectionName = context.getCollectionName(codebasePath);
    const vectorDb = context.getVectorDatabase();

    // Check if collection exists
    const hasCollection = await vectorDb.hasCollection(collectionName);
    if (!hasCollection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    const relativePaths = await vectorDb.getUniqueFieldsValue(collectionName, ['relativePath']);

    return NextResponse.json({ success: true, relativePaths });
  } catch (error) {
    console.error('Get relative paths API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    context = null;
  }
}
