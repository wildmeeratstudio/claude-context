# Architecture Overview

This document describes the architecture of the Claude Context Next.js UI.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Client                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐          ┌────────────────┐            │
│  │  Home Page (/) │          │ RAG Page       │            │
│  │                │          │ (/rag)         │            │
│  │  - Features    │─────────▶│  - Indexing   │            │
│  │  - Navigation  │          │  - Search      │            │
│  └────────────────┘          │  - Collections │            │
│                               └────────┬───────┘            │
│                                        │                     │
└────────────────────────────────────────┼─────────────────────┘
                                         │
                          HTTP/SSE       │
                                         │
┌────────────────────────────────────────┼─────────────────────┐
│                    Next.js Server      │                     │
├────────────────────────────────────────┼─────────────────────┤
│                                        ▼                     │
│  ┌──────────────────────────────────────────────┐          │
│  │     API Route: /api/semantic-search          │          │
│  ├──────────────────────────────────────────────┤          │
│  │                                                │          │
│  │  POST Actions:                                │          │
│  │  ├─ get_collections                          │          │
│  │  ├─ index (with progress callback)           │          │
│  │  ├─ search                                    │          │
│  │  └─ clear                                     │          │
│  │                                                │          │
│  │  GET Endpoints:                               │          │
│  │  ├─ ?action=status (session recovery)        │          │
│  │  └─ SSE stream (real-time progress)          │          │
│  │                                                │          │
│  └────────────────┬───────────────────┬─────────┘          │
│                   │                   │                     │
└───────────────────┼───────────────────┼─────────────────────┘
                    │                   │
              ┌─────▼─────┐      ┌─────▼──────┐
              │           │      │            │
              │  Context  │      │  Progress  │
              │  (Core)   │      │  Store     │
              │           │      │  (In-mem)  │
              └─────┬─────┘      └────────────┘
                    │
         ┌──────────┼──────────┐
         │                     │
    ┌────▼────┐         ┌─────▼──────┐
    │         │         │            │
    │ Milvus  │         │  OpenAI    │
    │ Vector  │         │ Embeddings │
    │   DB    │         │            │
    └─────────┘         └────────────┘
```

## Component Hierarchy

```
app/
├── layout.tsx (Root Layout)
│   └── globals.css (Tailwind Styles)
│
├── page.tsx (Home Page)
│   ├── Card (Features)
│   ├── Button (Navigation)
│   └── Icons (Lucide React)
│
└── rag/
    └── page.tsx (Semantic Search)
        ├── Indexing Section
        │   ├── Input (Path)
        │   ├── Button (Index)
        │   ├── Progress Bar
        │   └── Stats Display
        │
        ├── Collection Management
        │   ├── Select (Collections)
        │   ├── Button (Refresh)
        │   └── Button (Clear)
        │
        └── Search Section
            ├── Select (Collection)
            ├── Input (Max Results)
            ├── Input (Query)
            ├── Button (Search)
            └── Results List
                └── Card (Result)
                    ├── Badge (Score)
                    └── Textarea (Code)
```

## Data Flow

### 1. Indexing Flow

```
User Input (Path)
    │
    ▼
Create Session ID
    │
    ▼
POST /api/semantic-search
    action: "index"
    codebasePath: "/path/to/code"
    sessionId: "index_123..."
    │
    ▼
Context.indexCodebase()
    ├─ Scan files
    ├─ Parse with tree-sitter
    ├─ Chunk code
    ├─ Generate embeddings (OpenAI)
    ├─ Store vectors (Milvus)
    └─ Progress callbacks
        │
        ▼
    Update Progress Store
        │
        ▼
    SSE Stream (GET /api/semantic-search?sessionId=...)
        │
        ▼
    Update UI Progress Bar
        │
        ▼
    Show Stats (Complete)
```

### 2. Search Flow

```
User Input (Query + Collection)
    │
    ▼
POST /api/semantic-search
    action: "search"
    codebasePath: "/path/to/code"
    query: "natural language query"
    maxResults: 5
    │
    ▼
Context.semanticSearch()
    ├─ Generate query embedding (OpenAI)
    ├─ Search vectors (Milvus)
    └─ Return top matches
        │
        ▼
    Display Results
        ├─ File path
        ├─ Line numbers
        ├─ Relevance score
        └─ Code content
```

### 3. Session Recovery Flow

```
Page Load/Refresh
    │
    ▼
