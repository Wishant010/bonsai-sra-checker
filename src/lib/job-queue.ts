import prisma from './prisma';
import { retrieveRelevantChunks } from './embeddings';
import { evaluateChecklistItem, CheckEvaluationResult } from './llm';

export interface JobProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  completedItems: number;
  error?: string;
}

// In-memory job queue for MVP
// Can be replaced with Redis/BullMQ for production
const activeJobs: Map<string, { controller: AbortController }> = new Map();

/**
 * Start processing a check run job
 */
export async function startCheckRunJob(checkRunId: string): Promise<void> {
  // Prevent duplicate processing
  if (activeJobs.has(checkRunId)) {
    console.log(`Job ${checkRunId} is already running`);
    return;
  }

  const controller = new AbortController();
  activeJobs.set(checkRunId, { controller });

  // Process in background
  processCheckRunJob(checkRunId, controller.signal).catch((error) => {
    console.error(`Job ${checkRunId} failed:`, error);
    updateJobStatus(checkRunId, 'failed', error.message);
  });
}

/**
 * Stop a running job
 */
export function stopJob(checkRunId: string): void {
  const job = activeJobs.get(checkRunId);
  if (job) {
    job.controller.abort();
    activeJobs.delete(checkRunId);
  }
}

/**
 * Process a check run job
 */
async function processCheckRunJob(
  checkRunId: string,
  signal: AbortSignal
): Promise<void> {
  try {
    // Update status to processing
    const checkRun = await prisma.checkRun.update({
      where: { id: checkRunId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
      include: {
        document: true,
      },
    });

    // Get checklist items for the sheet
    const checklistItems = await prisma.checklistItem.findMany({
      where: {
        sheetName: checkRun.sheetName,
        applicableTypes: {
          contains: 'i+d',
        },
      },
      orderBy: { order: 'asc' },
    });

    if (checklistItems.length === 0) {
      throw new Error('No checklist items found for this sheet');
    }

    // Update total items
    await prisma.checkRun.update({
      where: { id: checkRunId },
      data: { totalItems: checklistItems.length },
    });

    // Process each checklist item
    for (let i = 0; i < checklistItems.length; i++) {
      if (signal.aborted) {
        throw new Error('Job was cancelled');
      }

      const item = checklistItems[i];
      const startTime = Date.now();

      try {
        // Retrieve relevant chunks
        const chunks = await retrieveRelevantChunks(
          checkRun.documentId,
          item.checkText,
          5
        );

        // Evaluate the checklist item
        const result: CheckEvaluationResult = await evaluateChecklistItem(
          item.checkText,
          chunks
        );

        // Store the result
        await prisma.checkResult.upsert({
          where: {
            checkRunId_checklistItemId: {
              checkRunId,
              checklistItemId: item.id,
            },
          },
          update: {
            status: result.status,
            reasoning: result.reasoning,
            evidence: JSON.stringify(result.evidence),
            confidence: result.confidence,
            processingTime: Date.now() - startTime,
          },
          create: {
            checkRunId,
            checklistItemId: item.id,
            status: result.status,
            reasoning: result.reasoning,
            evidence: JSON.stringify(result.evidence),
            confidence: result.confidence,
            processingTime: Date.now() - startTime,
          },
        });
      } catch (error) {
        console.error(`Error processing item ${item.checkId}:`, error);

        // Store error result
        await prisma.checkResult.upsert({
          where: {
            checkRunId_checklistItemId: {
              checkRunId,
              checklistItemId: item.id,
            },
          },
          update: {
            status: 'UNKNOWN',
            reasoning: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            evidence: '[]',
            confidence: 0,
            processingTime: Date.now() - startTime,
          },
          create: {
            checkRunId,
            checklistItemId: item.id,
            status: 'UNKNOWN',
            reasoning: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            evidence: '[]',
            confidence: 0,
            processingTime: Date.now() - startTime,
          },
        });
      }

      // Update progress
      const progress = Math.round(((i + 1) / checklistItems.length) * 100);
      await prisma.checkRun.update({
        where: { id: checkRunId },
        data: { progress },
      });
    }

    // Mark as completed
    await prisma.checkRun.update({
      where: { id: checkRunId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await updateJobStatus(
      checkRunId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  } finally {
    activeJobs.delete(checkRunId);
  }
}

/**
 * Update job status
 */
async function updateJobStatus(
  checkRunId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  error?: string
): Promise<void> {
  await prisma.checkRun.update({
    where: { id: checkRunId },
    data: {
      status,
      error,
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
    },
  });
}

/**
 * Get job progress
 */
export async function getJobProgress(checkRunId: string): Promise<JobProgress | null> {
  const checkRun = await prisma.checkRun.findUnique({
    where: { id: checkRunId },
    include: {
      _count: {
        select: { results: true },
      },
    },
  });

  if (!checkRun) return null;

  return {
    status: checkRun.status as JobProgress['status'],
    progress: checkRun.progress,
    totalItems: checkRun.totalItems,
    completedItems: checkRun._count.results,
    error: checkRun.error || undefined,
  };
}

/**
 * Check if a job is currently active
 */
export function isJobActive(checkRunId: string): boolean {
  return activeJobs.has(checkRunId);
}
