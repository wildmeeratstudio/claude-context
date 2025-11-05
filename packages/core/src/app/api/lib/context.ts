import { Context, MilvusRestfulVectorDatabase, OpenAIEmbedding } from '@/src';

/**
 * Create and return a Context instance with configured embedding and vector database
 */
export async function getContext(): Promise<Context> {
  try {
    const embedding = new OpenAIEmbedding({
      apiKey: process.env.CC_OPENAI_API_KEY || process.env.OPENAIKEY || '',
      model: process.env.CC_EMBEDDING_MODEL || 'text-embedding-3-small',
      baseURL: process.env.CC_OPENAI_BASE_URL || process.env.OPENAIURL
    });

    const vectorDatabase = new MilvusRestfulVectorDatabase({
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

/**
 * Validate required environment variables
 */
export function validateCredentials(): { valid: boolean; error?: string } {
  const finalApiKey = process.env.CC_OPENAI_API_KEY;
  const finalMilvusAddress = process.env.CC_MILVUS_ADDRESS;
  const finalMilvusToken = process.env.CC_MILVUS_API_KEY;

  if (!finalApiKey || !finalMilvusAddress || !finalMilvusToken) {
    return {
      valid: false,
      error: 'Missing required credentials (API key, Milvus address, or Milvus token)'
    };
  }

  return { valid: true };
}
