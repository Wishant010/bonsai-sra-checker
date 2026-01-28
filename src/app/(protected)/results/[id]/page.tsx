'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { ResultsTable } from '@/components/dashboard/results-table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Evidence {
  page: number;
  quote: string;
}

interface CheckResult {
  id: string;
  checkId: string;
  checkText: string;
  category: string | null;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reasoning: string;
  evidence: Evidence[];
  confidence: number;
  processingTime: number | null;
}

interface CheckRun {
  id: string;
  documentId: string;
  documentName: string;
  documentPageCount: number;
  sheetName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  completedItems: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  results: CheckResult[];
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = useSession();
  const [checkRun, setCheckRun] = useState<CheckRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSessionPending && !session?.user) {
      router.push('/login');
    }
  }, [session, isSessionPending, router]);

  useEffect(() => {
    if (session?.user && id) {
      loadCheckRun();
    }
  }, [session?.user, id]);

  // Poll for updates while processing
  useEffect(() => {
    if (checkRun?.status === 'processing' || checkRun?.status === 'pending') {
      const interval = setInterval(loadCheckRun, 2000);
      return () => clearInterval(interval);
    }
  }, [checkRun?.status]);

  const loadCheckRun = async () => {
    try {
      const response = await fetch(`/api/checks/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load results');
      }

      setCheckRun(data.checkRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRerun = async () => {
    if (!checkRun) return;

    try {
      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: checkRun.documentId,
          sheetName: checkRun.sheetName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start rerun');
      }

      router.push(`/results/${data.checkRun.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rerun checks');
    }
  };

  if (isSessionPending || !session?.user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-pulse text-[#a3a3a3]">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#262626] rounded w-1/3" />
          <div className="h-4 bg-[#262626] rounded w-1/2" />
          <div className="grid grid-cols-4 gap-4 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-[#1a1a1a] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !checkRun) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-[#ef4444] mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-[#ef4444] mb-4">{error || 'Check run not found'}</p>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProcessing = checkRun.status === 'processing' || checkRun.status === 'pending';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard" className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-[#f5f5f5]">Check Results</h1>
            <StatusBadge status={checkRun.status} />
          </div>
          <p className="text-[#a3a3a3]">
            {checkRun.documentName} • {checkRun.sheetName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isProcessing && (
            <Button variant="outline" onClick={handleRerun}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Rerun Checks
            </Button>
          )}
          <Link href="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <svg className="w-6 h-6 animate-spin text-[#3b82f6]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing Checks...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#a3a3a3]">Progress</span>
                <span className="text-[#f5f5f5]">
                  {checkRun.completedItems} / {checkRun.totalItems} checks
                </span>
              </div>
              <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#3b82f6] to-[#10b981] transition-all duration-500"
                  style={{ width: `${checkRun.progress}%` }}
                />
              </div>
              <p className="text-sm text-[#a3a3a3]">
                This may take a few minutes. Results will appear below as they complete.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {checkRun.status === 'failed' && checkRun.error && (
        <Card className="mb-8 border-[#ef4444]/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-[#ef4444]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Error: {checkRun.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {checkRun.results.length > 0 ? (
        <ResultsTable
          results={checkRun.results}
          documentPageCount={checkRun.documentPageCount}
        />
      ) : !isProcessing ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-[#a3a3a3]">No results yet</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
