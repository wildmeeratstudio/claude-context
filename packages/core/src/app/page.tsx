'use client'

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Database, FileText, Settings, AlertCircle, Trash2, RefreshCw } from 'lucide-react';

interface SearchResult {
  relativePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

interface IndexStats {
  indexedFiles: number;
  totalChunks: number;
}

interface IndexProgress {
  phase: string;
  percentage: number;
  message?: string;
}

interface Collection {
  name: string;
  path: string;
}

export default function SemanticSearchTest() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  // Indexing configuration
  const [indexCodebasePath, setIndexCodebasePath] = useState('/home/vincint810923/Document/turnkey/NTA/turnkey/vendor/Netgear/gs728tpv3/cli/libclicmd/cmd_tables.c');
  const [selectedClearCollection, setSelectedClearCollection] = useState('');

  // Search configuration
  const [searchCollection, setSearchCollection] = useState('');
  const [maxResults, setMaxResults] = useState(5);
  const [selectedRelativePath, setSelectedRelativePath] = useState('');

  // Collections list
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);

  // Relative paths for the selected collection
  const [relativePaths, setRelativePaths] = useState<string[]>([]);
  const [isLoadingRelativePaths, setIsLoadingRelativePaths] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const fetchCollections = async () => {
    setIsLoadingCollections(true);
    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_collections' }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      const data = await response.json();
      console.log(data)
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
      setError('Failed to fetch collections');
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const fetchRelativePaths = async (codebasePath: string) => {
    setIsLoadingRelativePaths(true);
    setRelativePaths([]);
    setSelectedRelativePath('');
    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_relative_paths',
          codebasePath
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch relative paths');
      }
      const data = await response.json();
      setRelativePaths(data.relativePaths || []);
    } catch (error) {
      console.error('Failed to fetch relative paths:', error);
      setError('Failed to fetch relative paths for this collection');
    } finally {
      setIsLoadingRelativePaths(false);
    }
  };

  // Session recovery on component mount
  useEffect(() => {
    console.log('Component mounted, checking for existing session...');

    // Reset all states on mount to ensure clean start
    setIsIndexing(false);
    setIndexProgress(null);
    setIndexStats(null);
    setError(null);
    setSuccessMessage(null);

    // Fetch available collections
    fetchCollections();

    const storedSessionId = localStorage.getItem('currentIndexingSession');

    if (storedSessionId) {
      console.log('Found stored session:', storedSessionId);
      checkSessionRecovery(storedSessionId);
    } else {
      console.log('No stored session found');
    }

    // Cleanup on page unload
    const handleBeforeUnload = () => {
      console.log('Page unloading, cleaning up connections');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    // Cleanup on visibility change (when tab becomes hidden)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab hidden, maintaining connection');
      } else {
        console.log('Tab visible again');
        // Check if we need to reconnect after coming back
        const sessionId = currentSessionRef.current;
        if (sessionId && isIndexing && !eventSourceRef.current) {
          console.log('Reconnecting after tab became visible');
          connectToProgressStream(sessionId);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('Component unmounting, cleaning up');
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const checkSessionRecovery = async (sessionId: string) => {
    try {
      console.log('Checking session recovery for:', sessionId);
      const response = await fetch(`/api/semantic-search?sessionId=${sessionId}&action=status`);

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Session recovery data:', data);

      if (data.exists && data.isActive) {
        // Session is still active, reconnect
        setIsIndexing(true);
        currentSessionRef.current = sessionId;
        setIndexProgress(data.progress || null);
        connectToProgressStream(sessionId);
        setSuccessMessage('Reconnected to ongoing indexing process');
      } else if (data.exists && !data.isActive && data.progress) {
        // Session completed while away
        if (data.progress.percentage >= 100) {
          setIndexStats({
            indexedFiles: parseInt(data.progress.message?.match(/(\d+) files/)?.[1] || '0'),
            totalChunks: parseInt(data.progress.message?.match(/(\d+) chunks/)?.[1] || '0')
          });
          setSuccessMessage('Previous indexing completed successfully');
        }
        localStorage.removeItem('currentIndexingSession');
      } else {
        // Session doesn't exist anymore or is invalid
        console.log('Session does not exist or is invalid');
        localStorage.removeItem('currentIndexingSession');
      }
    } catch (error) {
      console.error('Failed to recover session:', error);
      localStorage.removeItem('currentIndexingSession');
      // Reset all states to ensure clean UI
      setIsIndexing(false);
      setIndexProgress(null);
      setIndexStats(null);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const connectToProgressStream = (sessionId: string) => {
    console.log('Connecting to progress stream for session:', sessionId);

    // Close existing connection
    if (eventSourceRef.current) {
      console.log('Closing existing EventSource connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Set up Server-Sent Events for progress tracking
      const eventSource = new EventSource(`/api/semantic-search?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened for session:', sessionId);
      };

      eventSource.onmessage = (event) => {
        try {
          const progress = JSON.parse(event.data);
          console.log('Received progress update:', progress);
          setIndexProgress(progress);

          if (progress.percentage >= 100 && !progress.isActive) {
            console.log('Indexing completed, cleaning up');
            setIsIndexing(false);
            setIndexProgress(null);
            eventSource.close();
            eventSourceRef.current = null;
            currentSessionRef.current = null;
            localStorage.removeItem('currentIndexingSession');
          }
        } catch (error) {
          console.error('Failed to parse progress data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);

        // Check if we're still supposed to be indexing
        const shouldReconnect = isIndexing && currentSessionRef.current === sessionId;

        eventSource.close();
        eventSourceRef.current = null;

        if (shouldReconnect) {
          console.log('Attempting to reconnect in 2 seconds...');
          setTimeout(() => {
            // Double-check we still need to reconnect
            if (currentSessionRef.current === sessionId && isIndexing) {
              connectToProgressStream(sessionId);
            }
          }, 2000);
        } else {
          console.log('Not reconnecting - indexing is complete or session changed');
        }
      };

    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setError('Failed to connect to progress stream');
    }
  };

  const indexCodebase = async () => {
    if (!indexCodebasePath.trim()) {
      setError('Please enter a codebase path');
      return;
    }

    setIsIndexing(true);
    setIndexProgress(null);
    setIndexStats(null);
    clearMessages();

    const sessionId = `index_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    currentSessionRef.current = sessionId;

    // Store session in localStorage for recovery
    localStorage.setItem('currentIndexingSession', sessionId);

    // Connect to progress stream
    connectToProgressStream(sessionId);

    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'index',
          codebasePath: indexCodebasePath,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to index codebase');
      }

      setIndexStats(data.stats);
      setSuccessMessage(`Successfully indexed ${data.stats.indexedFiles} files with ${data.stats.totalChunks} chunks`);

      // Refresh collections list
      await fetchCollections();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to index codebase');

      // Cleanup on error
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      localStorage.removeItem('currentIndexingSession');
      setIsIndexing(false);
      setIndexProgress(null);
    }
  };

  const performSearch = async () => {
    if (!query.trim()) return;
    if (!searchCollection) {
      setError('Please select a collection');
      return;
    }

    setIsSearching(true);
    setResults([]);
    clearMessages();

    try {
      const requestBody: any = {
        action: 'search',
        codebasePath: searchCollection,
        query,
        maxResults,
      };

      // Add filter if a relative path is selected
      if (selectedRelativePath && selectedRelativePath !== 'all') {
        requestBody.filter = `relativePath == "${selectedRelativePath}"`;
      }

      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform search');
      }

      setResults(data.results);
      setSuccessMessage(`Found ${data.results.length} results for "${query}"`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to perform search');
    } finally {
      setIsSearching(false);
    }
  };

  const clearCollection = async () => {
    if (!selectedClearCollection) {
      setError('Please select a collection to clear');
      return;
    }
    console.log(selectedClearCollection)
    clearMessages();

    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear',

          codebasePath: selectedClearCollection,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMessage(`Collection "${selectedClearCollection}" cleared successfully`);
        setSelectedClearCollection('');
        // Refresh collections list
        await fetchCollections();
      } else {
        setError(data.error || 'Failed to clear collection');
      }
    } catch (error) {
      setError('Failed to clear collection');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Semantic Search Test</h1>
        <p className="text-muted-foreground">
          Test claude-context-core semantic search functionality via API
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-red-800">{error}</span>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <span className="text-green-800">{successMessage}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Indexing
            </CardTitle>
            <CardDescription>
              Index your codebase for semantic search
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Codebase Path (Index New)</label>
              <Input
                value={indexCodebasePath}
                onChange={(e) => setIndexCodebasePath(e.target.value)}
                placeholder="/path/to/your/codebase"
                disabled={isIndexing}
              />
            </div>

            <Button
              onClick={indexCodebase}
              disabled={isIndexing || !indexCodebasePath.trim()}
              className="w-full"
            >
              {isIndexing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {indexProgress?.phase || 'Indexing...'}
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Index Codebase
                </>
              )}
            </Button>

            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">Clear Existing Collection</label>
              <div className="flex gap-2">
                <Select value={selectedClearCollection} onValueChange={setSelectedClearCollection}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select collection to clear" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCollections ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : collections.length === 0 ? (
                      <SelectItem value="none" disabled>No collections available</SelectItem>
                    ) : (
                      collections.map((collection) => (
                        <SelectItem key={collection.name} value={collection.path}>
                          {collection.path}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={fetchCollections}
                  disabled={isLoadingCollections}
                  variant="outline"
                  size="icon"
                  title="Refresh collections"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingCollections ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  onClick={clearCollection}
                  disabled={!selectedClearCollection}
                  variant="destructive"
                  size="icon"
                  title="Clear collection"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {indexProgress && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium">{indexProgress.phase}</span>
                  <span className="text-muted-foreground">{indexProgress.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${indexProgress.percentage}%` }}
                  />
                </div>
                {indexProgress.message && (
                  <p className="text-sm text-muted-foreground">{indexProgress.message}</p>
                )}
              </div>
            )}

            {indexStats && (
              <div className="p-3 bg-green-50 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Indexed Files:</span>
                  <Badge variant="secondary">{indexStats.indexedFiles}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total Chunks:</span>
                  <Badge variant="secondary">{indexStats.totalChunks}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Semantic Search
            </CardTitle>
            <CardDescription>
              Search your indexed codebase using natural language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Collection</label>
              <div className="flex gap-2">
                <Select value={searchCollection} onValueChange={(value) => {
                  setSearchCollection(value);
                  fetchRelativePaths(value);
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a collection to search" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCollections ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : collections.length === 0 ? (
                      <SelectItem value="none" disabled>No collections available</SelectItem>
                    ) : (
                      collections.map((collection) => (
                        <SelectItem key={collection.name} value={collection.path}>
                          {collection.path}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={fetchCollections}
                  disabled={isLoadingCollections}
                  variant="outline"
                  size="icon"
                  title="Refresh collections"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingCollections ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Max Results</label>
              <Input
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value) || 5)}
                min="1"
                max="20"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Filter by File (Optional)</label>
              <Select
                value={selectedRelativePath}
                onValueChange={setSelectedRelativePath}
                disabled={!searchCollection || isLoadingRelativePaths}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={
                    isLoadingRelativePaths
                      ? "Loading files..."
                      : relativePaths.length === 0
                        ? "Select a collection first"
                        : "All files (no filter)"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All files (no filter)</SelectItem>
                  {relativePaths.map((path) => (
                    <SelectItem key={path} value={path}>
                      {path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Filter search results to a specific file
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your search query (e.g., 'vector database operations')"
                onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              />
              <Button onClick={performSearch} disabled={isSearching || !query.trim() || !searchCollection}>
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Search Results ({results.length})
                </h3>
                {results.map((result, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-mono">
                          {result.relativePath}:{result.startLine}-{result.endLine}
                        </CardTitle>
                        <Badge variant="outline">
                          {(result.score * 100).toFixed(2)}% match
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={result.content}
                        readOnly
                        className="font-mono text-sm min-h-[120px] resize-none"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="ml-2">Searching...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}