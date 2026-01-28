'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';

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

interface ResultsTableProps {
  results: CheckResult[];
  documentPageCount?: number;
}

export function ResultsTable({ results, documentPageCount }: ResultsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'PASS' | 'FAIL' | 'UNKNOWN'>('all');

  const filteredResults = filter === 'all'
    ? results
    : results.filter((r) => r.status === filter);

  const stats = {
    total: results.length,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    unknown: results.filter((r) => r.status === 'UNKNOWN').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`p-4 rounded-lg border transition-all ${
            filter === 'all'
              ? 'bg-[#1a1a1a] border-[#3b82f6]'
              : 'bg-[#1a1a1a]/50 border-[#2a2a2a] hover:border-[#3b82f6]/50'
          }`}
        >
          <p className="text-2xl font-bold text-[#f5f5f5]">{stats.total}</p>
          <p className="text-sm text-[#a3a3a3]">Total Checks</p>
        </button>
        <button
          onClick={() => setFilter('PASS')}
          className={`p-4 rounded-lg border transition-all ${
            filter === 'PASS'
              ? 'bg-[#10b981]/10 border-[#10b981]'
              : 'bg-[#1a1a1a]/50 border-[#2a2a2a] hover:border-[#10b981]/50'
          }`}
        >
          <p className="text-2xl font-bold text-[#10b981]">{stats.pass}</p>
          <p className="text-sm text-[#a3a3a3]">Passed</p>
        </button>
        <button
          onClick={() => setFilter('FAIL')}
          className={`p-4 rounded-lg border transition-all ${
            filter === 'FAIL'
              ? 'bg-[#ef4444]/10 border-[#ef4444]'
              : 'bg-[#1a1a1a]/50 border-[#2a2a2a] hover:border-[#ef4444]/50'
          }`}
        >
          <p className="text-2xl font-bold text-[#ef4444]">{stats.fail}</p>
          <p className="text-sm text-[#a3a3a3]">Failed</p>
        </button>
        <button
          onClick={() => setFilter('UNKNOWN')}
          className={`p-4 rounded-lg border transition-all ${
            filter === 'UNKNOWN'
              ? 'bg-[#f59e0b]/10 border-[#f59e0b]'
              : 'bg-[#1a1a1a]/50 border-[#2a2a2a] hover:border-[#f59e0b]/50'
          }`}
        >
          <p className="text-2xl font-bold text-[#f59e0b]">{stats.unknown}</p>
          <p className="text-sm text-[#a3a3a3]">Unknown</p>
        </button>
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Check Results
            {filter !== 'all' && (
              <span className="ml-2 text-sm font-normal text-[#a3a3a3]">
                (showing {filter} only)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[#2a2a2a]">
            {filteredResults.map((result) => (
              <div key={result.id}>
                <button
                  onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                  className="w-full px-6 py-4 text-left hover:bg-[#262626]/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-mono text-[#a3a3a3] bg-[#262626] px-2 py-0.5 rounded">
                          {result.checkId}
                        </span>
                        {result.category && (
                          <span className="text-xs text-[#a3a3a3]">
                            {result.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[#f5f5f5] line-clamp-2">
                        {result.checkText}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={result.status} />
                      <svg
                        className={`w-5 h-5 text-[#a3a3a3] transition-transform ${
                          expandedId === result.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {expandedId === result.id && (
                  <div className="px-6 pb-4 border-t border-[#2a2a2a] bg-[#0f0f0f]">
                    <div className="pt-4 space-y-4">
                      {/* Reasoning */}
                      <div>
                        <h4 className="text-sm font-medium text-[#a3a3a3] mb-2">
                          Reasoning
                        </h4>
                        <p className="text-[#f5f5f5] text-sm leading-relaxed">
                          {result.reasoning}
                        </p>
                      </div>

                      {/* Evidence */}
                      {result.evidence.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-[#a3a3a3] mb-2">
                            Evidence
                          </h4>
                          <div className="space-y-2">
                            {result.evidence.map((e, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <svg
                                    className="w-4 h-4 text-[#3b82f6]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                  <span className="text-xs font-medium text-[#3b82f6]">
                                    Page {e.page}
                                    {documentPageCount && ` of ${documentPageCount}`}
                                  </span>
                                </div>
                                <p className="text-sm text-[#a3a3a3] italic">
                                  &ldquo;{e.quote}&rdquo;
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-4 pt-2 text-xs text-[#a3a3a3]">
                        <span>
                          Confidence: {Math.round(result.confidence * 100)}%
                        </span>
                        {result.processingTime && (
                          <span>
                            Processing time: {(result.processingTime / 1000).toFixed(2)}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredResults.length === 0 && (
              <div className="px-6 py-12 text-center text-[#a3a3a3]">
                No results found for this filter
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
