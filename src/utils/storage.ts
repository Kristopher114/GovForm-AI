import { LLMResponse } from "@/utils/llm";
import {
  findEntriesContainingWord,
  findEntryForTap,
  termKey,
  tokenSimilarity,
} from "@/utils/phrase-match";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { getFormDisplayName } from "@/utils/classification";
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

// ---------------------------------------------------------------------------
// Recent scans
// ---------------------------------------------------------------------------
// Each scan is saved under its OWN key, plus a small index (list of ids).
// The old version kept every scan in ONE big list. Each scan stores hundreds of
// words with their sentences, so after enough scans that single value could grow
// past what Android can read back in one go (~2 MB per row). Reading then failed,
// the Recents tab showed nothing, and new saves failed too.
const LEGACY_STORAGE_KEY = "@govform_recent_scans";
const INDEX_KEY = "@govform_recent_index_v2";
const recordKey = (id: string) => `@govform_recent_scan_v2_${id}`;
const MAX_RECENTS = 50; // oldest scans are removed after this
const MAX_CONTEXT_CHARS = 400; // keeps one saved scan small

const readIndex = async (): Promise<string[]> => {
  try {
    const str = await AsyncStorage.getItem(INDEX_KEY);
    const parsed = str ? JSON.parse(str) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch (error) {
    console.error("Error reading recent scans index:", error);
    return [];
  }
};

const writeIndex = (ids: string[]) =>
  AsyncStorage.setItem(INDEX_KEY, JSON.stringify(ids));

const readRecord = async (id: string): Promise<RecentForm | null> => {
  try {
    const str = await AsyncStorage.getItem(recordKey(id));
    return str ? (JSON.parse(str) as RecentForm) : null;
  } catch (error) {
    console.error(`Error reading recent scan ${id}:`, error);
    return null;
  }
};

// Moves scans saved by the old single-list version into the new format (once).
// The old key is only removed after everything was copied successfully.
let legacyChecked = false;
const migrateLegacyRecents = async () => {
  if (legacyChecked) return;
  legacyChecked = true;
  try {
    const str = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!str) return;
    const legacy = JSON.parse(str);
    if (!Array.isArray(legacy)) return;

    const ids = await readIndex();
    const known = new Set(ids);
    const toMove = (legacy as RecentForm[]).filter(
      (f) => f && f.id != null && !known.has(String(f.id)),
    );
    for (const form of toMove) {
      form.id = String(form.id);
      await AsyncStorage.setItem(recordKey(form.id), JSON.stringify(form));
    }
    const merged = [...ids, ...toMove.map((f) => String(f.id))].sort(
      (a, b) => Number(b) - Number(a),
    );
    await writeIndex(merged);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    console.log(`Moved ${toMove.length} recent scans to the new storage format.`);
  } catch (error) {
    // Usually means the old list is too big to read. It is left untouched.
    console.warn("Could not read the old recent scans list:", error);
  }
};

const trimContext = (text?: string) =>
  text && text.length > MAX_CONTEXT_CHARS
    ? text.slice(0, MAX_CONTEXT_CHARS)
    : text;

// Copies the photo into the app's permanent folder under a unique name, so two
// scans never share (and overwrite) the same thumbnail file.
const copyToPermanentStorage = async (originalUri: string): Promise<string> => {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) return originalUri;
  const ext = originalUri.split("?")[0].split(".").pop()?.toLowerCase();
  const cleanExt =
    ext && ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const target = `${docDir}scan_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}.${cleanExt}`;
  try {
    await FileSystem.copyAsync({ from: originalUri, to: target });
    return target;
  } catch (copyErr) {
    // The scan is still saved; only the thumbnail may disappear later.
    console.warn("Could not copy the scan photo, using the original:", copyErr);
    return originalUri;
  }
};

// formId: the detected form id (e.g. "philhealth-pmrf"), or null/undefined if unknown.
export const saveRecentForm = async (
  originalUri: string,
  boundingBoxes: BoundingBoxItem[],
  formId?: string | null,
) => {
  try {
    await migrateLegacyRecents();

    const thumbnailUri = await copyToPermanentStorage(originalUri);

    const words: HarvestedWord[] = (boundingBoxes || []).map((box) => ({
      text: box.text,
      sentence: trimContext(box.sentence),
      line: trimContext(box.line),
      occurrence: box.occurrence,
    }));

    const cleanFormId = formId && formId !== "UNKNOWN" ? formId : null;

    let dateLabel = "Today";
    try {
      dateLabel = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      const d = new Date();
      dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    }

    let dateStr = new Date().toISOString();
    try {
      dateStr = new Date().toLocaleString();
    } catch {}

    const newRecord: RecentForm = {
      id: Date.now().toString(),
      title: cleanFormId
        ? getFormDisplayName(cleanFormId)
        : `Scanned Document - ${dateLabel}`,
      dateStr,
      thumbnailUri,
      words,
      formId: cleanFormId,
    };

    await AsyncStorage.setItem(
      recordKey(newRecord.id),
      JSON.stringify(newRecord),
    );

    const existingIds = await readIndex();
    const ids = [newRecord.id, ...existingIds.filter((id) => id !== newRecord.id)];
    const kept = ids.slice(0, MAX_RECENTS);
    await writeIndex(kept);

    // Remove scans that fell off the end of the history.
    for (const oldId of ids.slice(MAX_RECENTS)) {
      const old = await readRecord(oldId);
      await AsyncStorage.removeItem(recordKey(oldId));
      if (old?.thumbnailUri?.startsWith(FileSystem.documentDirectory ?? "\u0000")) {
        await FileSystem.deleteAsync(old.thumbnailUri, { idempotent: true });
      }
    }

    console.log(`Saved recent scan "${newRecord.title}" (${words.length} words).`);
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
    await migrateLegacyRecents();
    const record = await readRecord(id);
    if (!record) return false;
    record.formId = formId ?? "none";
    await AsyncStorage.setItem(recordKey(id), JSON.stringify(record));
    return true;
  } catch (error) {
    console.error("Error updating the form of a saved scan:", error);
    return false;
  }
};

export const getRecentForms = async (): Promise<RecentForm[]> => {
  try {
    await migrateLegacyRecents();
    const ids = await readIndex();
    const records = await Promise.all(ids.map((id) => readRecord(id)));
    return records.filter((r): r is RecentForm => r !== null && !!r.id);
  } catch (error) {
    console.error("Error getting recent forms:", error);
    return [];
  }
};

export const getRecentFormById = async (
  id: string,
): Promise<RecentForm | null> => {
  await migrateLegacyRecents();
  return readRecord(id);
};

export const deleteRecentForm = async (id: string, thumbnailUri: string) => {
  try {
    const ids = await readIndex();
    await writeIndex(ids.filter((existingId) => existingId !== id));
    await AsyncStorage.removeItem(recordKey(id));

    // Only delete photos the app owns (never the user's gallery original).
    if (thumbnailUri?.startsWith(FileSystem.documentDirectory ?? "\u0000")) {
      await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
    }
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
