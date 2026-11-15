#!/usr/bin/env node
/** Refresh the pinned JMdict extract using only Node.js 18+ built-ins. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), "..");
const DATA = path.join(ROOT, "data", "vocabulary");
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 128 * 1024 * 1024;
const encode = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const HELP = `Refresh the pinned JMdict extract; never changes source sense selections.

Usage:
  node scripts/update-vocabulary-source.mjs --release latest
  node scripts/update-vocabulary-source.mjs --release 3.6.2+20261109214828

Options:
  --release <tag|latest>  Required GitHub release tag, or latest.
  -h, --help             Show this help.

Requires Node.js 18+. No npm packages, Python, or system tar/unzip commands needed.
`;

export function parseArguments(args) {
  if (args.length === 1 && ["-h", "--help"].includes(args[0])) return { help: true };
  let release;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = arg === "--release" ? args[++i] : arg.startsWith("--release=") ? arg.slice(10) : undefined;
    if (value === undefined || !value.trim() || value.startsWith("-")) {
      throw new Error(`Expected --release <tag|latest>; received ${arg}. Use --help for usage.`);
    }
    if (release !== undefined) throw new Error("Specify --release only once.");
    release = value;
  }
  if (!release) throw new Error("--release is required. Use --help for usage.");
  return { release };
}

/** Read the single JSON member of the upstream .tgz in memory, never to disk.
 * Only ordinary tar file headers are needed for these release assets. PAX
 * metadata and directories can be skipped; unsupported layouts fail explicitly.
 */
export function extractDictionary(archive) {
  const tar = gunzipSync(archive, { maxOutputLength: MAX_EXTRACTED_BYTES });
  if (tar.length % 512 !== 0) throw new Error("Truncated tar archive.");
  let payload;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      if (!tar.subarray(offset).every((byte) => byte === 0)) throw new Error("Unexpected data after tar terminator.");
      if (!payload) throw new Error("Archive contains no JSON dictionary.");
      return payload;
    }
    const field = (start, end) => header.subarray(start, end).toString("utf8").split("\0", 1)[0];
    const octal = (start, end) => {
      const value = field(start, end).trim();
      if (!/^[0-7]+$/u.test(value)) throw new Error("Unsupported tar numeric field.");
      const number = Number.parseInt(value, 8);
      if (!Number.isSafeInteger(number)) throw new Error("Tar numeric field is too large.");
      return number;
    };
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (checksum !== octal(148, 156)) throw new Error("Invalid tar header checksum.");
    const size = octal(124, 136);
    const start = offset + 512, end = start + size;
    const next = start + Math.ceil(size / 512) * 512;
    if (next > tar.length) throw new Error("Truncated tar member.");
    const type = field(156, 157);
    if (type === "" || type === "0") {
      const name = [field(345, 500), field(0, 100)].filter(Boolean).join("/");
      if (name.endsWith(".json")) {
        if (payload) throw new Error("Archive contains multiple JSON dictionaries.");
        payload = tar.subarray(start, end);
      }
    } else if (!["5", "x", "g"].includes(type)) {
      throw new Error(`Unsupported tar member type ${type}.`);
    }
    offset = next;
  }
  throw new Error("Tar archive has no terminator.");
}

export async function download(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "Japanese-JSON-vocabulary-builder" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
  const length = Number(response.headers.get("content-length"));
  if (length > MAX_ARCHIVE_BYTES) {
    await response.body?.cancel();
    throw new Error(`Download exceeds ${MAX_ARCHIVE_BYTES} bytes: ${url}`);
  }
  if (!response.body) throw new Error(`Empty response body: ${url}`);
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_ARCHIVE_BYTES) throw new Error(`Download exceeds ${MAX_ARCHIVE_BYTES} bytes: ${url}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

export async function updateSource({ release, dataDirectory = DATA, fetchImpl = fetch }) {
  if (!release || typeof release !== "string") throw new Error("A release tag or latest is required.");
  const suffix = release === "latest" ? "latest" : `tags/${encodeURIComponent(release)}`;
  const metadata = JSON.parse(await download(`https://api.github.com/repos/scriptin/jmdict-simplified/releases/${suffix}`, fetchImpl));
  if (typeof metadata.tag_name !== "string" || !Array.isArray(metadata.assets)) throw new Error("Invalid GitHub release metadata.");
  // Node has native gzip support; .tgz avoids needing a ZIP dependency.
  const asset = metadata.assets.find((a) => a.name?.startsWith("jmdict-eng-common-") && a.name.endsWith(".json.tgz"));
  if (!asset?.browser_download_url) throw new Error(`No common English JMdict .json.tgz asset in ${metadata.tag_name}.`);
  const archive = await download(asset.browser_download_url, fetchImpl);
  const payload = extractDictionary(archive);
  const source = JSON.parse(payload);
  if (!Array.isArray(source.words) || typeof source.dictDate !== "string") throw new Error("Invalid JMdict dictionary structure.");
  const byId = new Map(source.words.map((entry) => [entry.id, entry]));
  const selections = JSON.parse(await readFile(path.join(dataDirectory, "source-selections.json"), "utf8"));
  for (const [slug, selection] of Object.entries(selections)) {
    const entry = byId.get(selection.entryId);
    const sense = Number.isInteger(selection.senseIndex) && selection.senseIndex >= 0 ? entry?.sense?.[selection.senseIndex] : undefined;
    if (!sense) throw new Error(`Source entry/sense missing for ${slug}; review selections before updating.`);
    const glosses = sense.gloss.map((gloss) => gloss.text);
    try {
      assert.deepEqual(glosses, selection.glosses);
    } catch {
      throw new Error(`Sense changed for ${slug}: ${JSON.stringify(glosses)}. Review and update its source selection before retrying.`);
    }
  }
  const selected = encode({
    snapshot: metadata.tag_name,
    entries: [...new Set(Object.values(selections).map((s) => s.entryId))].sort().map((id) => byId.get(id)),
  });
  const manifest = JSON.parse(await readFile(path.join(dataDirectory, "source-manifest.json"), "utf8"));
  Object.assign(manifest, {
    snapshot: metadata.tag_name,
    downloadUrl: asset.browser_download_url,
    archiveSha256: sha256(archive),
    jsonSha256: sha256(payload),
    dictionaryDate: source.dictDate,
    selectedEntriesSha256: sha256(selected),
  });
  const licenseData = await download(manifest.licenseUrl, fetchImpl);
  // Complete network requests and source-sense checks before changing tracked files.
  await writeFile(path.join(dataDirectory, "source-entries.json"), selected);
  await writeFile(path.join(dataDirectory, "source-manifest.json"), encode(manifest));
  await writeFile(path.join(dataDirectory, "EDRDG-LICENSE.html"), licenseData);
  return metadata.tag_name;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) process.stdout.write(HELP);
    else {
      const tag = await updateSource(options);
      console.log(`Updated dictionary extract to ${tag}. Run npm run build:vocabulary and npm test; review the diff.`);
    }
  } catch (error) {
    console.error(`Update failed: ${error.message}`);
    process.exitCode = 1;
  }
}
