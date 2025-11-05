import { NextRequest, NextResponse } from 'next/server';
import { getContext, validateCredentials } from '../lib/context';

export type IndexRequest = {
  /** Absolute path to the codebase directory */
  codebasePath: string;
  /** Unique session ID for tracking progress */
  sessionId?: string;
};

export type IndexStats = {
  /** Number of files indexed */
  indexedFiles: number;
  /** Total number of code chunks created */
  totalChunks: number;
};

export type IndexResponse = {
  /** Success indicator */
  success: true;
  /** Indexing statistics */
  stats: IndexStats;
};

export type ErrorResponse = {
  /** Error message */
  error: string;
};

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

interface ActiveSession {
  sessionId: string;
  startTime: number;
  lastActivity: number;
}

// Progress store for tracking indexing progress
const progressStore = new Map<string, ProgressData>();
const activeSessions = new Map<string, ActiveSession>();

// Cleanup interval (run every 30 seconds)
const CLEANUP_INTERVAL = 30 * 1000;
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Helper function to update progress
function updateProgress(sessionId: string, progress: ProgressData) {
  if (sessionId) {
    progressStore.set(sessionId, {
      ...progress,
      timestamp: Date.now()
    });

    // Update session activity
    const session = activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }
}

// Cleanup orphaned sessions
function cleanupStaleData() {
  const now = Date.now();

  // Clean up old progress data and inactive sessions
  for (const [sessionId, progress] of progressStore.entries()) {
    if (now - progress.timestamp > SESSION_TIMEOUT) {
      progressStore.delete(sessionId);
      activeSessions.delete(sessionId);
    }
  }

  // Clean up sessions that haven't been accessed recently
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      progressStore.delete(sessionId);
      activeSessions.delete(sessionId);
    }
  }
}

// Start cleanup interval
setInterval(cleanupStaleData, CLEANUP_INTERVAL);

// Helper to register new session
function registerSession(sessionId: string) {
  const now = Date.now();
  activeSessions.set(sessionId, {
    sessionId,
    startTime: now,
    lastActivity: now
  });
}

/**
 * Index a codebase
 * @description Index a codebase directory for semantic search. Returns indexing statistics and supports progress tracking via sessionId.
 * @body IndexRequest
 * @response 200:IndexResponse:Codebase indexed successfully
 * @response 400:ErrorResponse:Missing required parameters or credentials
 * @response 500:ErrorResponse:Internal server error
 * @tag Indexing
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
    const { codebasePath, sessionId } = body;

    if (!codebasePath) {
      return NextResponse.json(
        { error: 'Project path is required for indexing' },
        { status: 400 }
      );
    }

    // Register the session for tracking
    if (sessionId) {
      console.log(`Registering session: ${sessionId}`);
      registerSession(sessionId);
    }

    context = await getContext();
    console.log(`Indexing codebase: ${codebasePath}`);

    const stats = await context.indexCodebase(
      codebasePath,
      (progress: any) => {
        console.log(`${progress.phase} - ${progress.percentage}%`);

        // Update progress directly in memory
        updateProgress(sessionId, {
          phase: progress.phase,
          percentage: progress.percentage,
          message: `${progress.phase} - ${progress.percentage}%`,
          timestamp: Date.now(),
          isActive: true
        });
      },
      undefined, // forceReindex - will use default value (false)
      `index of ${codebasePath}` // description parameter
    );

    // Update completion status
    if (sessionId) {
      updateProgress(sessionId, {
        phase: 'Completed',
        percentage: 100,
        message: `Indexed ${stats.indexedFiles} files with ${stats.totalChunks} chunks`,
        timestamp: Date.now(),
        isActive: false
      });
    }

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Index API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    context = null;
  }
}

/**
 * Get indexing progress
 * @description Get real-time indexing progress via Server-Sent Events (SSE) or check session status
 * @params {sessionId:string:Session ID for tracking indexing progress, action?:string:Optional action - use 'status' to check session status}
 * @response 200:ProgressData:Progress update or session status
 * @response 400:ErrorResponse:Missing sessionId parameter
 * @tag Indexing
 * @openapi
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const action = searchParams.get('action');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  // Handle different GET actions
  if (action === 'status') {
    // Return current session status for recovery
    const progress = progressStore.get(sessionId);
    const session = activeSessions.get(sessionId);

    return NextResponse.json({
      exists: !!progress,
      progress: progress || null,
      session: session || null,
      isActive: progress?.isActive || false
    });
  }

  // Default: Server-Sent Events stream
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  const stream = new ReadableStream({
    start(controller) {
      let isControllerClosed = false;

      // Update session activity when SSE connection starts
      const session = activeSessions.get(sessionId);
      if (session) {
        session.lastActivity = Date.now();
      }

      const safeEnqueue = (data: string) => {
        try {
          if (!isControllerClosed) {
            controller.enqueue(new TextEncoder().encode(data));
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('Invalid state')) {
            isControllerClosed = true;
          } else {
            console.error('Controller enqueue error:', error);
            isControllerClosed = true;
          }
        }
      };

      const cleanup = (interval: NodeJS.Timeout) => {
        isControllerClosed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch (e) {
          // Ignore if already closed
        }
      };

      const sendProgress = (interval: NodeJS.Timeout) => {
        if (isControllerClosed) return;

        const progress = progressStore.get(sessionId);

        if (progress) {
          // Update session activity
          const currentSession = activeSessions.get(sessionId);
          if (currentSession) {
            currentSession.lastActivity = Date.now();
          }

          const data = `data: ${JSON.stringify(progress)}\n\n`;
          safeEnqueue(data);

          // Clean up completed sessions and close stream
          if (progress.percentage >= 100 && !progress.isActive) {
            clearInterval(interval);
            setTimeout(() => {
              progressStore.delete(sessionId);
              activeSessions.delete(sessionId);
              cleanup(interval);
            }, 100);
          }
        } else {
          // No progress data yet
          const session = activeSessions.get(sessionId);
          if (session) {
            const data = `data: ${JSON.stringify({
              phase: 'Initializing',
              percentage: 0,
              message: 'Waiting for indexing to start...',
              timestamp: Date.now(),
              isActive: true
            })}\n\n`;
            safeEnqueue(data);
          } else {
            const data = `data: ${JSON.stringify({
              phase: 'Idle',
              percentage: 0,
              message: 'No active indexing',
              timestamp: Date.now(),
              isActive: false
            })}\n\n`;
            safeEnqueue(data);
            cleanup(interval);
          }
        }
      };

      // Set up interval to check for updates
      const interval = setInterval(() => sendProgress(interval), 1000);

      // Send initial progress
      sendProgress(interval);

      // Cleanup when connection is closed
      return () => {
        cleanup(interval);

        // Mark session as potentially disconnected
        const session = activeSessions.get(sessionId);
        if (session) {
          session.lastActivity = Date.now() - (SESSION_TIMEOUT / 2);
        }
      };
    },
    cancel() {
      console.log(`Stream cancelled for session: ${sessionId}`);
    }
  });

  return new Response(stream, { headers });
}
