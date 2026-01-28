import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processPDFForRAG } from '@/lib/pdf-parser';
import { generateEmbeddings } from '@/lib/embeddings';
import { getChecklistSheet } from '@/lib/checklist-parser';
import { startCheckRunJob } from '@/lib/job-queue';
import path from 'path';
import fs from 'fs';

const DEMO_PDF_PATH = path.join(process.cwd(), 'data', 'voorbeeldjaarrekening-gemeenten-2023.pdf');
const ANONYMOUS_USER_ID = 'anonymous';

export async function POST() {
  try {
    if (!fs.existsSync(DEMO_PDF_PATH)) {
      return NextResponse.json(
        { error: 'Demo PDF niet gevonden. Zorg dat er een voorbeeldjaarrekening in de data folder staat.' },
        { status: 404 }
      );
    }

    const pdfBuffer = fs.readFileSync(DEMO_PDF_PATH);

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

    let document = await prisma.document.findFirst({
      where: {
        userId: ANONYMOUS_USER_ID,
        originalName: 'voorbeeldjaarrekening-gemeenten-2023.pdf',
      },
    });

    if (!document) {
      document = await prisma.document.create({
        data: {
          userId: ANONYMOUS_USER_ID,
          filename: 'demo-jaarrekening.pdf',
          originalName: 'voorbeeldjaarrekening-gemeenten-2023.pdf',
          pdfData: pdfBuffer,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
        },
      });
    }

    if (!document.processed) {
      try {
        const { chunks, totalPages } = await processPDFForRAG(pdfBuffer);

        const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key';

        if (hasApiKey) {
          const chunkTexts = chunks.map((c) => c.content);
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
        } else {
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
        }

        await prisma.document.update({
          where: { id: document.id },
          data: { pageCount: totalPages, processed: true },
        });

        document = await prisma.document.findUnique({ where: { id: document.id } });
      } catch (error) {
        console.error('Error processing demo document:', error);
        return NextResponse.json(
          { error: `Demo PDF verwerking mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}` },
          { status: 500 }
        );
      }
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key') {
      return NextResponse.json({
        success: true,
        message: 'Demo setup compleet. Voeg OPENAI_API_KEY toe om checks uit te voeren.',
        document: { id: document!.id, name: document!.originalName, pageCount: document!.pageCount, processed: document!.processed },
        checklist: { sheetName: checklist.sheetName, itemCount: checklist.items.length },
        apiKeyConfigured: false,
      });
    }

    const checkRun = await prisma.checkRun.create({
      data: {
        userId: ANONYMOUS_USER_ID,
        documentId: document!.id,
        sheetName: checklist.sheetName,
        totalItems: checklist.items.length,
      },
    });

    startCheckRunJob(checkRun.id);

    return NextResponse.json({
      success: true,
      message: 'Demo controle gestart',
      document: { id: document!.id, name: document!.originalName, pageCount: document!.pageCount, processed: document!.processed },
      checklist: { sheetName: checklist.sheetName, itemCount: checklist.items.length },
      checkRun: { id: checkRun.id, status: checkRun.status },
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
