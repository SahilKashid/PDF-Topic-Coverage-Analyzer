import { GoogleGenAI, Type } from "@google/genai";
import { PDFPageImage } from "./pdf";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-flash-latest";

export interface TopicCoverage {
  topic: string;
  isCovered: boolean;
  evidence: string;
  pageNumbers: string;
}

export async function extractTextFromNotes(images: PDFPageImage[], onProgress?: (status: string) => void): Promise<string> {
  let fullText = "";
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const end = Math.min(i + BATCH_SIZE, images.length);
    const batch = images.slice(i, end);
    
    if (onProgress) {
      onProgress(`Extracting text from Notes PDF (Pages ${batch[0].pageNumber}-${batch[batch.length - 1].pageNumber})...`);
    }

    const parts = batch.map(img => ({
      inlineData: {
        data: img.base64,
        mimeType: "image/jpeg"
      }
    }));

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: {
        parts: [
          ...parts,
          { text: "Extract all text accurately from these pages. Explicitly start the transcription of each page with exactly '--- Page X ---' (where X is the page number)." }
        ]
      }
    });
    
    fullText += response.text + "\n\n";
  }
  
  return fullText;
}

export async function extractTopicsFromPDF(images: PDFPageImage[], onProgress?: (status: string) => void): Promise<string[]> {
  let fullText = "";
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const end = Math.min(i + BATCH_SIZE, images.length);
    const batch = images.slice(i, end);
    
    if (onProgress) {
      onProgress(`Extracting topics from Topics PDF (Pages ${batch[0].pageNumber}-${batch[batch.length - 1].pageNumber})...`);
    }

    const parts = batch.map(img => ({
      inlineData: {
        data: img.base64,
        mimeType: "image/jpeg"
      }
    }));

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: {
        parts: [
          ...parts,
          { text: "Extract a comprehensive list of topics, concepts, or questions from these pages. Return ONLY a JSON array of strings representing the topics. Do not include any markdown formatting or other text." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    
    try {
      const topics = JSON.parse(response.text || "[]");
      fullText += topics.join("\n") + "\n";
    } catch (e) {
      console.error("Failed to parse topics JSON", e);
    }
  }
  
  const allTopics = fullText.split("\n").map(t => t.trim()).filter(t => t.length > 0);
  return Array.from(new Set(allTopics));
}

export async function analyzeCoverage(notesText: string, topics: string[], onProgress?: (status: string) => void): Promise<TopicCoverage[]> {
  const CHUNK_SIZE = 20;
  const results: TopicCoverage[] = [];
  
  const totalChunks = Math.ceil(topics.length / CHUNK_SIZE);
  
  for (let i = 0; i < topics.length; i += CHUNK_SIZE) {
    const chunk = topics.slice(i, i + CHUNK_SIZE);
    const currentChunk = Math.floor(i / CHUNK_SIZE) + 1;
    
    if (onProgress) {
      onProgress(`Analyzing coverage (Batch ${currentChunk} of ${totalChunks})...`);
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `You are an expert academic assistant. I will provide you with the full text of my study notes, and a list of topics to check for coverage.
      
Notes Text:
${notesText}

Topics to check:
${JSON.stringify(chunk)}

Determine exactly which topics are covered in the notes and which are missing.

CRITICAL INSTRUCTION: A topic should ONLY be considered 'covered' (isCovered: true) if it is present as a full topic in the notes (e.g., it has its own heading, dedicated section, or substantial detailed explanation). Do NOT mark a topic as covered if it is only mentioned in passing, briefly described, or referenced as a minor detail within another topic.

Return a JSON array of objects with this exact structure:
- topic (string)
- isCovered (boolean)
- evidence (string: brief quote or explanation of coverage/missing status)
- pageNumbers (string: e.g., "Page 4", or empty if missing)
`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              isCovered: { type: Type.BOOLEAN },
              evidence: { type: Type.STRING },
              pageNumbers: { type: Type.STRING }
            },
            required: ["topic", "isCovered", "evidence", "pageNumbers"]
          }
        }
      }
    });
    
    try {
      const chunkResults = JSON.parse(response.text || "[]");
      results.push(...chunkResults);
    } catch (e) {
      console.error("Failed to parse coverage JSON", e);
    }
  }
  
  return results;
}
