import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), "..");
const DIR = "data/vocabulary";
const LOCALES = ["en", "es", "de", "ar"];
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const sha = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const encode = (value) => JSON.stringify(value, null, 2) + "\n";
const allowed = (values, value) => values.includes("*") || values.includes(value);
const normalize = (text) => text.normalize("NFC").trim().toLocaleLowerCase().replace(/\s+/gu, " ");
const kanjiOf = (text) => [...new Set([...text].filter((c) => /\p{Script=Han}/u.test(c)))];
const kanaChar = (text) => /^[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u.test(text);

function makeFurigana(written, reading) {
  // Preserve identical kana at the edges; annotate the remaining group as a whole.
  // Never guess a separate pronunciation for each kanji in an irregular word.
  const base = [...written], sound = [...reading];
  let start = 0;
  while (start < base.length && kanaChar(base[start]) && base[start] === sound[start]) start++;
  if (start === base.length && base.length === sound.length) return [{ base: written, reading: null }];
  let end = 0;
  while (end < base.length - start && end < sound.length - start &&
    kanaChar(base[base.length - 1 - end]) && base[base.length - 1 - end] === sound[sound.length - 1 - end]) end++;
  const result = [];
  if (start) result.push({ base: base.slice(0, start).join(""), reading: null });
  result.push({ base: base.slice(start, base.length - end).join(""), reading: sound.slice(start, sound.length - end).join("") });
  if (end) result.push({ base: base.slice(-end).join(""), reading: null });
  return result;
}

function classify(written, lists) {
  const characters = kanjiOf(written);
  const kanjiLevels = characters.map((kanji) => ({
    kanji,
    // On overlap, first introduction wins: N5 before N4, etc.
    level: LEVELS.find((level) => lists[level].includes(kanji)) ?? null,
  }));
  const unlistedKanji = kanjiLevels.filter((k) => k.level === null).map((k) => k.kanji);
  const known = kanjiLevels.filter((k) => k.level !== null);
  const level = unlistedKanji.length || !known.length ? null :
    LEVELS[Math.max(...known.map((k) => LEVELS.indexOf(k.level)))];
  return { level, basis: "repository-kanji-lists", status: "inferred", kanjiLevels, unlistedKanji };
}

function verifySource(entry, selection, written, reading, pos) {
  assert(entry && entry.id === selection.entryId, `Missing source entry ${selection.entryId}`);
  assert(entry.kanji.some((k) => k.text === written), `Unknown spelling ${written}`);
  assert(entry.kana.some((k) => k.text === reading && allowed(k.appliesToKanji, written)), `Invalid reading ${written}/${reading}`);
  const sense = entry.sense[selection.senseIndex];
  assert(sense, `Invalid sense index for ${written}`);
  assert(allowed(sense.appliesToKanji, written) && allowed(sense.appliesToKana, reading), `Sense restriction violated for ${written}/${reading}`);
  assert.deepEqual(selection.glosses, sense.gloss.map((g) => g.text), `Source gloss changed for ${written}; review the sense selection`);
  const checks = {
    noun: (tag) => ["n", "n-t", "n-adv"].includes(tag),
    numeral: (tag) => tag === "num",
    verb: (tag) => /^v(?:1|5|k|s|z)/u.test(tag),
    "i-adjective": (tag) => ["adj-i", "adj-ix"].includes(tag),
  };
  assert(checks[pos] && sense.partOfSpeech.some(checks[pos]), `Part of speech mismatch for ${written}`);
  return sense;
}

function validateBundle(bundle) {
  assert.equal(bundle.schemaVersion, 1);
  const unique = (items, name) => {
    assert(Array.isArray(items), `${name} must be an array`);
    const ids = items.map((x) => x.id);
    assert(ids.every((id) => typeof id === "string" && /^[a-z0-9][a-z0-9.-]*$/u.test(id)), `Invalid ${name} ID`);
    assert.equal(new Set(ids).size, ids.length, `Duplicate ${name} ID`);
    return new Map(items.map((x) => [x.id, x]));
  };
  const vocabulary = unique(bundle.vocabulary, "vocabulary");
  for (const item of vocabulary.values()) {
    const variants = unique(item.variants, "variant"), senses = unique(item.senses, "sense");
    assert(variants.size && senses.size);
    assert(["draft", "reviewed"].includes(item.reviewStatus));
    assert(item.sourceRefs.length > 0, `No provenance: ${item.id}`);
    const characters = new Set();
    for (const variant of variants.values()) {
      assert(variant.written && variant.reading);
      assert(/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(variant.reading));
      kanjiOf(variant.written).forEach((k) => characters.add(k));
      assert(variant.furigana.length > 0);
      variant.furigana.forEach((segment) => {
        assert(segment.base);
        assert(segment.reading === null || typeof segment.reading === "string" && segment.reading.length > 0);
        if (segment.reading === null) assert(!/\p{Script=Han}/u.test(segment.base), "Unannotated kanji");
      });
      assert.equal(variant.furigana.map((s) => s.base).join(""), variant.written, `Furigana spelling mismatch: ${item.id}`);
      assert.equal(variant.furigana.map((s) => s.reading ?? s.base).join(""), variant.reading, `Furigana reading mismatch: ${item.id}`);
    }
    assert.deepEqual([...characters], item.kanji, `Wrong kanji inventory: ${item.id}`);
    for (const sense of senses.values()) {
      assert(sense.variantIds.length > 0 && sense.variantIds.every((id) => variants.has(id)));
      for (const locale of LOCALES) {
        const translation = sense.translations[locale];
        assert(translation && typeof translation.label === "string" && translation.label.trim(), `Missing ${locale} translation for ${item.id}`);
        assert(["draft", "reviewed"].includes(translation.reviewStatus));
      }
    }
  }
  const studies = unique(bundle.studyItems, "study item");
  for (const study of studies.values()) {
    const vocab = vocabulary.get(study.vocabularyId);
    assert(vocab, `Dangling vocabulary reference: ${study.id}`);
    assert(vocab.variants.some((v) => v.id === study.variantId), `Dangling variant reference: ${study.id}`);
    const sense = vocab.senses.find((s) => s.id === study.senseId);
    assert(sense && sense.variantIds.includes(study.variantId), `Invalid sense/variant combination: ${study.id}`);
    assert(study.modes.length && study.modes.every((mode) => ["readingMatch", "meaningMatch"].includes(mode)));
    assert.equal(new Set(study.modes).size, study.modes.length);
    assert(study.jlpt.level === null || LEVELS.includes(study.jlpt.level));
    assert.equal(study.jlpt.status, "inferred");
    assert.equal(study.jlpt.basis, "repository-kanji-lists");
  }
  const collections = unique(bundle.collections, "collection");
  const covered = new Set();
  for (const collection of collections.values()) {
    assert(collection.studyItemIds.length > 0, "Empty collection");
    assert.equal(new Set(collection.studyItemIds).size, collection.studyItemIds.length);
    for (const locale of LOCALES) assert(collection.titles[locale]?.trim());
    collection.studyItemIds.forEach((id) => { assert(studies.has(id), `Dangling study reference: ${id}`); covered.add(id); });
  }
  assert.equal(covered.size, studies.size, "Study items missing from collections");
  assert.equal(new Set([...studies.values()].map((s) => s.vocabularyId)).size, vocabulary.size, "Unused vocabulary");
  return true;
}

function partition(bundle, level) {
  const studyItems = bundle.studyItems.filter((s) => s.jlpt.level === level);
  const ids = new Set(studyItems.map((s) => s.id));
  const vocabularyIds = new Set(studyItems.map((s) => s.vocabularyId));
  return {
    schemaVersion: bundle.schemaVersion,
    vocabulary: bundle.vocabulary.filter((v) => vocabularyIds.has(v.id)),
    studyItems,
    collections: bundle.collections.map((c) => ({ ...c, studyItemIds: c.studyItemIds.filter((id) => ids.has(id)) })).filter((c) => c.studyItemIds.length),
  };
}

function matchingConflicts(cards) {
  const conflicts = [];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i], b = cards[j];
    const pair = { studyItemIds: [a.id, b.id] };
    if (a.written === b.written || a.acceptedReadings.includes(b.reading) || b.acceptedReadings.includes(a.reading)) {
      conflicts.push({ mode: "readingMatch", ...pair, reason: "Shared spelling or a displayed reading valid for both words" });
    }
    for (const locale of LOCALES) if (a.written === b.written || normalize(a.labels[locale]) === normalize(b.labels[locale])) {
      conflicts.push({ mode: "meaningMatch", locale, ...pair, reason: "Shared spelling or identical normalized meaning labels" });
    }
  }
  return conflicts;
}

