export interface LanguageDefinition {
  definition: string;
  synonyms: string[];
  example_sentence?: string;
}

export interface LLMResponse {
  word?: string;
  context_sentence?: string;
  english?: LanguageDefinition;
  tagalog?: LanguageDefinition;
  bisaya?: LanguageDefinition;
  [key: string]: any; // Allow fallback keys
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

export const defineWordWithLLM = async (word: string, sentence?: string, language: string = 'English'): Promise<LLMResponse> => {
  const prompt = sentence
    ? `Define the word "${word}" in the context of this sentence: "${sentence}". Please generate the output in ${language}.`
    : `Define the word "${word}". Please generate the output in ${language}.`;

  const systemPrompt = `You are a multilingual dictionary API. You MUST output ONLY valid JSON in this exact structure:
{
  "word": "<word>",
  "context_sentence": "<sentence>",
  "english": { "definition": "...", "synonyms": ["..."] },
  "tagalog": { "definition": "...", "synonyms": ["..."], "example_sentence": "..." },
  "bisaya": { "definition": "...", "synonyms": ["..."], "example_sentence": "..." }
}
You must ALWAYS provide all 3 language translations (English, Tagalog, and Bisaya) accurately.
CRITICAL: The 'example_sentence' for Tagalog and Bisaya MUST be a natural, conversational, and everyday-spoken translation that perfectly matches the meaning of the original English context_sentence. Avoid overly formal or deep words—write it exactly how a native speaker would casually say it in real life.`;

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("Missing EXPO_PUBLIC_GEMINI_API_KEY in .env");
    }

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error Body:", errorText);
      throw new Error(`Gemini API returned status ${response.status}. Details: ${errorText}`);
    }

    const data = await response.json();
    
    if (data.error) {
       throw new Error(data.error.message);
    }

    const jsonOutput = data.candidates[0].content.parts[0].text;

    try {
      const parsedData: LLMResponse = JSON.parse(jsonOutput);
      return parsedData;
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini:', jsonOutput);
      throw new Error('Gemini did not return valid JSON format.');
    }

  } catch (error) {
    console.error('Error connecting to Gemini API:', error);
    throw error;
  }
};
