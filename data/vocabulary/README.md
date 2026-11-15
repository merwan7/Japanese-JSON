# Vocabulary data guide

This is a **draft starter corpus**, not a complete dictionary or a verified JLPT
vocabulary syllabus. It contains 300 entries, 300 study items, 30 themes, and 1,200
generated meaning labels across `en`, `es`, `de`, and `ar`.

## Files and exports

All seven root-level vocabulary files use the same bundle shape:

```json
{
  "schemaVersion": 1,
  "vocabulary": [],
  "studyItems": [],
  "collections": []
}
```

- `vocabulary.json` is the complete corpus.
- `vocabulary-n5.json` through `vocabulary-n1.json` are noncumulative partitions.
- `vocabulary-unclassified.json` retains entries with missing kanji classifications.
- Level bundles contain their referenced vocabulary, study items, and filtered
  theme collections; they have no dangling references into the complete corpus.
- `index.js` exports these as `vocabulary`, `vocabulary_n5` ... `vocabulary_n1`,
  and `vocabulary_unclassified`.
- `vocabulary_matching_conflicts` exports the matching-conflict report.

Use the complete corpus when you want collections spanning levels. To build a
cumulative N4 pool, combine N5 and N4 study items by stable ID. These partitions
have not yet been published to npm.

## Schema and identity

`vocabulary[]`:

- `id`: stable vocabulary identity, such as `vocab.mizu`.
- `kanji`: unique Han characters used in the written variants.
- `variants[]`: each `id` binds `written`, `reading`, and `furigana` together.
  Readings are kana, not romaji. The corpus deliberately selects one variant per
  word, but the structure supports additional variants.
- `senses[]`: each `id` identifies a selected meaning, with `variantIds` specifying
  which written/reading variants support it. `partOfSpeech` is a broad teaching
  category; precise upstream grammatical tags remain in the source extract.
- `translations`: keyed by language, with `label` and `reviewStatus` per locale.
  Labels are short teaching glosses, not exhaustive dictionary definitions.
- `usage`: selected dictionary sense tags/notes, including register information.
  For example, family words can carry humble-language usage notes. These English
  source notes are review material, not fully localized UI copy.
- `sourceRefs`: the dictionary `entryId`, zero-based `senseIndex`, local `senseId`,
  `sourceId`, and pinned `snapshot`. Sense indexes are snapshot-specific.
- `reviewStatus`: `draft` until the educational content is reviewed.

`studyItems[]` selects `vocabularyId` + `variantId` + `senseId` and lists supported
`modes`. This avoids randomly combining incompatible dictionary readings and
meanings. Keep progress separately by study-item ID and mode. A change to a label
must not change the stable sense or study-item ID.

`collections[]` contains an `id`, localized `titles`, and ordered `studyItemIds`.
Collection titles are also draft translations. Themes organize discovery; they
are not prevalidated matching boards.

## What the JLPT grouping means

Each study item includes a `jlpt` object:

```json
{
  "level": "N5",
  "basis": "repository-kanji-lists",
  "status": "inferred",
  "kanjiLevels": [{ "kanji": "水", "level": "N5" }],
  "unlistedKanji": []
}
```

The classifier uses the existing `kanji-array-n*.json` files without modifying
them. For a compound, the hardest constituent character determines the group.
On overlap, a character's easiest/earliest level wins (N5 before N4, etc.). There
are currently no overlapping characters in those source lists.

If a character is absent from all lists, `level` is `null`; the word is placed in
the unclassified file. Kana-only words likewise cannot be classified by this
method. Currently the unlisted characters are 椅, 鍵, 鞄, 鍋, and 袖.

**This is a kanji-coverage grouping, not a claim about the word's exam level.**
The existing repository already labels its kanji lists tentative. Beginner
vocabulary can use characters in a higher group; familiar compounds can also
have difficulty not captured by their component kanji. Do not use these inferred
levels as verified vocabulary-level labels in marketing or learner assessment.
Preserve `basis` and `status` when consuming the data.

## Furigana

Every `base` segment concatenates to the exact written form. Every segment's
`reading`, falling back to `base` when null, concatenates to the full kana reading.
Identical kana prefixes and suffixes are left unannotated:

```json
[
  { "base": "食", "reading": "た" },
  { "base": "べる", "reading": null }
]
```

