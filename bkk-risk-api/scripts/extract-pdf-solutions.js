/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * One-time extractor: reads the "Solutions จุดเสี่ยงอุบัติเหตุ" PDFs via
 * pdftotext (poppler) and generates src/data/risk-point-pdf-details.ts which
 * feeds the `causes` / `solutions` fields of the RiskPointDetail API.
 *
 * Usage:
 *   node scripts/extract-pdf-solutions.js          # expect pdftotext on PATH
 *   PDFTOTEXT=C:\path\to\pdftotext.exe node ...    # explicit binary
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PDF_DIR = path.join(__dirname, '..', 'PDF_วิเคราะห์_Solutions_จุดเสี่ยงอุบัติเหตุ');
const PDFTOTEXT = process.env.PDFTOTEXT || 'pdftotext';

const FILES = [
  '660628-solutions-1-20.pdf',
  '660628-solutions-21-40.pdf',
  '660628-solutions-41-60.pdf',
  '660628-solutions-61-80.pdf',
  '660628-solutions-81-100.pdf',
  '660628-solutions-101-126.pdf',
];

const MAX_RANK = 100;
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'risk-point-pdf-details.ts');

const CLEANUP_LINES = [
  /^ข้อมูลจาก\s+(www\.thairsc\.com|ThaiRSC|iTIC)$/,
  /^\(ThaiRSC\)\s*\(iTIC\)$/,
];

function extractText(file) {
  const target = path.join(PDF_DIR, file);
  const buffer = execFileSync(PDFTOTEXT, ['-layout', target, '-'], {
    maxBuffer: 128 * 1024 * 1024,
    encoding: 'buffer',
  });
  return buffer.toString('utf8');
}

function cleanupLine(line) {
  const trimmed = line.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (CLEANUP_LINES.some((re) => re.test(trimmed))) return null;
  return trimmed;
}

function splitPoints(text) {
  const normalized = text.replace(/\f/g, '\n');
  const markerRe = /(?:^|\n)[ \t]*จุดที่[ \t]*(\d+)[ \t]*[：:]/g;
  const matches = [];
  let m;
  while ((m = markerRe.exec(normalized)) !== null) {
    matches.push({ rank: Number(m[1]), index: m.index });
  }
  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    blocks.push({ rank: matches[i].rank, block: normalized.slice(matches[i].index, end) });
  }
  return blocks;
}

function cutAfterHeader(block, headerIndex) {
  const colon = block.indexOf(':', headerIndex);
  const newline = block.indexOf('\n', headerIndex);
  if (colon !== -1 && (newline === -1 || colon < newline)) {
    return block.slice(colon + 1);
  }
  if (newline !== -1) {
    return block.slice(newline + 1);
  }
  return '';
}

function findMarker(block, from, regex) {
  regex.lastIndex = 0;
  const m = regex.exec(block.slice(from));
  return m ? from + m.index : -1;
}

const SOLUTIONS_HEADER_SRC = ['นวทางการแก้ไข', 'แนวทางการแก้ไข'];
const SECTION_END_SRC = [
  'อุปกรณ์ที่ติดตั้ง',
  'วันที่เริ่มดำเนินการ',
  'วันที่ดำเนินการแล้วเสร็จ',
  'ภาพหลังการดำเนินการ',
  'การสำรวจในปัจจุบัน',
  'หมายเหตุ',
];

function tolerantRegex(...phrases) {
  const inner = phrases
    .map((phrase) => phrase.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\u00A0]*'))
    .join('|');
  return new RegExp(`(?:${inner})`);
}

const SOLUTIONS_HEADER = tolerantRegex(...SOLUTIONS_HEADER_SRC);
const CAUSES_HEADER = tolerantRegex('สาเหตุการเกิดอุบัติเหตุ', 'สาเหตุการเกิด');
const SECTION_END = tolerantRegex(...SECTION_END_SRC);

function splitItems(body) {
  const normalized = body.replace(/\f/g, '\n');
  const parts = normalized.split(/(?:^|\n)[ \t]*\d{1,2}[.)](?=\s|$)/);
  const items = [];
  for (const part of parts) {
    const cleaned = part
      .split('\n')
      .map(cleanupLine)
      .filter(Boolean)
      .join(' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (!cleaned) continue;
    items.push(cleaned);
  }
  return items;
}

