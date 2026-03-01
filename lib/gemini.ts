'use client';

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

export async function extractTextFromImages(
  images: { base64: string; pageNum: number }[],
  mode: 'notes' | 'topics'
): Promise<string | string[]> {
  const parts: any[] = images.map((img) => ({
    inlineData: {
      data: img.base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
      mimeType: "image/jpeg",
    },
  }));

  const pageNumbers = images.map(img => img.pageNum).join(', ');
  
  if (mode === 'notes') {
    const prompt = `Extract all the text from these ${images.length} images accurately. These images represent pages ${pageNumbers} of a document in order.\nIMPORTANT: You MUST start the transcription of EACH image with exactly '--- Page X ---' where X is the corresponding page number. Do not combine pages.`;
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest-preview",
      contents: { parts },
    });

    return response.text || "";
  } else {
    const prompt = `Extract a comprehensive list of topics, concepts, or questions from these ${images.length} images. Return a JSON array of strings. If no clear topics are found, return an empty array.`;
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse topics JSON from images", e);
      return [];
    }
  }
}

export interface CoverageResult {
  topic: string;
  isCovered: boolean;
  evidence: string;
  pageNumbers?: string;
}

export async function analyzeCoverage(
  notesText: string,
  topics: string[]
): Promise<CoverageResult[]> {
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest-preview",
    contents: `You are an expert educational assistant. You are given a notes document and a list of topics.
For each topic in the list, carefully analyze the notes document to determine if the topic is adequately covered.
Return a JSON array of objects with the following structure:
{
  "topic": "The topic name",
  "isCovered": true or false,
  "evidence": "Brief quote or explanation of where it is covered, or why it is missing",
  "pageNumbers": "If covered, list the page number(s) where it is found (e.g., 'Page 4', 'Pages 12-13'). If not covered, return an empty string."
}

Be extremely thorough and do not miss any topics from the provided list.

List of topics:
${JSON.stringify(topics)}

Notes Document:
${notesText}
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: {
              type: Type.STRING,
              description: "The topic being evaluated",
            },
            isCovered: {
              type: Type.BOOLEAN,
              description: "Whether the topic is covered in the notes",
            },
            evidence: {
              type: Type.STRING,
              description: "Brief quote or explanation of where it is covered, or why it is missing",
            },
            pageNumbers: {
              type: Type.STRING,
              description: "The page numbers where the topic is found, if covered.",
            },
          },
          required: ["topic", "isCovered", "evidence"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse coverage JSON", e);
    return [];
  }
}
