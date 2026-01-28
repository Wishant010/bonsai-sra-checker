'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CheckSheet {
  name: string;
  itemCount: number;
}

interface CheckRunnerProps {
  documentId: string;
  documentName: string;
}

export function CheckRunner({ documentId, documentName }: CheckRunnerProps) {
  const router = useRouter();
  const [sheets, setSheets] = useState<CheckSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSheets();
  }, []);

  const loadSheets = async () => {
    try {
      // First ensure checklist is seeded
      await fetch('/api/checklist', { method: 'POST' });

      const response = await fetch('/api/checklist');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load checklist');
      }

      setSheets(data.sheets);
      if (data.sheets.length > 0) {
        setSelectedSheet(data.sheets[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load checklist');
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleRunChecks = async () => {
    if (!selectedSheet) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          sheetName: selectedSheet,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start check run');
      }

      // Navigate to results page
      router.push(`/results/${data.checkRun.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start check run');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Checks</CardTitle>
        <CardDescription>
          Run SRA checklist validation against your document
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 text-sm text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#f5f5f5] mb-2">
              Selected Document
            </label>
            <div className="p-3 bg-[#262626] rounded-lg border border-[#2a2a2a]">
              <p className="text-[#f5f5f5] font-medium truncate">{documentName}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#f5f5f5] mb-2">
              Checklist Sheet
            </label>
            {isLoadingSheets ? (
              <div className="p-3 bg-[#262626] rounded-lg border border-[#2a2a2a] animate-pulse">
                <div className="h-5 bg-[#2a2a2a] rounded w-1/2" />
              </div>
            ) : sheets.length > 0 ? (
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
              >
                {sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} ({sheet.itemCount} checks)
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-[#262626] rounded-lg border border-[#2a2a2a]">
                <p className="text-[#a3a3a3]">No checklist sheets available</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleRunChecks}
            isLoading={isLoading}
            disabled={!selectedSheet || isLoadingSheets}
            className="w-full"
            size="lg"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Run Checks
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
