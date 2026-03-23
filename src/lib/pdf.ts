import * as pdfjsLib from 'pdfjs-dist';

// CRITICAL WORKAROUND: To avoid build issues with Web Workers, dynamically set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export interface PDFPageImage {
  pageNumber: number;
  base64: string;
}

export async function extractImagesFromPDF(file: File, onProgress?: (progress: number) => void): Promise<PDFPageImage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const images: PDFPageImage[] = [];

  const BATCH_SIZE = 10;
  
  for (let i = 1; i <= numPages; i += BATCH_SIZE) {
    const batchPromises = [];
    const end = Math.min(i + BATCH_SIZE - 1, numPages);
    
    for (let j = i; j <= end; j++) {
      batchPromises.push(
        (async () => {
          const page = await pdf.getPage(j);
          const viewport = page.getViewport({ scale: 1.5 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) throw new Error('Could not create canvas context');
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          } as any).promise;
          
          // Convert to JPEG base64 with quality 0.6
          const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
          return { pageNumber: j, base64 };
        })()
      );
    }
    
    const batchResults = await Promise.all(batchPromises);
    images.push(...batchResults);
    
    if (onProgress) {
      onProgress(Math.round((end / numPages) * 100));
    }
  }
  
  return images.sort((a, b) => a.pageNumber - b.pageNumber);
}
