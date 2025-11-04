// Re-export types and interfaces
export type {
    VectorDocument,
    SearchOptions,
    VectorSearchResult,
    VectorDatabase,
    HybridSearchRequest,
    HybridSearchOptions,
    HybridSearchResult,
    RerankStrategy
} from './types';

export { COLLECTION_LIMIT_MESSAGE } from './types';

// Implementation class exports
export { MilvusRestfulVectorDatabase } from './milvus-restful-vectordb';
export type { MilvusRestfulConfig } from './milvus-restful-vectordb';

export { MilvusVectorDatabase } from './milvus-vectordb';
export type { MilvusConfig } from './milvus-vectordb';

export { ClusterManager } from './zilliz-utils';
export type {
    ZillizConfig,
    Project,
    Cluster,
    CreateFreeClusterRequest,
    CreateFreeClusterResponse,
    CreateFreeClusterWithDetailsResponse,
    DescribeClusterResponse
} from './zilliz-utils'; 