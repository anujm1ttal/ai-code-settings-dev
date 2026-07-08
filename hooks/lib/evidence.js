/**
 * Claude Code — Evidence Gate detection core (LH-2 T1).
 *
 * Pure functions only: no file I/O, no network, no git, no Date.now. The Stop
 * hook wrapper (evidence-gate.js) owns all I/O (reading transcript_path) and
 * calls into this module with already-read text / already-parsed entries.
 *
 * Transcript schema (confirmed by probing a real transcript, LH-2 kickoff):
 * JSONL file, each line an object with `type` ('user'|'assistant'|'system'|
 * meta types we ignore by construction since we only match 'user'/'assistant').
 * `message.content` is an array of blocks:
 *   - assistant text:   { type:'text', text }
 *   - assistant tool use:{ type:'tool_use', id, name, input }
 *   - user tool result: { type:'tool_result', tool_use_id, content } where
 *     `content` is polymorphic (string, array of {type:'text',text} blocks,
 *     or other/unknown shapes — all handled defensively, never thrown).
 */

'use strict';

// --- Claim lexicon (hasCompletionClaim) -------------------------------------

// Word/phrase-level claims. Checked per-sentence so a question mark anywhere
// else in the text can't accidentally exempt a real claim, and so negation
// scope stays local to the sentence containing the match. Global copies
// (below) let matchCompletionClaim walk every occurrence per sentence rather
// than stopping at the first (needed so a quoted/hyphenated false hit doesn't
// block a later, real hit in the same sentence).
const CLAIM_LEXICON = [
  /\ball\s+tests?\s+pass(?:es|ed|ing)?\b/i,
  /\bworks?\s+now\b/i,
  /\bdone\b/i,
  /\bcomplete[ds]?\b/i,
  /\bfixed\b/i,
  /\bfinished\b/i,
  /\bpassing\b/i,
];
const CLAIM_LEXICON_GLOBAL = CLAIM_LEXICON.map((p) => new RegExp(p.source, `${p.flags}g`));

// Negation markers checked immediately before a claim word within the same
// sentence (e.g. "not done", "almost done", "isn't fixed"). Contractions
// ("isn't", "aren't", "wasn't", ...) are caught via the "n't" suffix so we
// don't need to enumerate every auxiliary verb.
const NEGATOR_WORDS = new Set(['not', 'never', 'almost', 'no']);