Check localStorage
    sessionId?
    │
    ├─ Yes ─▶ GET /api/semantic-search?sessionId=...&action=status
    │             │
    │             ▼
    │         Session exists & active?
    │             │
    │             ├─ Yes ─▶ Reconnect SSE stream
    │             │         Show "Reconnected" message
    │             │         Resume progress display
    │             │
    │             └─ No ──▶ Show completed stats
    │                       Clear localStorage
    │
    └─ No ──▶ Clean state
              Ready for new indexing
```

## State Management

### Client State (React useState)
- `query` - Search query text
- `results` - Search results array
- `indexStats` - Indexing statistics
- `indexProgress` - Current progress data
- `isSearching` - Search loading state
- `isIndexing` - Indexing loading state
- `collections` - Available collections list
- `searchCollection` - Selected search collection
- `selectedClearCollection` - Selected collection to clear
- `error` - Error message
- `successMessage` - Success message

### Server State (In-Memory Maps)
- `progressStore` - Map<sessionId, ProgressData>
  - phase, percentage, message, timestamp, isActive
- `activeSessions` - Map<sessionId, ActiveSession>
  - sessionId, startTime, lastActivity

### Persistent State
- `localStorage.currentIndexingSession` - Current session ID
- `.env.local` - Environment configuration

## API Contracts

### POST /api/semantic-search

**Request:**
```typescript
{
  action: 'get_collections' | 'index' | 'search' | 'clear',
  codebasePath?: string,
  query?: string,
  maxResults?: number,
  sessionId?: string
}
```

**Response:**
```typescript
// get_collections
{ success: true, collections: Collection[] }

// index
{ success: true, stats: { indexedFiles: number, totalChunks: number } }

// search
{ success: true, results: SearchResult[] }

// clear
{ success: true }

// error
{ error: string }
```

### GET /api/semantic-search?sessionId={id}

**SSE Stream:**
```typescript
data: {
  phase: string,
  percentage: number,
  message?: string,
  timestamp: number,
  isActive: boolean
}
```

**Status Check:**
```typescript
GET /api/semantic-search?sessionId={id}&action=status

Response: {
  exists: boolean,
  progress: ProgressData | null,
  session: ActiveSession | null,
  isActive: boolean
}
```

## Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4
- **Components:** Shadcn UI + Radix UI
- **Icons:** Lucide React
- **Language:** TypeScript 5

### Backend (API Routes)
- **Runtime:** Next.js Server
- **Core Library:** @zilliz/claude-context-core
- **Vector DB:** Milvus
- **Embeddings:** OpenAI API
- **Real-time:** Server-Sent Events (SSE)

### Build Tools
- **Bundler:** Turbopack (Next.js 16 default)
- **Compiler:** TypeScript
- **CSS:** PostCSS + Autoprefixer

## Security Considerations

1. **Environment Variables:** All sensitive keys stored in `.env.local`
2. **Server-side API calls:** Embeddings and vector operations on server
3. **No client exposure:** API keys never sent to browser
4. **Input validation:** Path and query validation on server
5. **Session cleanup:** Automatic stale session removal

## Performance Optimizations

1. **SSE for Progress:** Non-blocking real-time updates
2. **Session Recovery:** Resume without re-indexing
3. **Lazy Loading:** Components loaded on demand
4. **Turbopack:** Fast dev builds and hot reload
5. **Server Components:** Reduce client bundle size
6. **Vector Indexing:** Efficient similarity search with Milvus

## Scalability

1. **Collection-based:** Multiple codebases supported
2. **Session Management:** Concurrent indexing sessions
3. **Cleanup Intervals:** Automatic memory management
4. **External Dependencies:** Native modules marked as externals
5. **Caching:** Context instances can be cached (DELETE endpoint)

## Extensibility

Easy to extend with:
- Additional embedding providers
- Custom chunking strategies
- Different vector databases
- Additional UI features
- Analytics and monitoring
- User authentication
- Multi-tenant support

## Error Handling

1. **Client-side:** Try-catch with user feedback
2. **Server-side:** Error responses with messages
3. **SSE Reconnection:** Automatic retry logic
4. **Session Validation:** Status checks before operations
5. **Graceful Degradation:** Fallback states

## Monitoring Points

Track these for production:
- Indexing success/failure rates
- Search query performance
- SSE connection stability
- Session recovery rate
- API response times
- Vector database health
- Embedding API availability
