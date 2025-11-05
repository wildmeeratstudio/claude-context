import { NextResponse } from 'next/server';
import { getContext, validateCredentials } from '../lib/context';

export type Collection = {
  /** Collection name */
  name: string;
  /** Original codebase path */
  path: string;
};

export type GetCollectionsResponse = {
  /** Success indicator */
  success: true;
  /** List of available collections */
  collections: Collection[];
};

export type ErrorResponse = {
  /** Error message */
  error: string;
};

/**
 * Get all collections
 * @description Retrieve a list of all indexed codebase collections
 * @response 200:GetCollectionsResponse:Successfully retrieved collections list
 * @response 400:ErrorResponse:Missing required credentials
 * @response 500:ErrorResponse:Internal server error
 * @tag Collections
 * @openapi
 */
export async function GET() {
  let context = null;

  try {
    const validation = validateCredentials();
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    context = await getContext();
    const dbList = await context.getVectorDatabase().listCollections();
    const collections = dbList.map(db => ({
      name: db,
      path: context.getPathFromCollectionName(db)
    }));

    return NextResponse.json({ success: true, collections });
  } catch (error) {
    console.error('Get collections API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    context = null;
  }
}
