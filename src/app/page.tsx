'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, AlertCircle, Clock, Play } from 'lucide-react';

interface ChecklistSheet {
  name: string;
  itemCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentProcessed, setDocumentProcessed] = useState(false);
  const [sheets, setSheets] = useState<ChecklistSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<string>('');
  const [isRunningChecks, setIsRunningChecks] = useState(false);

  // Load available sheets on mount
  useEffect(() => {
    fetch('/api/checklist')
      .then((res) => res.json())
      .then((data) => {
        if (data.sheets) {
          setSheets(data.sheets);
          if (data.sheets.length > 0) {
            setSelectedSheet(data.sheets[0].name);
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Selecteer een PDF bestand');
        return;
      }
      setFile(selectedFile);
      setError('');
      setDocumentId(null);
      setDocumentProcessed(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError('');
    setStatus('PDF uploaden...');

    // Create AbortController for timeout handling
    const uploadController = new AbortController();
    const processController = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Set upload timeout (30 seconds)
      const uploadTimeout = setTimeout(() => uploadController.abort(), 30000);

      const uploadRes = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
        signal: uploadController.signal,
      });

      clearTimeout(uploadTimeout);

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Upload mislukt');
      }

      const uploadData = await uploadRes.json();
      setDocumentId(uploadData.document.id);
      setStatus('PDF verwerken (tekst extractie & embeddings genereren)... Dit kan enkele minuten duren voor grote bestanden.');

      // Process the document with longer timeout (5 minutes for large PDFs)
      setIsProcessing(true);
      const processTimeout = setTimeout(() => processController.abort(), 300000);

      const processRes = await fetch(`/api/documents/${uploadData.document.id}/process`, {
        method: 'POST',
        signal: processController.signal,
      });

      clearTimeout(processTimeout);

      if (!processRes.ok) {
        const errorData = await processRes.json();
        throw new Error(errorData.error || 'Verwerking mislukt');
      }

      setDocumentProcessed(true);
      setStatus('PDF klaar! Selecteer een checklist en start de controle.');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Verwerking duurde te lang. Probeer een kleiner PDF bestand of probeer het later opnieuw.');
      } else {
        setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      }
      setStatus('');
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const handleRunChecks = async () => {
    if (!documentId || !selectedSheet) return;

    setIsRunningChecks(true);
    setError('');
    setStatus('Controle starten...');

    try {
      const res = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          sheetName: selectedSheet,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Kon controle niet starten');
      }

      const data = await res.json();
      pollCheckStatus(data.checkRun.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      setIsRunningChecks(false);
    }
  };

  const pollCheckStatus = async (runId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/checks/${runId}`);
        const data = await res.json();

        if (data.checkRun.status === 'completed') {
          setStatus('Controle voltooid!');
          setIsRunningChecks(false);
          router.push(`/results/${runId}`);
        } else if (data.checkRun.status === 'failed') {
          setError(data.checkRun.error || 'Controle mislukt');
          setIsRunningChecks(false);
        } else {
          setStatus(`Verwerken: ${data.checkRun.progress}% (${data.results?.length || 0}/${data.checkRun.totalItems} checks)`);
          setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error('Poll error:', err);
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  const handleRunDemo = async () => {
    setIsUploading(true);
    setError('');
    setStatus('Demo PDF laden...');

    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Demo mislukt');
      }

      const data = await res.json();
      setDocumentId(data.document.id);
      setDocumentProcessed(true);
      setIsRunningChecks(true);
      setStatus('Demo gestart! Checks worden verwerkt...');

      pollCheckStatus(data.checkRun.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo mislukt');
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Check uw jaarrekening tegen SRA criteria
          </h1>
          <p className="text-lg text-[#a3a3a3] max-w-2xl mx-auto">
            Upload een PDF jaarrekening en laat AI automatisch controleren of deze voldoet
            aan de SRA checklist criteria voor i+d ondernemingen.
          </p>
        </div>

        {/* Status/Error Messages */}
        {error && (
          <div className="mb-6 p-4 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0" />
            <span className="text-[#ef4444]">{error}</span>
          </div>
        )}

        {status && !error && (
          <div className="mb-6 p-4 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-lg flex items-center gap-3">
            <Clock className="w-5 h-5 text-[#3b82f6] animate-pulse flex-shrink-0" />
            <span className="text-[#3b82f6]">{status}</span>
          </div>
        )}

        <div className="grid gap-6">
          {/* Step 1: Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-6 h-6 bg-[#3b82f6] rounded-full flex items-center justify-center text-sm text-white">1</span>
                Upload Jaarrekening (PDF)
              </CardTitle>
              <CardDescription>
                Upload de jaarrekening die u wilt controleren
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-8 text-center hover:border-[#3b82f6] transition-colors">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                    disabled={isUploading || isProcessing}
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-[#a3a3a3] mx-auto mb-4" />
                    {file ? (
                      <div className="flex items-center justify-center gap-2 text-[#22c55e]">
                        <FileText className="w-5 h-5" />
                        <span>{file.name}</span>
                      </div>
                    ) : (
                      <p className="text-[#a3a3a3]">
                        Klik om een PDF te selecteren of sleep het bestand hierheen
                      </p>
                    )}
                  </label>
                </div>

                {file && !documentProcessed && (
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isProcessing}
                    isLoading={isUploading || isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? 'Verwerken...' : 'Upload & Verwerk PDF'}
                  </Button>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[#2a2a2a]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#0f0f0f] px-2 text-[#a3a3a3]">of</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={handleRunDemo}
                  disabled={isUploading || isProcessing || isRunningChecks}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Demo met voorbeeld jaarrekening
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Select Sheet */}
          {documentProcessed && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#3b82f6] rounded-full flex items-center justify-center text-sm text-white">2</span>
                  Selecteer Checklist Sheet
                </CardTitle>
                <CardDescription>
                  Kies welke SRA checklist sheet u wilt controleren (gefilterd op i+d type)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    {sheets.map((sheet) => (
                      <label
                        key={sheet.name}
                        className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedSheet === sheet.name
                            ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                            : 'border-[#2a2a2a] hover:border-[#3b82f6]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="sheet"
                            value={sheet.name}
                            checked={selectedSheet === sheet.name}
                            onChange={(e) => setSelectedSheet(e.target.value)}
                            className="w-4 h-4 text-[#3b82f6]"
                          />
                          <span className="text-white">{sheet.name}</span>
                        </div>
                        <span className="text-sm text-[#a3a3a3]">{sheet.itemCount} checks</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Run Checks */}
          {documentProcessed && selectedSheet && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-[#3b82f6] rounded-full flex items-center justify-center text-sm text-white">3</span>
                  Start Controle
                </CardTitle>
                <CardDescription>
                  De AI controleert elk criterium en geeft PASS/FAIL/UNKNOWN met bewijs en paginareferenties
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleRunChecks}
                  disabled={isRunningChecks}
                  isLoading={isRunningChecks}
                  className="w-full"
                  size="lg"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {isRunningChecks ? 'Controleren...' : `Start ${selectedSheet} Controle`}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-[#3b82f6]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-[#3b82f6]" />
            </div>
            <h3 className="text-white font-semibold mb-2">PDF Analyse</h3>
            <p className="text-sm text-[#a3a3a3]">
              Extractie van tekst pagina voor pagina met slimme chunking voor RAG
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-[#22c55e]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-[#22c55e]" />
            </div>
            <h3 className="text-white font-semibold mb-2">SRA Criteria (i+d)</h3>
            <p className="text-sm text-[#a3a3a3]">
              40 checks voor inrichtings- en deponeringsjaarrekening gebaseerd op BW
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-[#f59e0b]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[#f59e0b]" />
            </div>
            <h3 className="text-white font-semibold mb-2">Bewijs & Pagina's</h3>
            <p className="text-sm text-[#a3a3a3]">
              Elk resultaat met citaat en exacte paginanummer uit de jaarrekening
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1a1a1a] py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-[#a3a3a3]">
          SRA Checker - AI-powered accountancy compliance tool voor jaarrekeningen
        </div>
      </footer>
    </div>
  );
}
