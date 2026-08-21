const API_KEY = "YOUR_GEMINI_API_KEY"; // 1. GET A FREE KEY FROM: https://aistudio.google.com/app/apikey

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`;

const systemPrompt = `You are a multilingual dictionary API. You MUST output ONLY valid JSON in this exact structure:
{
  "word": "<word>",
  "context_sentence": "<sentence>",
  "english": { "definition": "...", "synonyms": ["..."] },
  "tagalog": { "definition": "...", "synonyms": ["..."], "example_sentence": "..." },
  "bisaya": { "definition": "...", "synonyms": ["..."], "example_sentence": "..." }
}
You must ALWAYS provide all 3 language translations accurately.
CRITICAL: The 'example_sentence' for Tagalog and Bisaya MUST be a rich, highly accurate, and detailed translation that perfectly matches the meaning and context of the original English context_sentence.`;

const prompt = `Define the word "Supplementary" in the context of this sentence: "Please provide supplementary documents to support your application.". Please generate the output in Tagalog.`;

async function testGemini() {
  if (API_KEY === "YOUR_GEMINI_API_KEY") {
    console.error("❌ ERROR: Please paste your Gemini API key on line 1.");
    return;
  }

  console.log("Sending request to Google AI Studio (Gemini 2.5 Flash)...\n");

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // This forces Gemini to strictly output JSON matching our structure!
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("API Error:", data.error.message);
      return;
    }

    const jsonOutput = data.candidates[0].content.parts[0].text;
    console.log("✅ Success! Here is Gemini's output:\n");

    // Parse and stringify to format the JSON beautifully in the console
    console.log(JSON.stringify(JSON.parse(jsonOutput), null, 4));

  } catch (err) {
    console.error("Network or parsing error:", err);
  }
}

testGemini();
