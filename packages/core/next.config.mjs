// next.config.mjs
/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import path from 'path';

// 1. Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'), // Point to monorepo root
  turbopack: {
    // Must match outputFileTracingRoot - point to monorepo root
    root: path.join(__dirname, '../..'),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    '@zilliz/claude-context-core',
    'tree-sitter',
    'tree-sitter-javascript',
    'tree-sitter-typescript',
    'tree-sitter-python',
    'tree-sitter-go',
    'tree-sitter-java',
    'tree-sitter-cpp',
    'tree-sitter-c-sharp',
    'tree-sitter-rust',
    'tree-sitter-scala',
    'faiss-node'
  ],
}

export default nextConfig
