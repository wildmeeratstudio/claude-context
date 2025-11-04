import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center space-y-4 py-12">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Claude Context
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Core indexing engine for semantic code search powered by vector embeddings
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid gap-6">
          <Card className="border-2 hover:border-blue-300 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-6 h-6 text-blue-600" />
                Semantic Search
              </CardTitle>
              <CardDescription>
                Index your codebase and perform natural language searches using advanced vector embeddings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/rag">
                <Button className="w-full group">
                  Try Semantic Search
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Vector Database</h3>
                <p className="text-sm text-muted-foreground">
                  Powered by Milvus for efficient similarity search
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Smart Chunking</h3>
                <p className="text-sm text-muted-foreground">
                  Tree-sitter based code parsing for intelligent chunking
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Multi-Language</h3>
                <p className="text-sm text-muted-foreground">
                  Support for JavaScript, TypeScript, Python, Java, Go, Rust, and more
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Real-time Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Track indexing progress with Server-Sent Events
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">1. Set up environment variables</h4>
                <p className="text-sm text-muted-foreground">
                  Configure your OpenAI API key and Milvus connection in <code className="bg-blue-100 px-1 py-0.5 rounded">.env.local</code>
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">2. Index your codebase</h4>
                <p className="text-sm text-muted-foreground">
                  Provide the path to your codebase for indexing
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">3. Search with natural language</h4>
                <p className="text-sm text-muted-foreground">
                  Query your code using plain English to find relevant snippets
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
