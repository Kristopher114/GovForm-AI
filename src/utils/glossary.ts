// The bundled Bisaya dictionary: human-written definitions for the terms found on
// the supported government forms. Used before asking the AI, for Bisaya only.
import dictionaryData from "@/data/bisaya-dictionary.json";
import type { LLMResponse } from "@/utils/llm";
import {
  findDictionaryMatch,
  IndexedTerm,
  indexTerms,
} from "@/utils/phrase-match";

interface DictionaryEntry {
  word: string;
  bisaya_definition: string;
  bisaya_example_sentence: string;
  bisaya_synonyms: string[];
  sample_data: string;
}

// Terms that show up all over forms with different meanings. They only count as a
// match when they are the WHOLE line (e.g. a line that says just "Date"), so a
// generic answer is never forced onto "Date of Entry" or the abbreviation "No."
export const GENERIC_TERMS = new Set([
  "yes",
  "no",
  "to",
  "name",
  "number",
  "status",
  "type",
  "form",
  "information",
  "person",
  "place",
  "contact",
  "date",
  "applicant",
  "applicants",
  "application",
  "registration",
  "certificate",
  "identification",
  "part 2",
  "part 3",
]);

let cachedIndex: IndexedTerm<DictionaryEntry>[] | null = null;

const getIndex = (): IndexedTerm<DictionaryEntry>[] => {
  if (!cachedIndex) {
    const entries = (dictionaryData as DictionaryEntry[]).filter(
      (e) =>
        typeof e?.word === "string" &&
        typeof e?.bisaya_definition === "string" &&
        e.bisaya_definition.trim() !== "",
    );
    cachedIndex = indexTerms(entries, (e) => e.word, GENERIC_TERMS);
  }
  return cachedIndex;
};

// Looks up the tapped word in the dictionary. Returns a result in the same shape
// as an AI answer (so the screen can show it the same way), or null when the term
// is not in the dictionary. The dictionary is Bisaya only: other languages get null.
export const lookupDictionary = (
  word: string,
  line: string | undefined,
  occurrence: number,
  block: string | undefined,
  language: string,
): LLMResponse | null => {
  if (language !== "Cebuano") return null;

  const entry = findDictionaryMatch(
    getIndex(),
    word,
    line && line.trim() ? line : word,
    occurrence,
    block,
  );
  if (!entry) return null;

  return {
    word,
    term: entry.word,
    source: "dictionary",
    bisaya: {
      definition: entry.bisaya_definition.trim(),
      example_sentence: (entry.bisaya_example_sentence ?? "").trim(),
      synonyms: Array.isArray(entry.bisaya_synonyms)
        ? entry.bisaya_synonyms.filter(
            (s) => typeof s === "string" && s.trim() !== "",
          )
        : [],
    },
    sample_data: (entry.sample_data ?? "").trim(),
  };
};