function build() {
  const curation = read(`${DIR}/curation.json`), selections = read(`${DIR}/source-selections.json`);
  const manifest = read(`${DIR}/source-manifest.json`), snapshot = read(`${DIR}/source-entries.json`);
  assert.equal(snapshot.snapshot, manifest.snapshot);
  assert.equal(sha(fs.readFileSync(path.join(ROOT, DIR, "source-entries.json"))), manifest.selectedEntriesSha256, "Source extract changed without updating its manifest");
  const source = new Map(snapshot.entries.map((e) => [e.id, e]));
  const lists = Object.fromEntries(LEVELS.map((level) => {
    const file = `kanji-array-${level.toLowerCase()}.json`;
    assert.equal(sha(fs.readFileSync(path.join(ROOT, file))), manifest.classificationFiles[file], `${file} changed; review classification and update its manifest hash`);
    return [level, read(file)];
  }));
  const bundle = { schemaVersion: 1, vocabulary: [], studyItems: [], collections: [] }, cards = [];
  const seen = new Set();
  for (const [theme, collection] of Object.entries(curation.collections)) {
    const studyItemIds = [];
    for (const row of collection.words) {
      assert.equal(row.length, curation.columns.length, "Wrong curation row length");
      const { id, written, reading, partOfSpeech, ...labels } = Object.fromEntries(curation.columns.map((col, i) => [col, row[i]]));
      assert(!seen.has(id), `Duplicate editorial ID: ${id}`); seen.add(id);
      const selection = selections[id]; assert(selection, `No source selection for ${id}`);
      const entry = source.get(selection.entryId);
      const sourceSense = verifySource(entry, selection, written, reading, partOfSpeech);
      const vocabularyId = `vocab.${id}`, variantId = `written-${id}`, senseId = selection.senseId;
      const studyId = `study.${id}.${senseId}`;
      bundle.vocabulary.push({
        id: vocabularyId,
        kanji: kanjiOf(written),
        variants: [{ id: variantId, written, reading, furigana: makeFurigana(written, reading) }],
        senses: [{
          id: senseId, variantIds: [variantId], partOfSpeech,
          translations: Object.fromEntries(LOCALES.map((locale) => [locale, { label: labels[locale], reviewStatus: selection.translationReviewStatus?.[locale] ?? "draft" }])),
          usage: { tags: sourceSense.misc, notes: sourceSense.info },
        }],
        sourceRefs: [{ sourceId: "jmdict", entryId: entry.id, senseIndex: selection.senseIndex, senseId, snapshot: manifest.snapshot }],
        reviewStatus: selection.reviewStatus ?? "draft",
      });
      bundle.studyItems.push({ id: studyId, vocabularyId, variantId, senseId, modes: ["readingMatch", "meaningMatch"], jlpt: classify(written, lists) });
      studyItemIds.push(studyId);
      // Conservative collision check: include alternate dictionary readings that
      // apply to this exact spelling and sense, even if not taught in this pack.
      const acceptedReadings = entry.kana.filter((k) => allowed(k.appliesToKanji, written) && allowed(sourceSense.appliesToKana, k.text)).map((k) => k.text);
      cards.push({ id: studyId, written, reading, labels, acceptedReadings });
    }
    bundle.collections.push({ id: `${theme}.intro`, titles: collection.titles, studyItemIds });
  }
  assert.equal(seen.size, Object.keys(selections).length, "Unused source selections");
  validateBundle(bundle);
  const outputs = { "vocabulary.json": bundle };
  for (const level of [...LEVELS, null]) {
    const file = level ? `vocabulary-${level.toLowerCase()}.json` : "vocabulary-unclassified.json";
    outputs[file] = partition(bundle, level); validateBundle(outputs[file]);
  }
  const conflicts = matchingConflicts(cards);
  outputs[`${DIR}/matching-conflicts.json`] = {
    schemaVersion: 1,
    description: "Do not put both listed study items on the same board for this mode/locale. This checks dictionary reading overlaps and identical labels, not all semantic ambiguity.",
    conflicts,
  };
  outputs[`${DIR}/build-report.json`] = {
    vocabularyCount: bundle.vocabulary.length,
    studyItemCount: bundle.studyItems.length,
    collectionCount: bundle.collections.length,
    locales: LOCALES,
    translationCount: bundle.vocabulary.length * LOCALES.length,
    dictionarySnapshot: manifest.snapshot,
    jlptBasis: "Hardest constituent kanji using repository lists; inferred kanji coverage, not verified vocabulary JLPT levels",
    countsByLevel: Object.fromEntries([...LEVELS, null].map((level) => [level ?? "unclassified", bundle.studyItems.filter((s) => s.jlpt.level === level).length])),
    unclassified: bundle.studyItems.filter((s) => s.jlpt.level === null).map((s) => ({ id: s.id, unlistedKanji: s.jlpt.unlistedKanji })),
    overlappingKanji: [...new Set(Object.values(lists).flat())].map((kanji) => ({ kanji, levels: LEVELS.filter((level) => lists[level].includes(kanji)) })).filter((k) => k.levels.length > 1),
    conflictCount: conflicts.length,
    reviewStatus: "draft",
  };
  return outputs;
}

function run(check) {
  const outputs = build();
  for (const [file, value] of Object.entries(outputs)) {
    const destination = path.join(ROOT, file), content = encode(value);
    if (check) assert.equal(fs.readFileSync(destination, "utf8"), content, `Stale generated file: ${file}; run npm run build:vocabulary`);
    else fs.writeFileSync(destination, content);
  }
  const report = outputs[`${DIR}/build-report.json`];
  console.log(`${check ? "Validated" : "Generated"} ${report.vocabularyCount} words, ${report.translationCount} draft translations, ${report.collectionCount} collections.`);
  console.log(JSON.stringify(report.countsByLevel));
  console.log(`${report.conflictCount} matching conflicts recorded; avoid these pairs in the specified mode/locale.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) run(process.argv.includes("--check"));
export { build, classify, makeFurigana, matchingConflicts, partition, validateBundle, verifySource };
