import { NextRequest, NextResponse } from 'next/server';
import { getContext, validateCredentials } from '../../lib/context';

export type ClearRequest = {
  /** Path to the codebase collection to clear */
  codebasePath: string;
};

export type ClearResponse = {
  /** Success indicator */
  success: true;
  /** Success message */
  message: string;
};

export type ErrorResponse = {
  /** Error message */
  error: string;
};

/**
 * Clear a collection
 * @description Delete an indexed codebase collection
 * @body ClearRequest
 * @response 200:ClearResponse:Collection cleared successfully
 * @response 400:ErrorResponse:Missing required parameters or credentials
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
        { error: 'Project path is required for clearing' },
        { status: 400 }
      );
    }

    context = await getContext();
    await context.clearIndex(codebasePath);

    return NextResponse.json({
      success: true,
      message: `Collection for "${codebasePath}" cleared successfully`
    });
  } catch (error) {
    console.error('Clear collection API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    context = null;
  }
}
