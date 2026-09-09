/**
 * Course catalogue ETL: courses_clean.csv -> data/courses.json
 *
 * Normalises the raw Coursera/Udacity/Udemy catalogue export into a typed,
 * engine-ready JSON document:
 *   - parses the Python-style skills_list literal ("['A', 'B']") into a real array
 *   - extracts an integer month count from the free-text Duration field
 *   - coerces ratings / review counts to nullable numbers
 *   - trims whitespace pollution that leaks in from the CSV export
 *
 * The output is committed (data/courses.json) so the app never parses CSV at
 * runtime. Re-run this script only when the source catalogue changes:
 *
 *   bun scripts/convert-courses.ts        (or: npx tsx scripts/convert-courses.ts)
 */
import { createReadStream } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import readline from "node:readline";

const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "data/courses_clean.csv");
const OUT = resolve(ROOT, "data/courses.json");

interface RawCourse {
  course_id: string;
  Title: string;
  URL: string;
  ShortIntro: string;
  Category: string;
  SubCategory: string;
  CourseType: string;
  Skills: string;
  Instructors: string;
  Rating: number | null;
  Viewers: number | null;
  DurationMonths: number | null;
  DurationRaw: string;
  Site: string;
  Level: string;
  Reviews: number | null;
  skillsList: string[];
  domain: string;
}

/** RFC-4180-compliant CSV line splitter (handles quoted fields, embedded commas/newlines). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** "['Decision Trees', 'Tensorflow']" -> ["Decision Trees", "Tensorflow"] */
function parsePythonList(raw: string): string[] {
  const trimmed = (raw || "").trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  const inner = trimmed.slice(1, -1);
  if (!inner.trim()) return [];
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

/** Parse duration into month equivalent: "Approx. 26 hours" -> 1.86, "Approximately 3 months" -> 3 */
function parseDurationMonths(raw: string): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("hour")) return Math.max(0.2, Number((n / 14).toFixed(2)));
  if (lower.includes("week")) return Math.max(0.2, Number((n / 4).toFixed(2)));
  if (lower.includes("month")) return n;
  if (n > 12) return Math.max(0.2, Number((n / 14).toFixed(2)));
  return n;
}

function toNumber(raw: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const rl = readline.createInterface({ input: createReadStream(SRC, "utf-8") });
  const rows: RawCourse[] = [];
  let header: string[] | null = null;
  let buf = "";
  let pending: string[] = [];

  const flushRecord = (recordLines: string[]) => {
    const line = recordLines.join("\n");
    if (!line.trim()) return;
    const fields = parseCsvLine(line);
    if (!header) {
      // First complete record is the header row.
      header = fields.map((f) => f.trim().replace(/^\uFEFF/, ""));
      return;
    }
    const get = (name: string) => {
      const idx = header!.indexOf(name);
      return idx >= 0 ? (fields[idx] ?? "").trim() : "";
    };
    rows.push({
      course_id: get("course_id"),
      Title: get("Title"),
      URL: get("URL"),
      ShortIntro: get("Short Intro"),
      Category: get("Category"),
      SubCategory: get("Sub-Category"),
      CourseType: get("Course Type"),
      Skills: get("Skills"),
      Instructors: get("Instructors"),
      Rating: toNumber(get("Rating")),
      Viewers: toNumber(get("Number of viewers")),
      DurationMonths: parseDurationMonths(get("Duration")),
      DurationRaw: get("Duration"),
      Site: get("Site"),
      Level: get("Level"),
      Reviews: toNumber(get("Number of Reviews")),
      skillsList: parsePythonList(get("skills_list")),
      domain: get("domain"),
    });
  };

  for await (const chunk of rl) {
    // Reconstruct multi-line records: a record is complete when quotes balance.
    buf = buf ? `${buf}\n${chunk}` : chunk;
    const quoteCount = (buf.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      pending.push(buf);
      flushRecord(pending);
      pending = [];
      buf = "";
    }
  }
  if (buf.trim()) {
    pending.push(buf);
    flushRecord(pending);
  }

  // The header row was consumed inside flushRecord; rows now contain only data.
  const courses = rows;

  // Post-trim: clean strings that picked up CSV quoting artifacts.
  for (const c of courses) {
    c.Title = c.Title.replace(/\s+/g, " ").trim();
    c.ShortIntro = c.ShortIntro.replace(/\s+/g, " ").trim();
  }

  const valid = courses.filter((c) => c.course_id && c.Title);
  const stats = {
    total: valid.length,
    withRating: valid.filter((c) => c.Rating !== null).length,
    withDuration: valid.filter((c) => c.DurationMonths !== null).length,
    withSkills: valid.filter((c) => c.skillsList.length > 0).length,
    bySite: valid.reduce<Record<string, number>>((acc, c) => {
      acc[c.Site] = (acc[c.Site] || 0) + 1;
      return acc;
    }, {}),
    byDomain: valid.reduce<Record<string, number>>((acc, c) => {
      acc[c.domain] = (acc[c.domain] || 0) + 1;
      return acc;
    }, {}),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generated_at: new Date().toISOString(), stats, courses: valid }, null, 0), "utf-8");

  console.log(`Wrote ${valid.length} courses -> ${OUT}`);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