function hasNegationBefore(before) {
  const trimmed = before.trim().toLowerCase();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  const lastWord = words[words.length - 1];
  return NEGATOR_WORDS.has(lastWord) || lastWord.endsWith("n't");
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

function isQuestion(sentence) {
  return /\?\s*$/.test(sentence.trim());
}

// Finds quote-delimited spans (", `, ') within a sentence, WITHOUT mutating
// the string — a claim word inside a quoted/code span (e.g. `prints "done"`)
// is a literal, not an assertion, and must be skipped in place rather than
// stripped-and-rematched (stripping risks gluing adjacent tokens together
// into a spurious new match). A bare `'` is excluded from delimiter
// candidacy when it sits between two letters (contractions like "isn't",
// "it's") so those don't misfire as unpaired quote-openers.
function findQuotedSpans(sentence) {
  const spans = [];
  for (const quoteChar of ['"', '`', "'"]) {
    let start = -1;
    for (let i = 0; i < sentence.length; i++) {
      if (sentence[i] !== quoteChar) continue;
      if (quoteChar === "'" && /[A-Za-z]/.test(sentence[i - 1] || '') && /[A-Za-z]/.test(sentence[i + 1] || '')) {
        continue; // mid-word apostrophe (contraction), not a quote delimiter
      }
      if (start === -1) {
        start = i;
      } else {
        spans.push([start, i]);
        start = -1;
      }
    }
  }
  return spans;
}

function isInsideQuotedSpan(spans, position) {
  return spans.some(([start, end]) => position > start && position < end);
}

// Rejects a match immediately adjacent to a hyphen+letter on either side
// (e.g. "fixed-size", "size-fixed") — the verb sense ("I fixed X") is never
// hyphenated, so this is a cheap, bounded compound-word guard (no NLP).
function isHyphenCompound(sentence, matchStart, matchEnd) {
  const before = sentence.slice(Math.max(0, matchStart - 2), matchStart);
  const after = sentence.slice(matchEnd, matchEnd + 2);
  return /[A-Za-z]-$/.test(before) || /^-[A-Za-z]/.test(after);
}

// Returns the matched sentence (trimmed) or null. A "claim" requires a
// lexicon hit in a non-question sentence, outside any quoted/code span, not
// part of a hyphenated compound, with no negation immediately preceding the
// matched word/phrase.
function matchCompletionClaim(finalText) {
  if (!finalText || typeof finalText !== 'string') return null;

  for (const rawSentence of splitSentences(finalText)) {
    const sentence = rawSentence.trim();
    if (isQuestion(sentence)) continue;

    const quotedSpans = findQuotedSpans(sentence);

    for (const pattern of CLAIM_LEXICON_GLOBAL) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(sentence)) !== null) {
        const matchEnd = match.index + match[0].length;
        if (isInsideQuotedSpan(quotedSpans, match.index)) continue;
        if (isHyphenCompound(sentence, match.index, matchEnd)) continue;
        if (hasNegationBefore(sentence.slice(0, match.index))) continue;
        return sentence;
      }
    }
  }
  return null;
}

function hasCompletionClaim(finalText) {
  return matchCompletionClaim(finalText) !== null;
}

// --- Transcript parsing ------------------------------------------------------

// Parses already-read JSONL text into an array of entries, skipping
// malformed lines defensively (never throws on a parse surprise).
function parseTranscript(text) {
  if (!text || typeof text !== 'string') return [];
  const entries = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Malformed line — skip, don't fail the whole transcript.
    }
  }
  return entries;
}

function blockList(content) {
  return Array.isArray(content) ? content : [];
}

// Last assistant entry that has at least one text block (skips trailing
// tool_use-only assistant entries, e.g. a final Bash call with no prose).
function extractFinalAssistantText(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry || entry.type !== 'assistant') continue;
    const texts = blockList(entry.message && entry.message.content)
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text);
    if (texts.length > 0) return texts.join('\n');
  }
  return '';
}

function extractToolUses(entries) {
  const uses = [];
  entries.forEach((entry, entryIndex) => {
    if (!entry || entry.type !== 'assistant') return;
    for (const block of blockList(entry.message && entry.message.content)) {
      if (block && block.type === 'tool_use') {
        uses.push({ entryIndex, toolUseId: block.id, name: block.name, input: block.input || {} });
      }
    }
  });
  return uses;
}

// content is polymorphic: string, array of {type:'text',text} blocks, or an
// unrecognized shape — extract whatever text is present, never throw.
function extractResultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block.text === 'string') return block.text;
        return '';
      })
      .join('\n');
  }
  return '';
}

function extractToolResults(entries) {
  const results = [];
  entries.forEach((entry, entryIndex) => {
    if (!entry || entry.type !== 'user') return;
    for (const block of blockList(entry.message && entry.message.content)) {
      if (block && block.type === 'tool_result') {
        results.push({ entryIndex, toolUseId: block.tool_use_id, text: extractResultText(block.content) });
      }
    }
  });
  return results;
}

// --- Source-edit detection (hasSourceEdits) ----------------------------------

const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SOURCE_EXTENSIONS = ['.py', '.ts', '.tsx', '.js', '.cs', '.yaml', '.json', '.sh'];
const SOURCE_PATH_PREFIXES = ['hooks/', 'scripts/'];
// Doc/state work is not "source" — Artifacts/** is state (TODO, plans,
// reports), **/*.md is prose, scratchpad/temp is transient scratch space.
const EXCLUDED_PATH_SEGMENTS = ['artifacts/', 'scratchpad/', 'temp/'];

