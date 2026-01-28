'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Document {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  pageCount: number;
  processed: boolean;
  createdAt: string;
}

interface DocumentListProps {
  documents: Document[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function DocumentList({ documents, selectedId, onSelect }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Documents</CardTitle>
          <CardDescription>Upload a PDF to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[#a3a3a3]">
            <svg
              className="w-12 h-12 mx-auto mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>No documents uploaded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Documents</CardTitle>
        <CardDescription>Select a document to run checks</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[#2a2a2a]">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc.id)}
              className={`
                w-full px-6 py-4 text-left transition-all duration-200
                hover:bg-[#262626]
                ${selectedId === doc.id ? 'bg-[#262626] border-l-2 border-l-[#3b82f6]' : ''}
              `}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#f5f5f5] truncate">
                    {doc.originalName}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-[#a3a3a3]">
                    <span>{(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                    {doc.pageCount > 0 && (
                      <>
                        <span>•</span>
                        <span>{doc.pageCount} pages</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant={doc.processed ? 'pass' : 'secondary'}>
                  {doc.processed ? 'Ready' : 'Pending'}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
