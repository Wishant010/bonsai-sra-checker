import OpenAI from 'openai';
import prisma from './prisma';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// Lazy initialization to avoid crash when OPENAI_API_KEY is not set at build time
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

/**
 * Generate embeddings for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // Limit input length
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  // Process in batches of 100 (OpenAI supports up to 2048 inputs per request)
  const batchSize = 100;
  const embeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / batchSize);

  console.log(`[Embeddings] Generating embeddings for ${texts.length} texts in ${totalBatches} batches`);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 8000));

    console.log(`[Embeddings] Processing batch ${batchNum}/${totalBatches} (${batch.length} texts)`);

    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    embeddings.push(...response.data.map((d) => d.embedding));

    // Small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`[Embeddings] Generated ${embeddings.length} embeddings successfully`);
  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RetrievedChunk {
  id: string;
  content: string;
  pageNumber: number;
  similarity: number;
}

/**
 * Retrieve relevant chunks for a query from the database
 * Falls back to returning first chunks if no embeddings are available
 */
export async function retrieveRelevantChunks(
  documentId: string,
  query: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  // Check if API key is configured
  const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key';

  // Get chunks for the document (without embedding field first to avoid large string issues)
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: {
      id: true,
      content: true,
      pageNumber: true,
    },
    orderBy: { chunkIndex: 'asc' },
  });

  if (chunks.length === 0) {
    return [];
  }

  // If no API key, return first chunks as fallback (simple keyword matching)
  if (!hasApiKey) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

    // Score chunks by keyword matches
    const scoredChunks = chunks.map(chunk => {
      const contentLower = chunk.content.toLowerCase();
      const score = queryWords.reduce((acc, word) => {
        return acc + (contentLower.includes(word) ? 1 : 0);
      }, 0);
      return { ...chunk, score };
    });

    // Sort by score and return top chunks
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        similarity: chunk.score / Math.max(queryWords.length, 1),
      }));
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Get embeddings separately
  const chunksWithEmbeddings = await prisma.documentChunk.findMany({
    where: {
      documentId,
      embedding: { not: null },
    },
    select: {
      id: true,
      content: true,
      pageNumber: true,
      embedding: true,
    },
  });

  if (chunksWithEmbeddings.length === 0) {
    // Fallback to first chunks if no embeddings
    return chunks.slice(0, topK).map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      similarity: 0,
    }));
  }

  // Calculate similarities and rank
  const chunksWithSimilarity = chunksWithEmbeddings
    .map((chunk) => {
      const chunkEmbedding = JSON.parse(chunk.embedding!) as number[];
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

      return {
        id: chunk.id,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return chunksWithSimilarity;
}

/**
 * Simple in-memory vector store for MVP
 * Can be replaced with a proper vector database later
 */
export class InMemoryVectorStore {
  private vectors: Map<string, { embedding: number[]; metadata: Record<string, unknown> }> = new Map();

  add(id: string, embedding: number[], metadata: Record<string, unknown>): void {
    this.vectors.set(id, { embedding, metadata });
  }

  search(queryEmbedding: number[], topK: number = 5): Array<{ id: string; similarity: number; metadata: Record<string, unknown> }> {
    const results: Array<{ id: string; similarity: number; metadata: Record<string, unknown> }> = [];

    this.vectors.forEach((value, id) => {
      const similarity = cosineSimilarity(queryEmbedding, value.embedding);
      results.push({ id, similarity, metadata: value.metadata });
    });

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  clear(): void {
    this.vectors.clear();
  }

  get size(): number {
    return this.vectors.size;
  }
}