function normalizePath(filePath) {
  return String(filePath).replace(/\\/g, '/').toLowerCase();
}

function isExcludedPath(normalized) {
  if (normalized.endsWith('.md')) return true;
  return EXCLUDED_PATH_SEGMENTS.some((seg) => normalized.startsWith(seg) || normalized.includes(`/${seg}`));
}

function isSourcePath(filePath) {
  if (!filePath) return false;
  const normalized = normalizePath(filePath);
  if (isExcludedPath(normalized)) return false;
  if (SOURCE_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix) || normalized.includes(`/${prefix}`))) {
    return true;
  }
  return SOURCE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}

function getToolTargetPath(use) {
  const input = use.input || {};
  return input.file_path || input.path || input.filePath || input.notebook_path || '';
}

// Index (transcript position) of the last edit/write targeting a source
// path, or -1 if none. Ordering-based "freshness" (below) is measured
// against this, not wall-clock time.
function lastSourceEditIndex(entries) {
  let last = -1;
  for (const use of extractToolUses(entries)) {
    if (!EDIT_TOOL_NAMES.has(use.name)) continue;
    if (isSourcePath(getToolTargetPath(use))) last = Math.max(last, use.entryIndex);
  }
  return last;
}

function hasSourceEdits(entries) {
  return lastSourceEditIndex(entries) !== -1;
}

// --- Fresh-evidence detection (hasFreshEvidence) -----------------------------

const TEST_RUNNER_PATTERNS = [
  /\bpytest\b/i,
  /\bnpm\s+(run\s+)?test\b/i,
  /\byarn\s+test\b/i,
  /\bruff\b/i,
  /\bpyright\b/i,
  /\bmypy\b/i,
  /deploy\.sh\b/i,
  /\bnode\s+--test\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
  /\bdotnet\s+test\b/i,
  /\bgo\s+test\b/i,
];

const RUNNER_TOOL_NAMES = new Set(['Bash', 'PowerShell']);

// Success requires a positive signal (exit 0 / "N passed" / "all tests
// pass(ed|ing)") and no nonzero failure count — absence of failure text
// alone is not treated as success (defensive default).
function resultIndicatesSuccess(text) {
  if (!text) return false;
  const failedMatch = text.match(/(\d+)\s+failed/i);
  if (failedMatch && parseInt(failedMatch[1], 10) > 0) return false;
  if (/exit code:?\s*[1-9]/i.test(text)) return false;
  if (/exit code:?\s*0\b/i.test(text)) return true;
  if (/\ball\s+tests?\s+pass(?:ed|ing)?\b/i.test(text)) return true;
  if (/\bpassed\b/i.test(text)) return true;
  return false;
}

function hasFreshEvidence(entries) {
  const lastEditIndex = lastSourceEditIndex(entries);
  const resultsByToolUseId = new Map(extractToolResults(entries).map((r) => [r.toolUseId, r]));

  for (const use of extractToolUses(entries)) {
    if (!RUNNER_TOOL_NAMES.has(use.name)) continue;
    if (use.entryIndex <= lastEditIndex) continue; // must come AFTER the last source edit
    const command = use.input.command || '';
    if (!TEST_RUNNER_PATTERNS.some((pattern) => pattern.test(command))) continue;
    const result = resultsByToolUseId.get(use.toolUseId);
    if (result && resultIndicatesSuccess(result.text)) return true;
  }
  return false;
}

module.exports = {
  hasCompletionClaim,
  matchCompletionClaim,
  hasSourceEdits,
  hasFreshEvidence,
  parseTranscript,
  extractFinalAssistantText,
  // Exported for direct unit testing of internals.
  isSourcePath,
  extractToolUses,
  extractToolResults,
  lastSourceEditIndex,
};