function extractSections(block) {
  const causesHeader = findMarker(block, 0, CAUSES_HEADER);
  if (causesHeader === -1) return { causes: [], solutions: [] };

  const solutionsHeader = findMarker(block, causesHeader + 1, SOLUTIONS_HEADER);
  const causesEnd =
    solutionsHeader !== -1
      ? solutionsHeader
      : findMarker(block, causesHeader + 1, SECTION_END);
  const causesSliceEnd = causesEnd !== -1 ? causesEnd : block.length;

  const causesSlice = block.slice(causesHeader, causesSliceEnd);
  const causes = splitItems(cutAfterHeader(causesSlice, 0));

  let solutions = [];
  if (solutionsHeader !== -1) {
    const solutionsEnd = findMarker(block, solutionsHeader + 1, SECTION_END);
    const slice = block.slice(
      solutionsHeader,
      solutionsEnd !== -1 ? solutionsEnd : block.length,
    );
    solutions = splitItems(cutAfterHeader(slice, 0));
  }

  return { causes, solutions };
}

function parseFile(file) {
  const text = extractText(file);
  const points = splitPoints(text);
  const result = [];
  for (const { rank, block } of points) {
    if (rank > MAX_RANK) continue;
    const { causes, solutions } = extractSections(block);
    result.push({ clusterRank: rank, sourceDocument: file, causes, solutions });
  }
  return result;
}

function main() {
  const seen = new Map();
  const entries = [];

  for (const file of FILES) {
    const parsed = parseFile(file);
    for (const entry of parsed) {
      if (seen.has(entry.clusterRank)) {
        console.warn(`duplicate rank ${entry.clusterRank} in ${file}`);
        continue;
      }
      seen.set(entry.clusterRank, entry);
      entries.push(entry);
    }
  }

  entries.sort((a, b) => a.clusterRank - b.clusterRank);

  const ranks = entries.map((e) => e.clusterRank);
  const missing = [];
  for (let r = 1; r <= MAX_RANK; r++) if (!seen.has(r)) missing.push(r);
  const emptyCauses = entries.filter((e) => e.causes.length === 0).map((e) => e.clusterRank);
  const emptySols = entries.filter((e) => e.solutions.length === 0).map((e) => e.clusterRank);

  console.log(`parsed files: ${FILES.length}`);
  console.log(`entries (rank 1..${MAX_RANK}): ${entries.length}`);
  console.log(`missing ranks: ${missing.length ? missing.join(', ') : 'none'}`);
  console.log(`ranks with 0 causes: ${emptyCauses.length ? emptyCauses.join(', ') : 'none'}`);
  console.log(`ranks with 0 solutions: ${emptySols.length ? emptySols.join(', ') : 'none'}`);
  console.log(`total cause items: ${entries.reduce((n, e) => n + e.causes.length, 0)}`);
  console.log(`total solution items: ${entries.reduce((n, e) => n + e.solutions.length, 0)}`);

  writeDataFile(entries);
}

function writeDataFile(entries) {
  const dir = path.dirname(OUT_FILE);
  fs.mkdirSync(dir, { recursive: true });

  const body = entries
    .map(
      (e) =>
        `  {\n` +
        `    clusterRank: ${e.clusterRank},\n` +
        `    sourceDocument: ${JSON.stringify(e.sourceDocument)},\n` +
        `    causes: [\n` +
        e.causes.map((c) => `      { description: ${JSON.stringify(c)}, sourceDocument: ${JSON.stringify(e.sourceDocument)} }`).join(',\n') +
        `\n    ],\n` +
        `    solutions: [\n` +
        e.solutions.map((s) => `      { description: ${JSON.stringify(s)}, sourceDocument: ${JSON.stringify(e.sourceDocument)} }`).join(',\n') +
        `\n    ],\n` +
        `  }`,
    )
    .join(',\n');

  const content = `import { SourcedNote } from '../common/models';

export interface RiskPointPdfDetails {
  clusterRank: number;
  sourceDocument: string;
  causes: SourcedNote[];
  solutions: SourcedNote[];
}

/** Generated by scripts/extract-pdf-solutions.js — do not edit by hand. */
export const riskPointPdfDetails: RiskPointPdfDetails[] = [
${body}
];

const byRank = new Map<number, RiskPointPdfDetails>(
  riskPointPdfDetails.map((entry) => [entry.clusterRank, entry]),
);

/** Copies PDF-extracted causes/solutions onto risk points by cluster rank. */
export function withPdfDetails<T extends { clusterRank: number }>(
  points: T[],
): Array<T & { causes: SourcedNote[]; solutions: SourcedNote[] }> {
  return points.map((point) => {
    const detail = byRank.get(point.clusterRank);
    if (!detail) {
      return {
        ...point,
        causes: [],
        solutions: [],
      };
    }
    return {
      ...point,
      causes: detail.causes.map((c) => ({ ...c })),
      solutions: detail.solutions.map((s) => ({ ...s })),
    };
  });
}
`;

  fs.writeFileSync(OUT_FILE, content, 'utf8');
  console.log(`wrote ${OUT_FILE} (${Buffer.byteLength(content, 'utf8')} bytes)`);
}

main();