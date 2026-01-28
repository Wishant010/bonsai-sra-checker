// Extend globalThis for pdfjs worker
declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: unknown;
}

export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface PDFParseResult {
  pages: PageContent[];
  totalPages: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
  };
}

export interface TextChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

/**
 * Parse a PDF file from a buffer and extract text page by page using pdfjs-dist
 */
export async function parsePDF(pdfData: Buffer | Uint8Array): Promise<PDFParseResult> {
  console.log('[PDF Parser] Starting PDF parsing...');

  try {
    // For pdfjs-dist v5+ in Node.js, we need to set up the worker globally
    // before importing the main library. pdfjs checks globalThis.pdfjsWorker first.
    if (typeof window === 'undefined' && !globalThis.pdfjsWorker) {
      console.log('[PDF Parser] Loading PDF worker...');
      // @ts-expect-error - pdfjs-dist worker module has no type declarations
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      globalThis.pdfjsWorker = worker;
    }

    // Dynamic import for pdfjs-dist to avoid SSR issues
    console.log('[PDF Parser] Loading pdfjs library...');
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const data = pdfData instanceof Buffer ? new Uint8Array(pdfData) : pdfData;
    console.log(`[PDF Parser] PDF data size: ${data.length} bytes`);

    const loadingTask = pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0, // Suppress warnings
    });

    console.log('[PDF Parser] Loading PDF document...');
    const pdfDocument = await loadingTask.promise;
    console.log(`[PDF Parser] PDF loaded: ${pdfDocument.numPages} pages`);

    const pages: PageContent[] = [];
    const numPages = pdfDocument.numPages;

    // Extract text from each page
    console.log(`[PDF Parser] Extracting text from ${numPages} pages...`);
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : '') || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        pages.push({
          pageNumber: i,
          text: pageText,
        });

        // Log progress every 10 pages
        if (i % 10 === 0 || i === numPages) {
          console.log(`[PDF Parser] Processed ${i}/${numPages} pages`);
        }
      } catch (pageError) {
        console.error(`[PDF Parser] Error processing page ${i}:`, pageError);
        // Continue with empty text for this page
        pages.push({
          pageNumber: i,
          text: '',
        });
      }
    }

    // Get metadata
    let pdfMetadata: { title?: string; author?: string; subject?: string } = {};
    try {
      const metadata = await pdfDocument.getMetadata();
      const info = metadata?.info as Record<string, unknown> | undefined;
      if (info) {
        pdfMetadata = {
          title: info.Title as string | undefined,
          author: info.Author as string | undefined,
          subject: info.Subject as string | undefined,
        };
      }
    } catch {
      // Ignore metadata errors
    }

    console.log(`[PDF Parser] PDF parsing complete: ${pages.length} pages extracted`);
    return {
      pages,
      totalPages: numPages,
      metadata: pdfMetadata,
    };
  } catch (error) {
    console.error('[PDF Parser] Fatal error parsing PDF:', error);
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Chunk text from pages into smaller segments for RAG
 * Maintains page number references for each chunk
 */
export function chunkPageContent(
  pages: PageContent[],
  options: {
    chunkSize?: number;
    overlap?: number;
    maxChunks?: number;
  } = {}
): TextChunk[] {
  // Increased chunk size for better performance with large documents
  const { chunkSize = 2000, overlap = 300, maxChunks = 500 } = options;
  const chunks: TextChunk[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    if (!page.text || page.text.length === 0) continue;

    // If page text is smaller than chunk size, use it as is
    if (page.text.length <= chunkSize) {
      chunks.push({
        content: page.text,
        pageNumber: page.pageNumber,
        chunkIndex: globalChunkIndex++,
      });
      continue;
    }

    // Split page text into chunks with overlap
    let start = 0;
    while (start < page.text.length) {
      const end = Math.min(start + chunkSize, page.text.length);
      let chunkText = page.text.slice(start, end);

      // Try to end at a sentence boundary
      if (end < page.text.length) {
        const lastPeriod = chunkText.lastIndexOf('.');
        const lastNewline = chunkText.lastIndexOf('\n');
        const lastBreak = Math.max(lastPeriod, lastNewline);

        if (lastBreak > chunkSize * 0.5) {
          chunkText = chunkText.slice(0, lastBreak + 1);
        }
      }

      chunks.push({
        content: chunkText.trim(),
        pageNumber: page.pageNumber,
        chunkIndex: globalChunkIndex++,
      });

      // Check if we've reached the maximum chunk limit
      if (chunks.length >= maxChunks) {
        console.log(`[PDF Parser] Reached max chunks limit (${maxChunks}), stopping chunking`);
        return chunks;
      }

      // Move start position, accounting for overlap
      // Ensure we always advance by at least 1 character to prevent infinite loops
      const advance = Math.max(1, chunkText.length - overlap);
      start += advance;
    }
  }

  return chunks;
}

/**
 * Process a PDF file from buffer and return chunks ready for embedding
 */
export async function processPDFForRAG(pdfData: Buffer | Uint8Array): Promise<{
  chunks: TextChunk[];
  totalPages: number;
  metadata: PDFParseResult['metadata'];
}> {
  const parseResult = await parsePDF(pdfData);
  const chunks = chunkPageContent(parseResult.pages);

  return {
    chunks,
    totalPages: parseResult.totalPages,
    metadata: parseResult.metadata,
  };
}
