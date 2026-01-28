'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { FileUpload } from '@/components/dashboard/file-upload';
import { DocumentList } from '@/components/dashboard/document-list';
import { CheckRunner } from '@/components/dashboard/check-runner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Document {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  pageCount: number;
  processed: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user) {
      loadDocuments();
    }
  }, [session?.user]);

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();

      if (response.ok) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = (documentId: string) => {
    loadDocuments();
    setSelectedDocId(documentId);
  };

  const handleRunDemo = async () => {
    setIsDemoRunning(true);
    setDemoMessage('Setting up demo...');

    try {
      const response = await fetch('/api/demo', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Demo failed');
      }

      setDemoMessage(data.message);
      await loadDocuments();

      if (data.checkRun?.id) {
        // Navigate to results
        setTimeout(() => {
          router.push(`/results/${data.checkRun.id}`);
        }, 1500);
      } else if (data.document?.id) {
        setSelectedDocId(data.document.id);
      }
    } catch (error) {
      setDemoMessage(error instanceof Error ? error.message : 'Demo failed');
    } finally {
      setIsDemoRunning(false);
    }
  };

  if (isPending || !session?.user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-pulse text-[#a3a3a3]">Loading...</div>
      </div>
    );
  }

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#f5f5f5]">Dashboard</h1>
        <p className="text-[#a3a3a3] mt-2">
          Upload and check annual reports against SRA criteria
        </p>
      </div>

      {/* Demo Card */}
      <Card className="mb-8 border-[#3b82f6]/30 bg-gradient-to-r from-[#1a1a1a] to-[#1a1a1a]/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            Quick Demo
          </CardTitle>
          <CardDescription>
            Try the SRA Checker with the included example jaarrekening PDF
          </CardDescription>
        </CardHeader>
        <CardContent>
          {demoMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              demoMessage.includes('error') || demoMessage.includes('failed')
                ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                : 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
            }`}>
              {demoMessage}
            </div>
          )}
          <Button
            onClick={handleRunDemo}
            isLoading={isDemoRunning}
            variant="primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Run Demo with Example PDF
          </Button>
          <p className="text-xs text-[#a3a3a3] mt-3">
            This uses the included voorbeeldjaarrekening-gemeenten-2023.pdf and sample SRA checklist.
            Make sure OPENAI_API_KEY is configured for full functionality.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          <FileUpload onUploadComplete={handleUploadComplete} />

          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-[#262626] rounded w-3/4" />
                  <div className="h-4 bg-[#262626] rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <DocumentList
              documents={documents}
              selectedId={selectedDocId}
              onSelect={setSelectedDocId}
            />
          )}
        </div>

        {/* Right Column */}
        <div>
          {selectedDoc && selectedDoc.processed ? (
            <CheckRunner
              documentId={selectedDoc.id}
              documentName={selectedDoc.originalName}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Run Checks</CardTitle>
                <CardDescription>
                  {selectedDoc
                    ? 'Document is being processed...'
                    : 'Select a document to run compliance checks'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-[#a3a3a3]">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 opacity-30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  <p>
                    {selectedDoc
                      ? 'Please wait while the document is processed...'
                      : 'Upload or select a document to get started'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