Internal compound groups are annotated as a whole. For example, 今日 receives
きょう over the whole word. This avoids inventing per-character readings for
irregular words. A future reviewed segmentation layer can refine regular compounds
without changing word IDs. Full-word readings come from the source; segmentation
is generated and remains draft.

## Fair matching boards

Use the selected study-item ID as the pair identity, with separate tile identities
and roles (`written` vs `reading`, or `written` vs `meaning`). Do not use translated
labels as IDs, and do not assume different IDs imply different visible answers.

`matching-conflicts.json` lists pairs that must not share a board in the specified
mode and locale. Checks cover:

- Shared written forms and identical kana readings.
- A selected reading that is also an alternative dictionary reading for the
  other word's exact spelling and selected sense.
- Identical localized labels after Unicode normalization, whitespace normalization,
  and case folding. Case folding is deliberately conservative.

For example, 花 and 鼻 both read はな. Spanish `mañana` can represent both tomorrow
and morning. The source also accepts と as a reading for 十, so 十 and 戸 are flagged
even though the selected reading for 十 is じゅう.

These checks do not detect every synonymous translation or contextual ambiguity.
Native review and exercise design are still needed. Prefer avoiding collisions
over rejecting a linguistically valid answer. Meaning exercises may need a
qualifier or sentence when a selected sense is ambiguous in isolation.

## Editing, building, and reviewing

1. Edit `curation.json`: its `columns` array describes each compact multilingual
   row. Add words to a theme and keep editorial IDs stable.
2. Add an explicit selection in `source-selections.json`: `entryId`, zero-based
   `senseIndex`, stable `senseId`, and the selected source's exact `glosses`.
   Do not select a sense just because it is first in an array. Verify the meaning,
   part of speech, spelling restrictions, and reading restrictions.
3. Refresh the source extract if new entries are needed (command below).
4. Run `npm run build:vocabulary`, then `npm test`.
5. Review language quality, natural written forms, register, and exercise ambiguity.
   In particular, 鞄 is tagged as usually written in kana in the source; its kanji
   is retained here for deliberate character practice and needs editorial review.

Only after review, set an entry's optional `reviewStatus` and individual
`translationReviewStatus` language values to `reviewed` in `source-selections.json`,
recording review details there. Missing review fields generate `draft` statuses.
Reviewing one language does not automatically approve the other languages.

Do not hand-edit the generated root bundles or reports. Build output is
deterministic and uses two-space JSON formatting. The byte-pinned dictionary
extract and generated files are excluded from Prettier to keep checksums and
freshness checks stable. Normal build/test requires Node.js 18+ with no npm install.

Validation checks source restrictions, selected gloss stability, part of speech,
IDs, references, translation coverage, furigana reconstruction, dictionary/list
checksums, generated-file freshness, and partition integrity. Passing validation
means structurally consistent and linked to a dictionary source, not linguistically
reviewed in every language.

## Source maintenance

`source-entries.json` contains the unmodified full dictionary entries selected for
this corpus, so restrictions and alternate readings remain auditable offline.
`source-manifest.json` pins the converted release and its hashes, plus the five
kanji-list hashes used for classification. `source-selections.json` records the
editorial sense choices independently of current English display labels.

To check a newer dictionary release (Node.js 18+, built-in modules only):

```sh
node scripts/update-vocabulary-source.mjs --release latest
npm run build:vocabulary
npm test
```

Alternatively, use `npm run update:vocabulary-source -- --release latest`.
No npm install, Python, or external archive tools are required: the updater reads
the upstream `.json.tgz` asset in memory using Node's built-in gzip support.

Or pass a specific release tag instead of `latest`. The update script stops if a
selected sense's glosses moved/changed or an entry disappeared. Resolve that change
by reviewing the new source, then update the explicit selection and rerun. The
normal builder additionally rejects invalid spelling/reading/sense combinations.
Updating the dictionary does not automatically approve draft labels. Review and
reset previous review statuses whenever changed content warrants it.

If the repo's kanji lists change, deliberately update their manifest checksums,
rebuild, and review the reclassification diff. Do not silently replace unlisted
characters with an assumed level. Check upstream updates before a data release
and maintain an update process for applications distributing this corpus.

See [NOTICE.md](NOTICE.md) for attribution, changes, and licensing. `build-report.json`
records counts and classification gaps; it labels the corpus as draft.
