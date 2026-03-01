'use client';

import React, { useState } from 'react';
import { FileUpload } from '@/components/ui/file-upload';
import { extractTextFromPDF } from '@/lib/pdf';
import { analyzeCoverage, CoverageResult } from '@/lib/gemini';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText, AlertCircle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Step = 'upload' | 'processing' | 'results';

export default function Page() {
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [topicsFile, setTopicsFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [progressText, setProgressText] = useState('');
  const [results, setResults] = useState<CoverageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'covered' | 'missing'>('all');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  const handleAnalyze = async () => {
    if (!notesFile || !topicsFile) return;

    setStep('processing');
    setError(null);
    setResults([]);

    try {
      setProgressText('Extracting text from Notes PDF...');
      const notesText = await extractTextFromPDF(notesFile, (msg) => setProgressText(`Notes PDF: ${msg}`), 'notes') as string;

      setProgressText('Extracting topics from Topics PDF...');
      let extractedTopics = await extractTextFromPDF(topicsFile, (msg) => setProgressText(`Topics PDF: ${msg}`), 'topics') as string[];

      // Deduplicate topics
      extractedTopics = Array.from(new Set(extractedTopics));

      if (extractedTopics.length === 0) {
        throw new Error('Could not extract any topics from the provided Topics PDF.');
      }

      // Split topics into chunks of 20 to ensure thorough analysis without missing any
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < extractedTopics.length; i += chunkSize) {
        chunks.push(extractedTopics.slice(i, i + chunkSize));
      }

      let allResults: CoverageResult[] = [];
      for (let i = 0; i < chunks.length; i++) {
        setProgressText(`Analyzing coverage (Batch ${i + 1} of ${chunks.length})...`);
        const chunkResults = await analyzeCoverage(notesText, chunks[i]);
        allResults = [...allResults, ...chunkResults];
      }

      setResults(allResults);
      setStep('results');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during analysis.');
      setStep('upload');
    }
  };

  const toggleExpand = (topic: string) => {
    setExpandedTopics((prev) => ({ ...prev, [topic]: !prev[topic] }));
  };

  const coveredTopics = results.filter((r) => r.isCovered);
  const missingTopics = results.filter((r) => !r.isCovered);
  const sortedAllTopics = [...results].sort((a, b) => {
    if (a.isCovered === b.isCovered) return 0;
    return a.isCovered ? -1 : 1;
  });

  const handleDownloadMarkdown = () => {
    let md = `# PDF Topic Coverage Analysis\n\n`;

    md += `## Covered Topics (${coveredTopics.length})\n\n`;
    coveredTopics.forEach(r => {
      md += `### ✅ ${r.topic}\n`;
      if (r.pageNumbers) md += `**Pages:** ${r.pageNumbers}\n\n`;
      md += `**Evidence:** ${r.evidence}\n\n`;
    });

    md += `## Missing Topics (${missingTopics.length})\n\n`;
    missingTopics.forEach(r => {
      md += `### ❌ ${r.topic}\n`;
      md += `**Details:** ${r.evidence}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'coverage-analysis.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMissingBatches = () => {
    if (missingTopics.length === 0) return;
    
    const chunkSize = 20;
    for (let i = 0; i < missingTopics.length; i += chunkSize) {
      const batch = missingTopics.slice(i, i + chunkSize);
      const batchNum = Math.floor(i / chunkSize) + 1;
      const totalBatches = Math.ceil(missingTopics.length / chunkSize);
      
      let md = `# Missing Topics - Batch ${batchNum} of ${totalBatches}\n\n`;
      md += `Total missing topics in this batch: ${batch.length}\n\n`;
      
      batch.forEach((r, idx) => {
        md += `## ${idx + 1}. ${r.topic}\n`;
        md += `**Details:** ${r.evidence}\n\n`;
        md += `---\n\n`;
      });

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `missing-topics-batch-${batchNum}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Small delay to help browser handle multiple downloads
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Header */}
      <header className="bg-black border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <FileText className="w-4 h-4 text-black" />
            </div>
            <h1 className="text-lg font-medium tracking-tight text-white">PDF Topic Coverage Analyzer</h1>
          </div>
          {step === 'results' && (
            <div className="flex items-center space-x-3">
              {missingTopics.length > 0 && (
                <button
                  onClick={handleDownloadMissingBatches}
                  className="flex items-center space-x-1.5 text-sm font-medium text-rose-300 hover:text-rose-100 transition-colors bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-full border border-rose-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Missing (Batches of 20)</span>
                </button>
              )}
              <button
                onClick={handleDownloadMarkdown}
                className="flex items-center space-x-1.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full"
              >
                <Download className="w-4 h-4" />
                <span>Export .md</span>
              </button>
              <button
                onClick={() => {
                  setStep('upload');
                  setNotesFile(null);
                  setTopicsFile(null);
                  setResults([]);
                }}
                className="text-sm font-medium text-zinc-500 hover:text-white transition-colors"
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-4xl font-light tracking-tight text-white sm:text-5xl">
                  Analyze your study notes
                </h2>
                <p className="mt-6 text-lg text-zinc-400 font-light">
                  Upload your comprehensive notes and a list of topics or questions. We&apos;ll use AI to cross-reference and tell you exactly what you&apos;ve missed.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-rose-300">{error}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">1. Notes PDF</h3>
                  <FileUpload
                    file={notesFile}
                    onFileSelect={setNotesFile}
                    label="Upload Notes PDF"
                    description="The document containing your study material"
                  />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">2. Topics PDF</h3>
                  <FileUpload
                    file={topicsFile}
                    onFileSelect={setTopicsFile}
                    label="Upload Topics PDF"
                    description="The syllabus, questions, or list of topics to check"
                  />
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button
                  onClick={handleAnalyze}
                  disabled={!notesFile || !topicsFile}
                  className="px-8 py-3.5 bg-white text-black rounded-full font-medium hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Analyze Coverage
                </button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-32 space-y-8"
            >
              <div className="relative">
                <div className="w-16 h-16 border-2 border-white/10 rounded-full"></div>
                <div className="w-16 h-16 border-2 border-white rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-xl font-light text-white tracking-wide">Analyzing Documents</h3>
                <p className="text-zinc-500 animate-pulse font-light">{progressText}</p>
              </div>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-zinc-950 p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-5xl font-light text-white mb-2">{coveredTopics.length}</p>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Covered Topics</p>
                </div>
                <div className="bg-zinc-950 p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mb-4">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <p className="text-5xl font-light text-white mb-2">{missingTopics.length}</p>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Missing Topics</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-zinc-950 rounded-3xl border border-white/10 overflow-hidden">
                <div className="flex border-b border-white/10">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={cn(
                      "flex-1 py-5 px-6 text-sm font-medium text-center transition-colors relative",
                      activeTab === 'all' ? "text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    All Topics ({results.length})
                    {activeTab === 'all' && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('missing')}
                    className={cn(
                      "flex-1 py-5 px-6 text-sm font-medium text-center transition-colors relative",
                      activeTab === 'missing' ? "text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    Missing ({missingTopics.length})
                    {activeTab === 'missing' && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('covered')}
                    className={cn(
                      "flex-1 py-5 px-6 text-sm font-medium text-center transition-colors relative",
                      activeTab === 'covered' ? "text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    Covered ({coveredTopics.length})
                    {activeTab === 'covered' && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                  </button>
                </div>

                <div className="divide-y divide-white/5">
                  {(activeTab === 'all' ? sortedAllTopics : activeTab === 'missing' ? missingTopics : coveredTopics).map((result, idx) => (
                    <div key={idx} className="p-5 sm:p-6 hover:bg-white/5 transition-colors">
                      <div 
                        className="flex items-start justify-between cursor-pointer group"
                        onClick={() => toggleExpand(result.topic)}
                      >
                        <div className="flex items-start space-x-4 pr-4">
                          {result.isCovered ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                          )}
                          <h4 className="text-base font-medium text-zinc-100 leading-snug flex items-center flex-wrap gap-2.5">
                            <span>{result.topic}</span>
                            {result.isCovered && result.pageNumbers && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                {result.pageNumbers}
                              </span>
                            )}
                          </h4>
                        </div>
                        <button className="text-zinc-600 group-hover:text-zinc-300 transition-colors p-1">
                          {expandedTopics[result.topic] ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      
                      <AnimatePresence>
                        {expandedTopics[result.topic] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-5 ml-9 pl-5 border-l border-white/10">
                              <p className="text-sm text-zinc-400 leading-relaxed font-light">
                                {result.evidence}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}

                  {(activeTab === 'all' ? results : activeTab === 'missing' ? missingTopics : coveredTopics).length === 0 && (
                    <div className="p-16 text-center">
                      <p className="text-zinc-500 font-light">
                        {activeTab === 'all'
                          ? "No topics found."
                          : activeTab === 'missing' 
                          ? "Great job! All topics seem to be covered in your notes." 
                          : "No topics were found to be covered in your notes."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div> 
    </main>
  );
}
