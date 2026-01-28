import OpenAI from 'openai';
import { RetrievedChunk } from './embeddings';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Using GPT-4o-mini for cost-effectiveness while maintaining quality
const LLM_MODEL = 'gpt-4o-mini';

export interface Evidence {
  page: number;
  quote: string;
}

export interface CheckEvaluationResult {
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reasoning: string;
  evidence: Evidence[];
  confidence: number;
}

/**
 * Evaluate a checklist criterion against retrieved document chunks
 */
export async function evaluateChecklistItem(
  checkText: string,
  chunks: RetrievedChunk[]
): Promise<CheckEvaluationResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: 'UNKNOWN',
      reasoning: 'OpenAI API key is not configured. Please add OPENAI_API_KEY to your environment.',
      evidence: [],
      confidence: 0,
    };
  }

  if (chunks.length === 0) {
    return {
      status: 'UNKNOWN',
      reasoning: 'No relevant document content found for this criterion.',
      evidence: [],
      confidence: 0,
    };
  }

  // Format context from chunks
  const contextParts = chunks.map(
    (chunk, idx) =>
      `[Document Fragment ${idx + 1}, Page ${chunk.pageNumber}]\n${chunk.content}`
  );
  const context = contextParts.join('\n\n---\n\n');

  const systemPrompt = `Je bent een expert accountant die Nederlandse jaarrekeningen (annual reports) controleert tegen de SRA checklist criteria.

Je taak is om te beoordelen of een specifiek criterium PASS (voldaan), FAIL (niet voldaan) of UNKNOWN (onvoldoende informatie) is op basis van de verstrekte documentfragmenten.

BELANGRIJKE REGELS:
1. Baseer je beoordeling ALLEEN op de verstrekte documentfragmenten
2. Als de informatie onvoldoende is om een conclusie te trekken, geef UNKNOWN
3. Citeer EXACT tekst uit de fragmenten als bewijs - verzin NOOIT citaten
4. Geef een korte, zakelijke uitleg voor je beoordeling
5. Wees conservatief: bij twijfel, kies UNKNOWN

Antwoord ALLEEN in het volgende JSON formaat:
{
  "status": "PASS" | "FAIL" | "UNKNOWN",
  "reasoning": "korte uitleg (max 2 zinnen)",
  "evidence": [
    {"page": <paginanummer>, "quote": "<exact citaat uit document>"}
  ],
  "confidence": <0.0-1.0>
}`;

  const userPrompt = `CRITERIUM TE CONTROLEREN:
${checkText}

DOCUMENTFRAGMENTEN:
${context}

Beoordeel of dit criterium voldaan is in de jaarrekening. Antwoord in JSON formaat.`;

  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const result = JSON.parse(content) as CheckEvaluationResult;

    // Validate and normalize the result
    return {
      status: validateStatus(result.status),
      reasoning: result.reasoning || 'Geen toelichting beschikbaar.',
      evidence: validateEvidence(result.evidence, chunks),
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
    };
  } catch (error) {
    console.error('Error evaluating checklist item:', error);
    return {
      status: 'UNKNOWN',
      reasoning: `Error during evaluation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      evidence: [],
      confidence: 0,
    };
  }
}

/**
 * Validate and normalize status value
 */
function validateStatus(status: string): 'PASS' | 'FAIL' | 'UNKNOWN' {
  const normalized = String(status).toUpperCase().trim();
  if (normalized === 'PASS') return 'PASS';
  if (normalized === 'FAIL') return 'FAIL';
  return 'UNKNOWN';
}

/**
 * Validate evidence - ensure quotes actually appear in chunks
 */
function validateEvidence(
  evidence: Evidence[] | undefined,
  chunks: RetrievedChunk[]
): Evidence[] {
  if (!evidence || !Array.isArray(evidence)) return [];

  const allContent = chunks.map((c) => c.content.toLowerCase()).join(' ');

  return evidence
    .filter((e) => {
      // Verify the quote exists in the chunks (fuzzy match)
      if (!e.quote || e.quote.length < 10) return false;
      const normalizedQuote = e.quote.toLowerCase().slice(0, 50);
      return allContent.includes(normalizedQuote.slice(0, 30));
    })
    .map((e) => ({
      page: e.page || 1,
      quote: e.quote.slice(0, 300), // Limit quote length
    }))
    .slice(0, 3); // Max 3 evidence items
}

/**
 * Batch evaluate multiple checklist items
 * Processes items concurrently with rate limiting
 */
export async function batchEvaluateItems(
  items: Array<{
    checkText: string;
    chunks: RetrievedChunk[];
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<CheckEvaluationResult[]> {
  const results: CheckEvaluationResult[] = [];
  const concurrency = 3; // Process 3 at a time to avoid rate limits

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map((item) => evaluateChecklistItem(item.checkText, item.chunks))
    );

    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + concurrency, items.length), items.length);
    }

    // Rate limiting delay between batches
    if (i + concurrency < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
