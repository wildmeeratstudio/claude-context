export MILVUS_ADDRESS="http://172.21.130.106:19530"
export EMBEDDING_PROVIDER="OpenAI"
export OPENAI_API_KEY="b904c8bf501bfe37efbfce2343ef58ba"
export EMBEDDING_MODEL="embedding-chattek-qwen"
export OPENAI_BASE_URL="https://devops.realtek.com/realgpt-api/openai-compatible/v1"
MILVUS_ADDRESS=http://172.21.130.106:19530 EMBEDDING_PROVIDER=OpenAI OPENAI_API_KEY=b904c8bf501bfe37efbfce2343ef58ba EMBEDDING_MODEL=embedding-chattek-qwen OPENAI_BASE_URL=https://devops.realtek.com/realgpt-api/openai-compatible/v1 npx @zilliz/claude-context-mcp@latest
npx @modelcontextprotocol/inspector -e MILVUS_ADDRESS=http://172.21.130.106:19530 -e EMBEDDING_PROVIDER=OpenAI -e OPENAI_API_KEY=b904c8bf501bfe37efbfce2343ef58ba -e EMBEDDING_MODEL=embedding-chattek-qwen -e OPENAI_BASE_URL=https://devops.realtek.com/realgpt-api/openai-compatible/v1  npx @zilliz/claude-context-mcp