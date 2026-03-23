import React, { useCallback, useState } from 'react';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FileUploadProps {
  label: string;
  accept?: string;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

export function FileUpload({ label, accept = "application/pdf", onFileSelect, selectedFile }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === accept) {
        onFileSelect(file);
      }
    }
  }, [accept, onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed transition-colors",
          isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-600",
          selectedFile && "border-emerald-500/50 bg-emerald-500/5"
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        {selectedFile ? (
          <div className="flex flex-col items-center gap-3 text-center p-4">
            <div className="p-3 bg-emerald-500/20 rounded-full">
              <FileIcon className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">{selectedFile.name}</p>
              <p className="text-xs text-zinc-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFileSelect(null); }}
              className="absolute top-3 right-3 p-1.5 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center p-4">
            <div className="p-3 bg-zinc-800 rounded-full">
              <UploadCloud className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">Click or drag PDF here</p>
              <p className="text-xs text-zinc-500 mt-1">Maximum file size 50MB</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
