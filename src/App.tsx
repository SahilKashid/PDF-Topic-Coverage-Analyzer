import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, CheckCircle2, XCircle, ChevronDown, ChevronUp, Download, RotateCcw } from 'lucide-react';
import { FileUpload } from './components/ui/file-upload';
import { extractImagesFromPDF } from './lib/pdf';
import { extractTextFromNotes, extractTopicsFromPDF, analyzeCoverage, TopicCoverage } from './lib/gemini';
import { cn } from './lib/utils';

type Step = 'upload' | 'processing' | 'results';
type Tab = 'all' | 'missing' | 'covered';

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [topicsFile, setTopicsFile] = useState<File | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  const [results, setResults] = useState<TopicCoverage[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const handleAnalyze = async () => {
    if (!notesFile || !topicsFile) return;
    
    setStep('processing');
    try {
      setProgressText('Reading Notes PDF...');
      const notesImages = await extractImagesFromPDF(notesFile);
      
      setProgressText('Reading Topics PDF...');
      const topicsImages = await extractImagesFromPDF(topicsFile);
      
      const notesText = await extractTextFromNotes(notesImages, setProgressText);
      const topicsList = await extractTopicsFromPDF(topicsImages, setProgressText);
      
      const coverageResults = await analyzeCoverage(notesText, topicsList, setProgressText);
      setResults(coverageResults);
      setStep('results');
    } catch (error) {
      console.error('Analysis failed', error);
      alert('Analysis failed. Please try again.');
      setStep('upload');
    }
  };

  const handleStartOver = () => {
    setStep('upload');
    setNotesFile(null);
    setTopicsFile(null);
    setResults([]);
    setExpandedTopics(new Set());
    setActiveTab('all');
  };

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportAll = () => {
    const covered = results.filter(r => r.isCovered);
    const missing = results.filter(r => !r.isCovered);
    
    let md = '# Coverage Analysis\n\n';
    
    md += '## Covered Topics\n\n';
    covered.forEach(r => {
      md += `### ${r.topic}\n`;
      md += `**Page Numbers:** ${r.pageNumbers}\n\n`;
      md += `> ${r.evidence}\n\n`;
    });
    
    md += '## Missing Topics\n\n';
    missing.forEach(r => {
      md += `### ${r.topic}\n`;
      md += `> ${r.evidence}\n\n`;
    });
    
    downloadFile('coverage-analysis.md', md);
  };

  const exportMissingBatches = () => {
    const missing = results.filter(r => !r.isCovered);
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      let md = `# Missing Topics (Batch ${Math.floor(i / BATCH_SIZE) + 1})\n\n`;
      
      batch.forEach(r => {
        md += `### ${r.topic}\n`;
        md += `> ${r.evidence}\n\n`;
      });
      
      downloadFile(`missing-topics-batch-${Math.floor(i / BATCH_SIZE) + 1}.md`, md);
    }
  };

  const filteredResults = results.filter(r => {
    if (activeTab === 'all') return true;
    if (activeTab === 'covered') return r.isCovered;
    if (activeTab === 'missing') return !r.isCovered;
    return true;
  });

  const coveredCount = results.filter(r => r.isCovered).length;
  const missingCount = results.filter(r => !r.isCovered).length;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">PDF Topic Coverage Analyzer</h1>
          </div>
          
          {step === 'results' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartOver}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
              <button
                onClick={exportAll}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export .md
              </button>
              {missingCount > 0 && (
                <button
                  onClick={exportMissingBatches}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Missing (Batches of 20)
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center max-w-3xl mx-auto"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold tracking-tight mb-4">Analyze your study notes</h2>
                <p className="text-zinc-400 text-lg">
                  Upload your notes and a syllabus or topic list. We'll use AI to cross-reference them and tell you exactly what you've covered and what you're missing.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
                <FileUpload
                  label="1. Notes PDF"
                  selectedFile={notesFile}
                  onFileSelect={setNotesFile}
                />
                <FileUpload
                  label="2. Topics PDF"
                  selectedFile={topicsFile}
                  onFileSelect={setTopicsFile}
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!notesFile || !topicsFile}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-xl transition-colors w-full md:w-auto"
              >
                Analyze Coverage
              </button>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-24"
            >
              <div className="relative w-20 h-20 mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-xl font-medium mb-2">Processing Documents</h3>
              <p className="text-zinc-400 text-center max-w-md">{progressText}</p>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 flex items-start gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-zinc-400 font-medium mb-1">Covered Topics</p>
                    <p className="text-4xl font-bold text-emerald-400">{coveredCount}</p>
                  </div>
                </div>
                <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 flex items-start gap-4">
                  <div className="p-3 bg-rose-500/10 rounded-xl">
                    <XCircle className="w-8 h-8 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-zinc-400 font-medium mb-1">Missing Topics</p>
                    <p className="text-4xl font-bold text-rose-400">{missingCount}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-6 border-b border-white/10">
                  {(['all', 'missing', 'covered'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "relative pb-4 text-sm font-medium transition-colors capitalize",
                        activeTab === tab ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {tab}
                      {activeTab === tab && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {filteredResults.map((result, idx) => {
                    const isExpanded = expandedTopics.has(result.topic);
                    return (
                      <div
                        key={idx}
                        className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleTopic(result.topic)}
                          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="flex items-center gap-4">
                            {result.isCovered ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                            )}
                            <span className="font-medium text-zinc-200">{result.topic}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            {result.isCovered && result.pageNumbers && (
                              <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium whitespace-nowrap">
                                {result.pageNumbers}
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-zinc-500" />
                            )}
                          </div>
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 pt-0 border-t border-white/5 text-zinc-400 text-sm leading-relaxed">
                                {result.evidence}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                  {filteredResults.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                      No topics found for this filter.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
