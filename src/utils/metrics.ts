// Optional "research mode" for testers.
//
// When switched on (Settings), the app records, ON THIS PHONE ONLY, how long
// lookups and scans take, where each answer came from (dictionary, saved answer,
// AI) and the tester's thumbs up/down ratings. Nothing is sent anywhere: the
// results stay on the phone until the researcher exports them as a CSV file.
// When research mode is off (the default) nothing at all is recorded.
import AsyncStorage from "@react-native-async-storage/async-storage";

const ENABLED_KEY = "@govform_research_enabled";
const EVENTS_KEY = "@govform_research_events_v1";
export const MAX_EVENTS = 1500; // oldest events are dropped beyond this

export interface ResearchEvent {
  time: string; // ISO date and time
  event: string; // lookup | scan | scan_rejected | scan_error | sentence | rating
  language?: string;
  source?: string; // dictionary | cache | cache_approx | ai | error | mlkit | desktop
  term?: string; // the tapped word / phrase (lookups and ratings only)
  ms?: number; // how long it took
  value?: string; // rating (up/down), number of boxes, blur score...
  detail?: string; // extra info such as an error code
}

const SHOW_DRAFTS_KEY = "@govform_show_draft_summaries";
let enabledCache: boolean | null = null;
let showDraftsCache: boolean | null = null;
let queue: Promise<unknown> = Promise.resolve();

export const isResearchEnabled = async (): Promise<boolean> => {
  if (enabledCache !== null) return enabledCache;
  try {
    enabledCache = (await AsyncStorage.getItem(ENABLED_KEY)) === "true";
  } catch {
    enabledCache = false;
  }
  return enabledCache;
};

export const setResearchEnabled = async (value: boolean): Promise<void> => {
  enabledCache = value;
  try {
    await AsyncStorage.setItem(ENABLED_KEY, value ? "true" : "false");
  } catch (error) {
    console.log("Could not save research mode setting:", error);
  }
};

const readEvents = async (): Promise<ResearchEvent[]> => {
  try {
    const str = await AsyncStorage.getItem(EVENTS_KEY);
    if (!str) return [];
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // damaged data: start fresh
  }
};

// Records one event if research mode is on. Fire and forget: never throws and
// never slows the app down. Events are written one at a time so none are lost.
export const logEvent = (event: Omit<ResearchEvent, "time">): void => {
  queue = queue
    .then(async () => {
      if (!(await isResearchEnabled())) return;
      const events = await readEvents();
      events.push({
        time: new Date().toISOString(),
        ...event,
        term: event.term ? event.term.slice(0, 120) : undefined,
      });
      await AsyncStorage.setItem(
        EVENTS_KEY,
        JSON.stringify(events.slice(-MAX_EVENTS)),
      );
    })
    .catch((error) => console.log("Research log failed:", error));
};

// Waits until every event logged so far has been written (used by tests / export).
export const flushEvents = (): Promise<unknown> => queue;

export const clearEvents = async (): Promise<void> => {
  await flushEvents();
  try {
    await AsyncStorage.removeItem(EVENTS_KEY);
  } catch (error) {
    console.log("Could not clear research results:", error);
  }
};

// One CSV cell. Quotes values that need it, and neutralizes values that a
// spreadsheet could run as a formula (OCR text can start with "=", "+", "-", "@").
const cell = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};

const COLUMNS: (keyof ResearchEvent)[] = [
  "time",
  "event",
  "language",
  "source",
  "term",
  "ms",
  "value",
  "detail",
];

export const getEventsCsv = async (): Promise<string> => {
  await flushEvents();
  const events = await readEvents();
  const lines = [COLUMNS.join(",")];
  for (const e of events) lines.push(COLUMNS.map((c) => cell(e[c])).join(","));
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Quick summary shown in Settings
// ---------------------------------------------------------------------------

export interface ResearchSummary {
  total: number;
  lookups: number;
  bySource: Record<string, number>;
  medianLookupMs: number | null;
  medianLookupMsBySource: Record<string, number>;
  scans: number;
  medianScanMs: number | null;
  up: number;
  down: number;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export const summarizeEvents = (events: ResearchEvent[]): ResearchSummary => {
  const lookups = events.filter((e) => e.event === "lookup");
  const scans = events.filter((e) => e.event === "scan");
  const ratings = events.filter((e) => e.event === "rating");

  const bySource: Record<string, number> = {};
  const msBySource: Record<string, number[]> = {};
  for (const e of lookups) {
    const s = e.source ?? "unknown";
    bySource[s] = (bySource[s] ?? 0) + 1;
    if (typeof e.ms === "number")
      (msBySource[s] = msBySource[s] ?? []).push(e.ms);
  }
  const medianLookupMsBySource: Record<string, number> = {};
  for (const [s, list] of Object.entries(msBySource)) {
    const m = median(list);
    if (m !== null) medianLookupMsBySource[s] = m;
  }

  return {
    total: events.length,
    lookups: lookups.length,
    bySource,
    medianLookupMs: median(
      lookups
        .filter((e) => typeof e.ms === "number")
        .map((e) => e.ms as number),
    ),
    medianLookupMsBySource,
    scans: scans.length,
    medianScanMs: median(
      scans.filter((e) => typeof e.ms === "number").map((e) => e.ms as number),
    ),
    up: ratings.filter((e) => e.value === "up").length,
    down: ratings.filter((e) => e.value === "down").length,
  };
};

export const getResearchSummary = async (): Promise<ResearchSummary> => {
  await flushEvents();
  return summarizeEvents(await readEvents());
};

// Short readable lines for the Settings screen.
export const summaryLines = (sm: ResearchSummary): string[] => {
  const label: Record<string, string> = {
    dictionary: "dictionary",
    cache: "saved",
    cache_approx: "saved (other form)",
    ai: "AI",
    error: "errors",
  };
  const parts = Object.entries(sm.bySource).map(
    ([k, v]) => `${label[k] ?? k} ${v}`,
  );
  const times = Object.entries(sm.medianLookupMsBySource).map(
    ([k, v]) => `${label[k] ?? k} ${v} ms`,
  );

  const lines = [
    `Lookups: ${sm.lookups}${parts.length ? ` (${parts.join(", ")})` : ""}`,
  ];
  if (times.length) lines.push(`Median lookup time: ${times.join(", ")}`);
  lines.push(
    `Scans: ${sm.scans}${sm.medianScanMs !== null ? `, median ${sm.medianScanMs} ms` : ""}`,
  );
  lines.push(`Ratings: ${sm.up} helpful, ${sm.down} not helpful`);
  return lines;
};

// ---------------------------------------------------------------------------
// "Show draft form summaries" (testers only)
// ---------------------------------------------------------------------------
// Form summaries are shown to normal users only after they are approved. Testers can
// switch this on (it needs research mode too) to see the drafts, marked as DRAFT.
export const isShowDraftsEnabled = async (): Promise<boolean> => {
  if (showDraftsCache !== null) return showDraftsCache;
  try {
    showDraftsCache = (await AsyncStorage.getItem(SHOW_DRAFTS_KEY)) === "true";
  } catch {
    showDraftsCache = false;
  }
  return showDraftsCache;
};

export const setShowDraftsEnabled = async (value: boolean): Promise<void> => {
  showDraftsCache = value;
  try {
    await AsyncStorage.setItem(SHOW_DRAFTS_KEY, value ? "true" : "false");
  } catch (error) {
    console.log("Could not save the draft summaries setting:", error);
  }
};

export const canShowDraftSummaries = async (): Promise<boolean> =>
  (await isResearchEnabled()) && (await isShowDraftsEnabled());
