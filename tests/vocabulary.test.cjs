const test = require("node:test");
const assert = require("node:assert/strict");
const { build, classify, makeFurigana, matchingConflicts, partition, validateBundle, verifySource } = require("../scripts/vocabulary.cjs");
const outputs = build();
const bundle = outputs["vocabulary.json"];
const clone = () => structuredClone(bundle);

test("all level bundles partition the complete dataset without dropping unclassified words", () => {
  const files = [5, 4, 3, 2, 1].map((n) => `vocabulary-n${n}.json`).concat("vocabulary-unclassified.json");
  const ids = files.flatMap((file) => outputs[file].studyItems.map((s) => s.id));
  assert.equal(ids.length, 150);
  assert.equal(new Set(ids).size, 150);
  assert.deepEqual(ids.sort(), bundle.studyItems.map((s) => s.id).sort());
  files.forEach((file) => assert(validateBundle(outputs[file])));
});

test("kanji grouping uses the hardest known constituent and earliest introduction on overlap", () => {
  const lists = { N5: ["水", "日"], N4: ["曜", "水"], N3: [], N2: [], N1: [] };
  assert.equal(classify("水曜日", lists).level, "N4");
  assert.equal(classify("水", lists).level, "N5");
  const missing = classify("水椅", lists);
  assert.equal(missing.level, null);
  assert.deepEqual(missing.unlistedKanji, ["椅"]);
  assert.equal(classify("ありがとう", lists).level, null);
});

test("unlisted characters remain explicit instead of being silently assigned N1", () => {
  const unknown = partition(bundle, null);
  assert.deepEqual(unknown.vocabulary.map((v) => v.variants[0].written), ["椅子", "鍵", "鞄"]);
  assert(unknown.studyItems.every((s) => s.jlpt.unlistedKanji.length));
});

test("furigana preserves okurigana and groups irregular readings", () => {
  assert.deepEqual(makeFurigana("生きる", "いきる"), [{ base: "生", reading: "い" }, { base: "きる", reading: null }]);
  assert.deepEqual(makeFurigana("今日", "きょう"), [{ base: "今日", reading: "きょう" }]);
  assert.deepEqual(makeFurigana("ご飯", "ごはん"), [{ base: "ご", reading: null }, { base: "飯", reading: "はん" }]);
  assert.deepEqual(makeFurigana("こんにちは", "こんにちは"), [{ base: "こんにちは", reading: null }]);
});

test("invalid furigana, duplicate IDs, and broken references fail validation", () => {
  let invalid = clone(); invalid.vocabulary[0].variants[0].furigana[0].reading = "すい";
  assert.throws(() => validateBundle(invalid), /Furigana reading mismatch/);
  invalid = clone(); invalid.vocabulary.push(invalid.vocabulary[0]);
  assert.throws(() => validateBundle(invalid), /Duplicate vocabulary ID/);
  invalid = clone(); invalid.studyItems[0].variantId = "missing";
  assert.throws(() => validateBundle(invalid), /Dangling variant/);
  invalid = clone(); invalid.collections[0].studyItemIds.push("study.missing");
  assert.throws(() => validateBundle(invalid), /Dangling study/);
});

test("missing translations and sense-to-variant mismatches fail validation", () => {
  let invalid = clone(); delete invalid.vocabulary[0].senses[0].translations.ar;
  assert.throws(() => validateBundle(invalid), /Missing ar translation/);
  invalid = clone(); invalid.vocabulary[0].senses[0].variantIds = ["missing"];
  assert.throws(() => validateBundle(invalid));
});

test("source verification enforces both reading and meaning restrictions", () => {
  const entry = {
    id: "1", kanji: [{ text: "甲" }, { text: "乙" }],
    kana: [{ text: "こう", appliesToKanji: ["甲"] }, { text: "おつ", appliesToKanji: ["乙"] }],
    sense: [{ appliesToKanji: ["甲"], appliesToKana: ["こう"], partOfSpeech: ["n"], gloss: [{ text: "example" }] }],
  };
  const selection = { entryId: "1", senseIndex: 0, glosses: ["example"] };
  assert(verifySource(entry, selection, "甲", "こう", "noun"));
  assert.throws(() => verifySource(entry, selection, "乙", "こう", "noun"), /Invalid reading/);
  assert.throws(() => verifySource(entry, selection, "乙", "おつ", "noun"), /Sense restriction/);
  assert.throws(() => verifySource(entry, { ...selection, glosses: ["changed"] }, "甲", "こう", "noun"), /Source gloss changed/);
});

test("matching conflicts include homophones, alternate readings, and localized duplicate labels", () => {
  const conflicts = outputs["data/vocabulary/matching-conflicts.json"].conflicts;
  const has = (mode, a, b, locale) => conflicts.some((c) => c.mode === mode && c.locale === locale && c.studyItemIds.includes(a) && c.studyItemIds.includes(b));
  assert(has("readingMatch", "study.hana.flower", "study.hana-nose.nose"));
  assert(has("readingMatch", "study.juu.ten", "study.to.door"));
  assert(has("meaningMatch", "study.ashita.tomorrow", "study.asa.morning", "es"));
  assert(has("meaningMatch", "study.ashita.tomorrow", "study.asa.morning", "de"));
  const labels = (word) => ({ en: word, es: word, de: word, ar: word });
  assert.equal(matchingConflicts([
    { id: "a", written: "水", reading: "みず", acceptedReadings: ["みず"], labels: labels("water") },
    { id: "b", written: "山", reading: "やま", acceptedReadings: ["やま"], labels: labels("mountain") },
  ]).length, 0);
});

test("legacy npm exports remain available alongside the new datasets", () => {
  const pkg = require("../index.js");
  for (const key of ["kana", "kanji_map_n5", "kanji_array_n1", "kanji_array_n2", "kanji_array_n3", "kanji_array_n4", "kanji_array_n5"]) assert(pkg[key]);
  assert.equal(pkg.vocabulary.vocabulary.length, 150);
  assert.equal(pkg.vocabulary_n5.schemaVersion, 1);
  assert(pkg.vocabulary_matching_conflicts.conflicts.length > 0);
});
