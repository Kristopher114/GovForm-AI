// Turns the raw ML Kit result into the word boxes the app uses, and decides
// which words are "connected" by looking at WHERE they are on the page.
//
// Two problems this solves:
//  1. Separate fields on one printed row are read by the OCR as ONE line, e.g.
//     "DATE OF   Month   Day   Year". A big gap between words means a new field,
//     so each field becomes its own piece ("segment").
//  2. A label that wraps onto two lines ("DATE OF" / "BIRTH") is read as two
//     separate lines. When a segment ends in a linking word ("of", "for", "ng",
//     "sa", "/"...) and the next piece sits directly below it, lined up, the two
//     are treated as one phrase: "DATE OF BIRTH".
//
// The result keeps the same shape as before: each word box carries `line` (the
// text the phrase detection looks at), `sentence` and `occurrence`. Only what
// goes into `line` changes, so the dictionary / phrase matching code is untouched.
//
// All the numbers that may need adjusting after testing are in LINE_CONTEXT.
import { createOccurrenceCounter, normalizeToken } from "./phrase-match";

export const LINE_CONTEXT = {
  // A horizontal gap wider than this (times the text height) starts a new field.
  // Normal spaces are about 0.3 of the text height; separate fields are 3+.
  gapFactor: 1.5,
  // The next piece may start at most this far below (times the text height).
  maxVerticalGapFactor: 1.0,
  // Lined up = left edges within this many text heights of each other,
  // or the two pieces overlap sideways by at least `minOverlap` of the narrower one.
  alignFactor: 1.0,
  minOverlap: 0.5,
  // Most pieces joined into one phrase ("Date of / Naturalization/ / Reacquisition").
  maxPieces: 3,
};

// A piece is only joined to the next one when it ends in one of these.
// (English, Tagalog, Bisaya)
const CONNECTORS = new Set([
  "of",
  "for",
  "to",
  "and",
  "or",
  "the",
  "in",
  "at",
  "on",
  "by",
  "with",
  "if",
  "as",
  "from",
  "ng",
  "sa",
  "ang",
  "mga",
  "na",
  "para",
  "ug",
  "nga",
  "kang",
  "og",
]);

export interface WordBox {
  text: string;
  sentence: string;
  line: string;
  // Words with the same group number belong to the same field or phrase
  // ("DATE OF" + "BIRTH" share one), even if the OCR read them far apart.
  group: number;
  occurrence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Segment {
  elements: any[];
  text: string;
  frame: Frame | null;
  height: number;
  blockSentence: string;
  next: Segment | null;
  hasPrev: boolean;
  depth: number;
}

const toFrame = (f: any): Frame | null =>
  f &&
  typeof f.left === "number" &&
  typeof f.top === "number" &&
  typeof f.width === "number" &&
  typeof f.height === "number"
    ? { left: f.left, top: f.top, width: f.width, height: f.height }
    : null;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const union = (frames: Frame[]): Frame => {
  const left = Math.min(...frames.map((f) => f.left));
  const top = Math.min(...frames.map((f) => f.top));
  const right = Math.max(...frames.map((f) => f.left + f.width));
  const bottom = Math.max(...frames.map((f) => f.top + f.height));
  return { left, top, width: right - left, height: bottom - top };
};

// Does the text end in a word (or mark) that says "the phrase continues"?
export const endsWithConnector = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed === "") return false;
  if (/[\/\-\u2013\u2014]$/.test(trimmed)) return true;
  const words = trimmed.split(/\s+/);
  const last = normalizeToken(words[words.length - 1]);
  return CONNECTORS.has(last);
};

// Splits one OCR line into pieces wherever the gap between words is large.
const splitLine = (line: any, blockSentence: string): Segment[] => {
  const elements: any[] = line.elements ?? [];
  const frames = elements.map((e) => toFrame(e.frame));

  // Without positions we cannot tell: keep the whole line as before.
  if (frames.some((f) => f === null)) {
    return [
      {
        elements,
        text: line.text,
        frame: toFrame(line.frame),
        height: toFrame(line.frame)?.height ?? 0,
        blockSentence,
        next: null,
        hasPrev: false,
        depth: 1,
      },
    ];
  }

  const items = elements
    .map((element, i) => ({ element, frame: frames[i] as Frame }))
    .sort((a, b) => a.frame.left - b.frame.left);

  const lineHeight = median(items.map((i) => i.frame.height));
  const groups: (typeof items)[] = [];
  let current: typeof items = [];
  items.forEach((item, index) => {
    if (index > 0) {
      const prev = items[index - 1].frame;
      const gap = item.frame.left - (prev.left + prev.width);
      if (gap > LINE_CONTEXT.gapFactor * lineHeight) {
        groups.push(current);
        current = [];
      }
    }
    current.push(item);
  });
  groups.push(current);

  return groups.map((group) => ({
    elements: group.map((g) => g.element),
    // A piece that is the whole line keeps the OCR's own text for the line.
    text:
      groups.length === 1
        ? line.text
        : group.map((g) => g.element.text).join(" "),
    frame: union(group.map((g) => g.frame)),
    height: lineHeight,
    blockSentence,
    next: null,
    hasPrev: false,
    depth: 1,
  }));
};

