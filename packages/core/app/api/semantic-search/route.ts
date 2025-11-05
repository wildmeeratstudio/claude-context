import { NextRequest, NextResponse } from 'next/server';
import { Context, MilvusRestfulVectorDatabase, MilvusVectorDatabase, OpenAIEmbedding } from '@/src';


interface ProgressData {
  phase: string;
  percentage: number;
  message?: string;
  timestamp: number;
  isActive: boolean;
}

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
      // Don't override isActive - use the value from progress parameter
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
interface ContextInstance {
  context: any;
  lastUsed: number;
}

const contextCache = new Map<string, ContextInstance>();

async function getContext(): Promise<Context> {
  try {
    const embedding = new OpenAIEmbedding({
      apiKey: process.env.CC_OPENAI_API_KEY || process.env.OPENAIKEY || '',
      model: process.env.CC_EMBEDDING_MODEL || 'text-embedding-3-small',
      baseURL: process.env.CC_OPENAI_BASE_URL || process.env.OPENAIURL
    });

    const vectorDatabase = new MilvusVectorDatabase({
      address: process.env.CC_MILVUS_ADDRESS || '',
      token: process.env.CC_MILVUS_API_KEY || ''
    });
    const context = new Context({
      embedding,
      vectorDatabase
    });
    return context;
  } catch (error) {
    console.error('Failed to create context:', error);
    throw new Error('Failed to initialize semantic search context');
  }
}

export async function POST(request: NextRequest) {
  let context: Context | null = null;
  console.log('POST request received');
  try {
    const body = await request.json();
    const { action, ...params } = body;
    const finalApiKey = process.env.CC_OPENAI_API_KEY;
    const finalMilvusAddress = process.env.CC_MILVUS_ADDRESS;
    const finalMilvusToken = process.env.CC_MILVUS_API_KEY;
    console.log('POST request received 2');

    if (!finalApiKey || !finalMilvusAddress || !finalMilvusToken) {
      return NextResponse.json(
        { error: 'Missing required credentials (API key, Milvus address, or Milvus token)' },
        { status: 400 }
      );
    }
    context = await getContext();
    console.log('POST request received 3');

    switch (action) {
      case 'get_collections': {
        console.log('get_collections');
        const dbList = await context?.getVectorDatabase().listCollections();
        const collections = dbList.map(db => ({
          name: db,
          path: context?.getPathFromCollectionName(db)
        }));
        return NextResponse.json({ success: true, collections });
      }
      case 'clear': {
        console.log("clear")
        const { codebasePath } = params;
        if (!codebasePath) {
          return NextResponse.json(
            { error: 'Project path is required for indexing' },
            { status: 400 }
          );
        }
        await context?.clearIndex(codebasePath)
        return NextResponse.json({ success: true });
      }
      case 'index': {
        const { codebasePath, sessionId } = params;
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
        console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~ Indexing codebase: ${codebasePath}`);
        const stats = await context?.indexCodebase(
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
        updateProgress(sessionId, {
          phase: 'Completed',
          percentage: 100,
          message: `Indexed ${stats.indexedFiles} files with ${stats.totalChunks} chunks`,
          timestamp: Date.now(),
          isActive: false
        });

        return NextResponse.json({ success: true, stats });
      }

      case 'search': {
        const { codebasePath, query, maxResults = 5, threshold = 0.5, filter = "" } = params;
        const maxResultsNum = typeof maxResults === 'string' ? parseInt(maxResults, 10) : maxResults;
        console.log(codebasePath, query, maxResultsNum)
        if (!codebasePath || !query) {
          return NextResponse.json(
            { error: 'Project path and query are required for search' },
            { status: 400 }
          );
        }

        const results = await context.semanticSearch(codebasePath, query, maxResultsNum, threshold, filter);

        return NextResponse.json({ success: true, results });
      }

      case 'get_relative_paths': {
        const { codebasePath } = params;
        if (!codebasePath) {
          return NextResponse.json(
            { error: 'Project path is required' },
            { status: 400 }
          );
        }

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
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "index" or "search"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Semantic search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  } finally {
    context = null
  }
}

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
      let completionTimeoutId: NodeJS.Timeout | null = null;

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
          // Silently ignore ERR_INVALID_STATE - it's expected when stream closes
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
        if (completionTimeoutId) {
          clearTimeout(completionTimeoutId);
        }
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
            // Stop the interval immediately to prevent duplicate messages
            clearInterval(interval);
            // Send final message, then cleanup after short delay
            setTimeout(() => {
              progressStore.delete(sessionId);
              activeSessions.delete(sessionId);
              cleanup(interval);
            }, 100); // Very short delay just to ensure message is sent
          }
        } else {
          // No progress data yet - check if session is registered
          const session = activeSessions.get(sessionId);
          if (session) {
            // Session exists but no progress yet - send waiting message and keep connection open
            const data = `data: ${JSON.stringify({
              phase: 'Initializing',
              percentage: 0,
              message: 'Waiting for indexing to start...',
              timestamp: Date.now(),
              isActive: true
            })}\n\n`;
            safeEnqueue(data);
          } else {
            // No session registered - this might be an old/invalid session
            const data = `data: ${JSON.stringify({
              phase: 'Idle',
              percentage: 0,
              message: 'No active indexing',
              timestamp: Date.now(),
              isActive: false
            })}\n\n`;
            safeEnqueue(data);
            // Only close if session truly doesn't exist
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
          session.lastActivity = Date.now() - (SESSION_TIMEOUT / 2); // Mark as older
        }
      };
    },
    cancel() {
      // Called when the stream is cancelled (e.g., client disconnects)
      console.log(`Stream cancelled for session: ${sessionId}`);
    }
  });

  return new Response(stream, { headers });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const cacheKey = url.searchParams.get('cacheKey');

  if (cacheKey && contextCache.has(cacheKey)) {
    contextCache.delete(cacheKey);
    return NextResponse.json({ success: true, message: 'Context cache cleared' });
  }

  contextCache.clear();
  return NextResponse.json({ success: true, message: 'All context caches cleared' });
}