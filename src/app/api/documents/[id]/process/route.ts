import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processPDFForRAG } from '@/lib/pdf-parser';
import { generateEmbeddings } from '@/lib/embeddings';

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[Process] Starting document processing for ID: ${id}`);

    // Get document (no auth check - allow anonymous access)
    const document = await prisma.document.findFirst({
      where: {
        id,
      },
    });

    if (!document) {
      console.log(`[Process] Document not found: ${id}`);
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    console.log(`[Process] Document found: ${document.originalName}, size: ${document.size} bytes`);

    if (document.processed) {
      console.log(`[Process] Document already processed: ${id}`);
      return NextResponse.json({
        message: 'Document already processed',
        document: {
          id: document.id,
          pageCount: document.pageCount,
          processed: true,
        },
      });
    }

    // Process PDF from database with timeout (60 seconds for large PDFs)
    console.log(`[Process] Starting PDF text extraction...`);
    const { chunks, totalPages } = await withTimeout(
      processPDFForRAG(document.pdfData),
      60000,
      'PDF text extraction'
    );
    console.log(`[Process] PDF extracted: ${totalPages} pages, ${chunks.length} chunks`);

    // Generate embeddings for chunks (if API key is configured)
    const hasApiKey = process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'your-openai-api-key' &&
      process.env.OPENAI_API_KEY.startsWith('sk-');

    if (hasApiKey) {
      console.log(`[Process] Generating embeddings for ${chunks.length} chunks...`);
      try {
        const chunkTexts = chunks.map((c) => c.content);
        const embeddings = await withTimeout(
          generateEmbeddings(chunkTexts),
          240000, // 4 minutes for embeddings (large documents)
          'Embedding generation'
        );
        console.log(`[Process] Embeddings generated successfully`);

        // Store chunks with embeddings
        console.log(`[Process] Storing chunks with embeddings...`);
        await prisma.$transaction(
          chunks.map((chunk, i) =>
            prisma.documentChunk.create({
              data: {
                documentId: document.id,
                pageNumber: chunk.pageNumber,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content,
                embedding: JSON.stringify(embeddings[i]),
              },
            })
          )
        );
      } catch (embeddingError) {
        console.error(`[Process] Embedding error, falling back to no embeddings:`, embeddingError);
        // Fallback: store without embeddings
        await prisma.$transaction(
          chunks.map((chunk) =>
            prisma.documentChunk.create({
              data: {
                documentId: document.id,
                pageNumber: chunk.pageNumber,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content,
                embedding: null,
              },
            })
          )
        );
      }
    } else {
      console.log(`[Process] No API key configured, storing chunks without embeddings`);
      // Store chunks without embeddings
      await prisma.$transaction(
        chunks.map((chunk) =>
          prisma.documentChunk.create({
            data: {
              documentId: document.id,
              pageNumber: chunk.pageNumber,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              embedding: null,
            },
          })
        )
      );
    }

    // Update document
    console.log(`[Process] Updating document status...`);
    await prisma.document.update({
      where: { id: document.id },
      data: {
        pageCount: totalPages,
        processed: true,
      },
    });

    console.log(`[Process] Document processed successfully: ${id}`);
    return NextResponse.json({
      message: 'Document processed successfully',
      document: {
        id: document.id,
        pageCount: totalPages,
        chunksCount: chunks.length,
        processed: true,
      },
    });
  } catch (error) {
    console.error('[Process] Error processing document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to process document: ${errorMessage}` },
      { status: 500 }
    );
  }
}
