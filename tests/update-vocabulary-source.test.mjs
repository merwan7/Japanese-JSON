import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { download, extractDictionary, parseArguments, updateSource } from "../scripts/update-vocabulary-source.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");

function tarMember(name, content, type = "0") {
  const bytes = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, "ascii");
  header.write(bytes.length.toString(8).padStart(11, "0") + "\0", 124, "ascii");
  header.fill(32, 148, 156);
  header.write(type, 156, "ascii");
  header.write("ustar\0", 257, "ascii");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
  return Buffer.concat([header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]);
}

function archiveFor(source) {
  return gzipSync(Buffer.concat([
    tarMember("metadata", "", "x"),
    tarMember("dictionary/", "", "5"),
    tarMember("dictionary/source.json", JSON.stringify(source)),
    Buffer.alloc(1024),
  ]));
}

async function fixture(t, { changedSense = false, missingEntry = false, failLicense = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "japanese-json-updater-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const selections = { mizu: { entryId: "2", senseIndex: 0, glosses: ["water"] } };
  const source = {
    dictDate: "2026-11-09",
    words: [{ id: missingEntry ? "3" : "2", kanji: [{ text: "水" }], sense: [{ gloss: [{ text: changedSense ? "river" : "water" }] }] }],
  };
  const archive = archiveFor(source);
  const tag = "3.6.2+20261109214828";
  const assetUrl = "https://example.test/source.json.tgz";
  const licenseUrl = "https://example.test/license";
  const baseline = {
    "source-selections.json": JSON.stringify(selections),
    "source-manifest.json": JSON.stringify({ licenseUrl, license: "CC-BY-SA-4.0", classificationFiles: { "kanji-array-n5.json": "keep-this-hash" } }),
    "source-entries.json": "existing source\n",
    "EDRDG-LICENSE.html": "existing license\n",
  };
  await Promise.all(Object.entries(baseline).map(([name, value]) => writeFile(path.join(directory, name), value)));
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    assert(options.signal instanceof AbortSignal);
    assert.equal(options.headers["User-Agent"], "Japanese-JSON-vocabulary-builder");
    if (url.startsWith("https://api.github.com/")) return Response.json({ tag_name: tag, assets: [{ name: "jmdict-eng-common-fixture.json.tgz", browser_download_url: assetUrl }] });
    if (url === assetUrl) return new Response(archive);
    if (url === licenseUrl) return new Response(failLicense ? "unavailable" : "upstream license", { status: failLicense ? 503 : 200 });
    throw new Error(`Unexpected URL ${url}`);
  };
  return { directory, tag, source, archive, selections, baseline, fetchImpl, calls };
}

test("CLI requires one release and accepts help, latest, and pinned tags", () => {
  assert.deepEqual(parseArguments(["--help"]), { help: true });
  assert.deepEqual(parseArguments(["--release", "latest"]), { release: "latest" });
  assert.deepEqual(parseArguments(["--release=3.6.2+20261109214828"]), { release: "3.6.2+20261109214828" });
  for (const args of [[], ["--release"], ["--release", "--help"], ["--wat"], ["--release=latest", "--release=older"]]) assert.throws(() => parseArguments(args));
});

test("built-in archive reader handles gzip, metadata, directories, and Unicode JSON", () => {
  const source = { words: [{ written: "水", reading: "みず", arabic: "ماء" }] };
  assert.deepEqual(JSON.parse(extractDictionary(archiveFor(source))), source);
});

test("archive reader rejects corrupt, truncated, missing, or ambiguous dictionary payloads", () => {
  assert.throws(() => extractDictionary(Buffer.from("not gzip")));
  const corrupt = tarMember("a.json", "{}"); corrupt[0] ^= 1;
  assert.throws(() => extractDictionary(gzipSync(Buffer.concat([corrupt, Buffer.alloc(1024)]))), /checksum/);
  assert.throws(() => extractDictionary(gzipSync(Buffer.alloc(511))), /Truncated/);
  assert.throws(() => extractDictionary(gzipSync(tarMember("a.json", "{}").subarray(0, 512))), /Truncated tar member/);
  assert.throws(() => extractDictionary(gzipSync(Buffer.alloc(1024))), /no JSON/);
  assert.throws(() => extractDictionary(gzipSync(Buffer.concat([tarMember("a.json", "{}"), tarMember("b.json", "{}"), Buffer.alloc(1024)]))), /multiple JSON/);
});

test("downloads reject HTTP errors and oversized responses", async () => {
  await assert.rejects(download("https://example.test/missing", async () => new Response("missing", { status: 404 })), /HTTP 404/);
  await assert.rejects(download("https://example.test/large", async () => new Response("too large", { headers: { "content-length": String(65 * 1024 * 1024) } })), /exceeds/);
});

test("update preserves selections and classification metadata while refreshing hashes and attribution", async (t) => {
  const f = await fixture(t);
  assert.equal(await updateSource({ release: f.tag, dataDirectory: f.directory, fetchImpl: f.fetchImpl }), f.tag);
  assert(f.calls[0].endsWith("/tags/3.6.2%2B20261109214828"));
  const selected = await readFile(path.join(f.directory, "source-entries.json"));
  assert.deepEqual(JSON.parse(selected), { snapshot: f.tag, entries: f.source.words });
  const manifest = JSON.parse(await readFile(path.join(f.directory, "source-manifest.json")));
  assert.equal(manifest.archiveSha256, digest(f.archive));
  assert.equal(manifest.jsonSha256, digest(extractDictionary(f.archive)));
  assert.equal(manifest.selectedEntriesSha256, digest(selected));
  assert.equal(manifest.classificationFiles["kanji-array-n5.json"], "keep-this-hash");
  assert.equal(await readFile(path.join(f.directory, "EDRDG-LICENSE.html"), "utf8"), "upstream license");
  assert.equal(await readFile(path.join(f.directory, "source-selections.json"), "utf8"), f.baseline["source-selections.json"]);
});

test("source/sense failures and license download failures leave every tracked input untouched", async (t) => {
  for (const scenario of [{ changedSense: true }, { missingEntry: true }, { failLicense: true }]) {
    const f = await fixture(t, scenario);
    await assert.rejects(updateSource({ release: "latest", dataDirectory: f.directory, fetchImpl: f.fetchImpl }), /Sense changed|entry\/sense missing|HTTP 503/);
    assert(f.calls[0].endsWith("/latest"));
    for (const [name, content] of Object.entries(f.baseline)) assert.equal(await readFile(path.join(f.directory, name), "utf8"), content);
  }
});

test("missing release assets produce an actionable failure", async () => {
  await assert.rejects(updateSource({ release: "latest", fetchImpl: async () => Response.json({ tag_name: "empty", assets: [] }) }), /No common English JMdict/);
});
