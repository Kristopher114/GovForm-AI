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

// Windows Mobile Hotspot default IP is usually 192.168.137.1.
// If your phone cannot connect, check your laptop's IP address (ipconfig in cmd)
// and update this constant.
const OLLAMA_URL = 'http://192.168.137.1:11434/api/generate';
const MODEL_NAME = 'offline_dict_8b';

export const defineWordWithLLM = async (word: string, sentence?: string, language: string = 'English'): Promise<LLMResponse> => {
  const prompt = sentence 
    ? `Define the word "${word}" in the context of this sentence: "${sentence}". Please generate the output in ${language}.`
    : `Define the word "${word}". Please generate the output in ${language}.`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: prompt,
        format: 'json',
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama server returned status ${response.status}`);
    }

    const data = await response.json();

    // The response is a stringified JSON inside the 'response' property from Ollama
    try {
      const parsedData: LLMResponse = JSON.parse(data.response);
      return parsedData;
    } catch (parseError) {
      console.error('Failed to parse JSON from LLM:', data.response);
      throw new Error('LLM did not return valid JSON format.');
    }

  } catch (error) {
    console.error('Error connecting to local LLM:', error);
    throw error;
  }
};
