import { extractTextFromImages } from './gemini';

export async function extractTextFromPDF(file: File, onProgress?: (msg: string) => void, mode: 'notes' | 'topics' = 'notes'): Promise<string | string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Use UNPKG CDN to load the worker. This avoids Next.js build issues with worker files.
  if (typeof window !== 'undefined' && 'Worker' in window) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  
  // Load the document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  let allTopics: string[] = [];
  const BATCH_SIZE = 10;
  let imageBatch: { base64: string; pageNum: number }[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(`Rendering page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    
    // Lower scale for efficiency (1.5 is good enough for handwriting)
    const viewport = page.getViewport({ scale: 1.5 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      } as any).promise;
      
      // Lower quality JPEG to save bandwidth and processing
      const base64Image = canvas.toDataURL('image/jpeg', 0.6);
      imageBatch.push({ base64: base64Image, pageNum: i });
    }
      
    // Process batch if it reaches BATCH_SIZE or if it's the last page
    if (imageBatch.length === BATCH_SIZE || i === pdf.numPages) {
      if (onProgress) onProgress(`Running AI on pages ${imageBatch[0].pageNum} to ${imageBatch[imageBatch.length - 1].pageNum}...`);
      try {
        const result = await extractTextFromImages(imageBatch, mode);
        if (mode === 'notes') {
          fullText += (result as string) + '\n\n';
        } else {
          allTopics = [...allTopics, ...(result as string[])];
        }
      } catch (err) {
        console.error(`Failed to process batch ending at page ${i}:`, err);
      }
      imageBatch = []; // clear batch
    }
  }
  
  return mode === 'notes' ? fullText : allTopics;
}
