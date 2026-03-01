'use client';

import React, { useCallback, useState } from 'react';
import { UploadCloud, File, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  label: string;
  description?: string;
  file: File | null;
}

export function FileUpload({ onFileSelect, accept = '.pdf', label, description, file }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile.name.toLowerCase().endsWith('.pdf')) {
          onFileSelect(droppedFile);
        } else {
          alert('Please upload a PDF file.');
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileSelect(e.target.files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center w-full h-48 border border-dashed rounded-2xl transition-all duration-300',
        isDragging
          ? 'border-white/40 bg-white/5'
          : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700',
        file ? 'border-zinc-700 bg-zinc-900' : ''
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {file ? (
        <div className="flex flex-col items-center justify-center space-y-4 p-4 text-center">
          <div className="p-3 bg-zinc-800 text-white rounded-full">
            <File className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">
              {file.name}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFileSelect(null);
            }}
            className="absolute top-3 right-3 p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4 p-4 text-center pointer-events-none">
          <div className="p-3 bg-zinc-900 text-zinc-400 rounded-full border border-zinc-800">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300">{label}</p>
            {description && (
              <p className="text-xs text-zinc-500 mt-1.5">{description}</p>
            )}
          </div>
        </div>
      )}
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={!!file}
      />
    </div>
  );
}
