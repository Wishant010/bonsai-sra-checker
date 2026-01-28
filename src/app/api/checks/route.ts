import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startCheckRunJob } from '@/lib/job-queue';
import { getChecklistSheet } from '@/lib/checklist-parser';

const ANONYMOUS_USER_ID = 'anonymous';

export async function GET() {
  try {
    const checkRuns = await prisma.checkRun.findMany({
      where: { userId: ANONYMOUS_USER_ID },
      orderBy: { createdAt: 'desc' },
      include: {
        document: {
          select: {
            id: true,
            originalName: true,
          },
        },
        _count: {
          select: { results: true },
        },
      },
      take: 20,
    });

    return NextResponse.json({
      checkRuns: checkRuns.map((run) => ({
        id: run.id,
        documentId: run.documentId,
        documentName: run.document.originalName,
        sheetName: run.sheetName,
        status: run.status,
        progress: run.progress,
        totalItems: run.totalItems,
        completedItems: run._count.results,
        error: run.error,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching check runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch check runs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { documentId, sheetName } = await request.json();

    if (!documentId || !sheetName) {
      return NextResponse.json(
        { error: 'documentId and sheetName are required' },
        { status: 400 }
      );
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.processed) {
      return NextResponse.json(
        { error: 'Document must be processed before running checks' },
        { status: 400 }
      );
    }

    const sheet = getChecklistSheet(sheetName);
    if (!sheet || sheet.items.length === 0) {
      return NextResponse.json(
        { error: 'Checklist sheet not found' },
        { status: 404 }
      );
    }

    const existingCount = await prisma.checklistItem.count({
      where: { sheetName },
    });

    if (existingCount === 0) {
      await prisma.$transaction(
        sheet.items.map((item) =>
          prisma.checklistItem.create({
            data: {
              sheetName: sheet.sheetName,
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

    const checkRun = await prisma.checkRun.create({
      data: {
        userId: ANONYMOUS_USER_ID,
        documentId,
        sheetName,
        totalItems: sheet.items.length,
      },
    });

    startCheckRunJob(checkRun.id);

    return NextResponse.json({
      checkRun: {
        id: checkRun.id,
        documentId: checkRun.documentId,
        sheetName: checkRun.sheetName,
        status: checkRun.status,
      },
    });
  } catch (error) {
    console.error('Error creating check run:', error);
    return NextResponse.json(
      { error: 'Failed to create check run' },
      { status: 500 }
    );
  }
}
