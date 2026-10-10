import { LLMResponse } from "@/utils/llm";
import {
  findEntriesContainingWord,
  findEntryForTap,
  termKey,
  tokenSimilarity,
} from "@/utils/phrase-match";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
export interface BoundingBoxItem {
  id?: string;
  text: string;
  sentence?: string; // the whole text block around the word
  line?: string; // the single line of text the word is on
  occurrence?: number; // 0 = first time this word appears on its line, 1 = second, ...
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HarvestedWord {
  text: string;
  sentence?: string;
  line?: string;
  occurrence?: number;
}

export interface RecentForm {
  id: string;
  title: string;
  dateStr: string;
  thumbnailUri: string;
  words: Array<HarvestedWord | string>;
  // Which supported form this scan is: a form id, "none" if the user said it is not one
  // of them, or empty when not decided yet (the app then works it out again).
  formId?: string | null;
}

const STORAGE_KEY = "@govform_recent_scans";

export const saveRecentForm = async (
  originalUri: string,
  boundingBoxes: BoundingBoxItem[],
  formId?: string | null,
) => {
  try {
    // 1. Copy image to a permanent document directory so it doesn't get cleared by the OS
    const fileName = originalUri.split("/").pop() || `scan_${Date.now()}.jpg`;
    const permanentUri = FileSystem.documentDirectory + fileName;

    await FileSystem.copyAsync({
      from: originalUri,
      to: permanentUri,
    });

    // 2. Harvest just the words and their context sentences
    const words: HarvestedWord[] = boundingBoxes.map((box) => ({
      text: box.text,
      sentence: box.sentence,
      line: box.line,
      occurrence: box.occurrence,
    }));

    // 3. Create the record
    const newRecord: RecentForm = {
      id: Date.now().toString(),
      title: `Scanned Document - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      dateStr: new Date().toLocaleString(),
      thumbnailUri: permanentUri,
      words,
      formId: formId ?? null,
    };

    // 4. Save to AsyncStorage
    const existingStr = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: RecentForm[] = existingStr ? JSON.parse(existingStr) : [];

    // Add to beginning of array (most recent first)
    existing.unshift(newRecord);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    return newRecord;
  } catch (error) {
    console.error("Error saving recent form:", error);
    throw error;
  }
};

// Saves the form the user picked for a scan (null = "not one of the supported forms").
export const updateRecentFormId = async (
  id: string,
  formId: string | null,
): Promise<boolean> => {
  try {
    const str = await AsyncStorage.getItem(STORAGE_KEY);
    const list: RecentForm[] = str ? JSON.parse(str) : [];
    const record = list.find((r) => r.id === id);
    if (!record) return false;
    record.formId = formId ?? "none";
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    console.error("Error updating the form of a saved scan:", error);
    return false;
  }
};

export const getRecentForms = async (): Promise<RecentForm[]> => {
  try {
    const dataStr = await AsyncStorage.getItem(STORAGE_KEY);
    return dataStr ? JSON.parse(dataStr) : [];
  } catch (error) {
    console.error("Error getting recent forms:", error);
    return [];
  }
};

export const getRecentFormById = async (
  id: string,
): Promise<RecentForm | null> => {
  try {
    const forms = await getRecentForms();
    return forms.find((f) => f.id === id) || null;
  } catch (error) {
    console.error("Error getting recent form by id:", error);
    return null;
  }
};

export const deleteRecentForm = async (id: string, thumbnailUri: string) => {
  try {
    // 1. Remove from AsyncStorage
    const existingStr = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingStr) return;

    const existing: RecentForm[] = JSON.parse(existingStr);
    const filtered = existing.filter((form) => form.id !== id);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    // 2. Delete the physical image file to save storage
    await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
  } catch (error) {
    console.error("Error deleting recent form:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Dictionary cache
// ---------------------------------------------------------------------------
// Answers are saved per PHRASE (e.g. "Date of Birth"), not per single word, so
// "Date" on "Date of Birth" and "Date" on "Date of Issue" get different answers.
// v3: phrase-based format. Older caches (v1, v2) were per word and are ignored.
const DICT_CACHE_KEY = "@govform_dict_cache_v3";
const MAX_CACHE_ENTRIES = 1000;

interface DictCacheEntry {
  term: string;
  result: LLMResponse;
  savedAt: number;
}
type DictCache = Record<string, DictCacheEntry>;

const readDictCache = async (): Promise<DictCache> => {
  try {
    const str = await AsyncStorage.getItem(DICT_CACHE_KEY);
    if (!str) return {};
    const parsed = JSON.parse(str);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Error reading dict cache:", error);
    return {};
  }
};

// Saves an answer under its phrase (response.term, or the tapped word if missing).
export const saveWordDefinition = async (
  word: string,
  response: LLMResponse,
) => {
  try {
    const term =
      typeof response.term === "string" && response.term.trim() !== ""
        ? response.term.trim()
        : word.trim();
    const key = termKey(term);
    if (!key) return;

    const cache = await readDictCache();
    cache[key] = { term, result: response, savedAt: Date.now() };

    // Keep the cache from growing forever: drop the oldest entries.
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys
        .sort((a, b) => (cache[a].savedAt ?? 0) - (cache[b].savedAt ?? 0))
        .slice(0, keys.length - MAX_CACHE_ENTRIES)
        .forEach((k) => delete cache[k]);
    }

    await AsyncStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Error saving word to dict cache:", error);
  }
};

// Finds a saved answer whose phrase appears in this line AND includes the tapped word.
// `line` is the line of text the word is on (falls back to the word itself).
export const getCachedWordDefinition = async (
  word: string,
  line?: string,
  occurrence: number = 0,
): Promise<LLMResponse | null> => {
  try {
    const entries = Object.values(await readDictCache());
    const hit = findEntryForTap(
      entries,
      word,
      line && line.trim() ? line : word,
      occurrence,
    );
    return hit ? hit.result : null;
  } catch (error) {
    console.error("Error getting word from dict cache:", error);
    return null;
  }
};

// Offline fallback: saved answers whose phrase contains this word, newest first.
// These may come from a different form, so the app shows them with a notice.
export const getApproximateDefinitions = async (
  word: string,
): Promise<LLMResponse[]> => {
  try {
    const entries = Object.values(await readDictCache());
    return findEntriesContainingWord(entries, word)
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
      .map((e) => e.result);
  } catch (error) {
    console.error("Error reading approximate definitions:", error);
    return [];
  }
};

// ---------------------------------------------------------------------------
// Sentence meaning cache ("Explain this sentence")
// ---------------------------------------------------------------------------
// Saved per piece of form text, per language. Text is matched by word overlap
// (at least 90% alike), so a rescan with a small OCR mistake still finds it, but a
// sentence that differs in a real word does not reuse the wrong meaning.
const SENTENCE_CACHE_KEY = "@govform_sentence_cache_v1";
const MAX_SENTENCE_ENTRIES = 300;
const SENTENCE_MATCH_THRESHOLD = 0.9;

interface SentenceCacheEntry {
  text: string;
  meanings: Record<string, string>; // language -> plain-language meaning
  savedAt: number;
}

const readSentenceCache = async (): Promise<SentenceCacheEntry[]> => {
  try {
    const str = await AsyncStorage.getItem(SENTENCE_CACHE_KEY);
    if (!str) return [];
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error reading sentence cache:", error);
    return [];
  }
};

const findSentenceEntry = (
  entries: SentenceCacheEntry[],
  text: string,
): SentenceCacheEntry | undefined => {
  let best: SentenceCacheEntry | undefined;
  let bestScore = 0;
  for (const entry of entries) {
    const score = tokenSimilarity(entry.text, text);
    if (score >= SENTENCE_MATCH_THRESHOLD && score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
};

export const getCachedSentenceMeaning = async (
  text: string,
  language: string,
): Promise<string | null> => {
  try {
    const entry = findSentenceEntry(await readSentenceCache(), text);
    const meaning = entry?.meanings?.[language];
    return typeof meaning === "string" && meaning.trim() !== ""
      ? meaning
      : null;
  } catch (error) {
    console.error("Error getting sentence meaning from cache:", error);
    return null;
  }
};

export const saveSentenceMeaning = async (
  text: string,
  language: string,
  meaning: string,
) => {
  try {
    const entries = await readSentenceCache();
    const existing = findSentenceEntry(entries, text);
    if (existing) {
      existing.meanings = { ...existing.meanings, [language]: meaning };
      existing.savedAt = Date.now();
    } else {
      entries.push({
        text,
        meanings: { [language]: meaning },
        savedAt: Date.now(),
      });
    }

    // Keep the cache from growing forever: drop the oldest entries.
    entries.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
    await AsyncStorage.setItem(
      SENTENCE_CACHE_KEY,
      JSON.stringify(entries.slice(0, MAX_SENTENCE_ENTRIES)),
    );
  } catch (error) {
    console.error("Error saving sentence meaning to cache:", error);
  }
};
