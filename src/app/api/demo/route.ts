import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { processPDFForRAG } from '@/lib/pdf-parser';
import { generateEmbeddings } from '@/lib/embeddings';
import { getChecklistSheet } from '@/lib/checklist-parser';
import { startCheckRunJob } from '@/lib/job-queue';
import path from 'path';
import fs from 'fs';

const DEMO_PDF_PATH = path.join(process.cwd(), 'data', 'voorbeeldjaarrekening-gemeenten-2023.pdf');

export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    const userId = session.user.id;

    // Read demo PDF from file system
    if (!fs.existsSync(DEMO_PDF_PATH)) {
      return NextResponse.json(
        {
          error: `Demo PDF niet gevonden. Zorg dat er een voorbeeldjaarrekening in de data folder staat.`,
        },
        { status: 404 }
      );
    }

    const pdfBuffer = fs.readFileSync(DEMO_PDF_PATH);

    // Step 1: Get checklist sheet and seed if not exists (use first sheet)
    const checklist = getChecklistSheet();
    const existingChecklist = await prisma.checklistItem.count({
      where: { sheetName: checklist.sheetName },
    });

    if (existingChecklist === 0) {
      await prisma.$transaction(
        checklist.items.map((item) =>
          prisma.checklistItem.create({
            data: {
              sheetName: checklist.sheetName,
              checkId: item.checkId,
              checkText: item.checkText,
              category: item.category,
              wettelijkeBasis: item.wettelijkeBasis,
              applicableTypes: JSON.stringify(item.applicableTypes),
              order: item.order,
            },
          })
        )
      );
    }

    // Step 2: Check for existing demo document
    let document = await prisma.document.findFirst({
      where: {
        userId,
        originalName: 'voorbeeldjaarrekening-gemeenten-2023.pdf',
      },
    });

    if (!document) {
      // Create demo document with PDF data in database
      document = await prisma.document.create({
        data: {
          userId,
          filename: 'demo-jaarrekening.pdf',
          originalName: 'voorbeeldjaarrekening-gemeenten-2023.pdf',
          pdfData: pdfBuffer,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
        },
      });
    }

    // Step 3: Process document if not processed
    if (!document.processed) {
      try {
        // Use the PDF buffer we already read from the file system
        const { chunks, totalPages } = await processPDFForRAG(pdfBuffer);

        // Generate embeddings
        const chunkTexts = chunks.map((c) => c.content);

        // Check if API key is configured
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key') {
          // Store chunks without embeddings for demo
          await prisma.$transaction(
            chunks.map((chunk) =>
              prisma.documentChunk.create({
                data: {
                  documentId: document!.id,
                  pageNumber: chunk.pageNumber,
                  chunkIndex: chunk.chunkIndex,
                  content: chunk.content,
                  embedding: null,
                },
              })
            )
          );
        } else {
          const embeddings = await generateEmbeddings(chunkTexts);

          await prisma.$transaction(
            chunks.map((chunk, i) =>
              prisma.documentChunk.create({
                data: {
                  documentId: document!.id,
                  pageNumber: chunk.pageNumber,
                  chunkIndex: chunk.chunkIndex,
                  content: chunk.content,
                  embedding: JSON.stringify(embeddings[i]),
                },
              })
            )
          );
        }

        // Update document
        await prisma.document.update({
          where: { id: document.id },
          data: {
            pageCount: totalPages,
            processed: true,
          },
        });

        document = await prisma.document.findUnique({
          where: { id: document.id },
        });
      } catch (error) {
        console.error('Error processing demo document:', error);
        return NextResponse.json(
          { error: `Demo PDF verwerking mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}` },
          { status: 500 }
        );
      }
    }

    // Step 4: Create check run if API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key') {
      return NextResponse.json({
        success: true,
        message: 'Demo setup compleet. Voeg OPENAI_API_KEY toe om checks uit te voeren.',
        document: {
          id: document!.id,
          name: document!.originalName,
          pageCount: document!.pageCount,
          processed: document!.processed,
        },
        checklist: {
          sheetName: checklist.sheetName,
          itemCount: checklist.items.length,
        },
        apiKeyConfigured: false,
      });
    }

    // Create and start check run
    const checkRun = await prisma.checkRun.create({
      data: {
        userId,
        documentId: document!.id,
        sheetName: checklist.sheetName,
        totalItems: checklist.items.length,
      },
    });

    // Start background job
    startCheckRunJob(checkRun.id);

    return NextResponse.json({
      success: true,
      message: 'Demo controle gestart',
      document: {
        id: document!.id,
        name: document!.originalName,
        pageCount: document!.pageCount,
        processed: document!.processed,
      },
      checklist: {
        sheetName: checklist.sheetName,
        itemCount: checklist.items.length,
      },
      checkRun: {
        id: checkRun.id,
        status: checkRun.status,
      },
      apiKeyConfigured: true,
    });
  } catch (error) {
    console.error('Error running demo:', error);
    return NextResponse.json(
      { error: `Demo mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}` },
      { status: 500 }
    );
  }
}