const isBelowAndAligned = (a: Segment, b: Segment): number | null => {
  if (!a.frame || !b.frame) return null;
  const h = a.height > 0 ? a.height : a.frame.height;
  if (h <= 0) return null;

  // B must sit below A (not on the same row).
  if (b.frame.top < a.frame.top + 0.5 * h) return null;
  const verticalGap = b.frame.top - (a.frame.top + a.frame.height);
  if (verticalGap > LINE_CONTEXT.maxVerticalGapFactor * h) return null;

  const leftDiff = Math.abs(b.frame.left - a.frame.left);
  const overlap =
    Math.min(a.frame.left + a.frame.width, b.frame.left + b.frame.width) -
    Math.max(a.frame.left, b.frame.left);
  const narrower = Math.min(a.frame.width, b.frame.width);
  const lined =
    leftDiff <= LINE_CONTEXT.alignFactor * h ||
    (narrower > 0 && overlap / narrower >= LINE_CONTEXT.minOverlap);
  if (!lined) return null;

  return Math.max(verticalGap, 0) + leftDiff * 0.01; // smaller = closer
};

// Builds the word boxes from ML Kit's `result.blocks`.
export const buildBoxesFromMlKit = (blocks: any[]): WordBox[] => {
  type Entry =
    | { kind: "segment"; segment: Segment }
    | { kind: "line"; line: any; blockSentence: string }
    | { kind: "block"; block: any; blockSentence: string };

  const entries: Entry[] = [];
  const segments: Segment[] = [];

  blocks.forEach((block: any) => {
    // Context sentence = all lines in the block, as before.
    const blockSentence = block.lines
      ? block.lines.map((l: any) => l.text).join(" ")
      : block.text;

    if (block.lines) {
      block.lines.forEach((line: any) => {
        if (line.elements) {
          splitLine(line, blockSentence).forEach((segment) => {
            segments.push(segment);
            entries.push({ kind: "segment", segment });
          });
        } else {
          entries.push({ kind: "line", line, blockSentence });
        }
      });
    } else {
      entries.push({ kind: "block", block, blockSentence });
    }
  });

  // Link a piece to the piece below it when it ends with a linking word.
  const ordered = segments
    .filter((s) => s.frame)
    .sort((a, b) => (a.frame as Frame).top - (b.frame as Frame).top);
  ordered.forEach((a) => {
    if (a.next || a.depth >= LINE_CONTEXT.maxPieces) return;
    if (!endsWithConnector(a.text)) return;
    let best: Segment | null = null;
    let bestScore = Infinity;
    for (const b of ordered) {
      if (b === a || b.hasPrev) continue;
      const score = isBelowAndAligned(a, b);
      if (score !== null && score < bestScore) {
        best = b;
        bestScore = score;
      }
    }
    if (best !== null) {
      a.next = best;
      best.hasPrev = true;
      best.depth = a.depth + 1;
    }
  });

  // One shared context (text, sentence, word counts) per group of pieces.
  let nextGroupId = 0;
  const contextOf = new Map<
    Segment,
    {
      id: number;
      line: string;
      sentence: string;
      occurrences: Map<any, number>;
    }
  >();
  segments
    .filter((s) => !s.hasPrev)
    .forEach((head) => {
      const group: Segment[] = [];
      for (let s: Segment | null = head; s; s = s.next) group.push(s);

      const sentences = group
        .map((s) => s.blockSentence)
        .filter((s, i, all) => all.indexOf(s) === i);
      const lineText = group.map((s) => s.text).join(" ");
      const nextOccurrence = createOccurrenceCounter();
      const occurrences = new Map<any, number>();
      group.forEach((s) =>
        s.elements.forEach((element) =>
          occurrences.set(element, nextOccurrence(element.text)),
        ),
      );
      const shared = {
        id: nextGroupId++,
        line: lineText,
        // Pieces from different OCR blocks: the joined phrase itself is the
        // cleanest context ("DATE OF BIRTH"). Same block: keep the block text.
        sentence: sentences.length > 1 ? lineText : sentences[0],
        occurrences,
      };
      group.forEach((s) => contextOf.set(s, shared));
    });

  // Emit the boxes in the original reading order.
  const data: WordBox[] = [];
  entries.forEach((entry) => {
    if (entry.kind === "segment") {
      const ctx = contextOf.get(entry.segment);
      if (!ctx) return;
      entry.segment.elements.forEach((element: any) => {
        data.push({
          text: element.text,
          sentence: ctx.sentence,
          line: ctx.line,
          group: ctx.id,
          occurrence: ctx.occurrences.get(element) ?? 0,
          x: element.frame?.left || 0,
          y: element.frame?.top || 0,
          width: element.frame?.width || 0,
          height: element.frame?.height || 0,
        });
      });
    } else if (entry.kind === "line") {
      // Fallback to line level
      data.push({
        text: entry.line.text,
        sentence: entry.blockSentence,
        line: entry.line.text,
        group: nextGroupId++,
        occurrence: 0,
        x: entry.line.frame?.left || 0,
        y: entry.line.frame?.top || 0,
        width: entry.line.frame?.width || 0,
        height: entry.line.frame?.height || 0,
      });
    } else {
      // Fallback to block level
      data.push({
        text: entry.block.text,
        sentence: entry.blockSentence,
        line: entry.block.text,
        group: nextGroupId++,
        occurrence: 0,
        x: entry.block.frame?.left || 0,
        y: entry.block.frame?.top || 0,
        width: entry.block.frame?.width || 0,
        height: entry.block.frame?.height || 0,
      });
    }
  });
  return data;
};
