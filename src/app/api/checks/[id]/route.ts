import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Allow anonymous access - no user check
    const checkRun = await prisma.checkRun.findFirst({
      where: {
        id,
      },
      include: {
        document: {
          select: {
            id: true,
            originalName: true,
            pageCount: true,
          },
        },
        results: {
          include: {
            checklistItem: {
              select: {
                checkId: true,
                checkText: true,
                category: true,
              },
            },
          },
          orderBy: {
            checklistItem: {
              order: 'asc',
            },
          },
        },
        _count: {
          select: { results: true },
        },
      },
    });

    if (!checkRun) {
      return NextResponse.json({ error: 'Check run not found' }, { status: 404 });
    }

    return NextResponse.json({
      checkRun: {
        id: checkRun.id,
        documentId: checkRun.documentId,
        documentName: checkRun.document.originalName,
        documentPageCount: checkRun.document.pageCount,
        sheetName: checkRun.sheetName,
        status: checkRun.status,
        progress: checkRun.progress,
        totalItems: checkRun.totalItems,
        completedItems: checkRun._count.results,
        error: checkRun.error,
        createdAt: checkRun.createdAt,
        completedAt: checkRun.completedAt,
        results: checkRun.results.map((result) => ({
          id: result.id,
          checkId: result.checklistItem.checkId,
          checkText: result.checklistItem.checkText,
          category: result.checklistItem.category,
          status: result.status,
          reasoning: result.reasoning,
          evidence: JSON.parse(result.evidence),
          confidence: result.confidence,
          processingTime: result.processingTime,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching check run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch check run' },
      { status: 500 }
    );
  }
}
