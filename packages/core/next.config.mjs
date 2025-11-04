/** @type {import('next').NextConfig} */
const nextConfig = {
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
  turbopack: {},
}

export default nextConfig
