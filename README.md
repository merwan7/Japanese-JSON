# Japanese syllabary in JSON format

There are a few transformation functions that you can use in transform.js -- you can use them as an example on how to generate files that might be more useful to you.

This is obviously a work in progress. In the future, I will be working on these aspects of the data set:

- Verifying Kunrei-shiki romanization (ISO 3602) for rōmaji interpretations of the characters.
- Looking at possibly organizing things in different schemas for easier uses.
- My goal is to add modern Kanji as well, although obviously this will take a longer time.

Please contact me if you have suggestions, ideas or any questions.

You can use this data by installing it from npm like this:

`npm i japanese-json`

## Vocabulary for learning games

The repository now includes a draft vocabulary dataset with 150 words, 15 themed
collections, and English, Spanish, German, and Arabic meaning labels. Each word has
an explicitly selected spelling, kana reading, furigana, and dictionary sense.

```js
const { vocabulary, vocabulary_n5 } = require("japanese-json");

console.log(vocabulary.vocabulary[0].variants[0]);
// { id: 'written-mizu', written: '水', reading: 'みず', furigana: [...] }

console.log(vocabulary_n5.studyItems[0].jlpt);
// { level: 'N5', basis: 'repository-kanji-lists', status: 'inferred', ... }
```

These new exports are in this checkout; the existing published npm version will
not include them until a release is published. No existing exports were removed.

| File | Words |
| --- | ---: |
| `vocabulary.json` | 150 |
| `vocabulary-n5.json` | 47 |
| `vocabulary-n4.json` | 62 |
| `vocabulary-n3.json` | 26 |
| `vocabulary-n2.json` | 9 |
| `vocabulary-n1.json` | 3 |
| `vocabulary-unclassified.json` | 3 |

**The level files represent inferred kanji coverage, not verified JLPT vocabulary
levels.** Each word is grouped by the hardest constituent kanji according to this
repository's existing arrays. Words with unlisted kanji remain unclassified.
For example, an everyday word can land in a higher group because one character is
assigned there in the existing arrays. This starter is not an exam syllabus.

All vocabulary and translation review statuses begin as `draft`. Dictionary
validation checks spelling/reading/sense compatibility; it does not constitute
native-speaker review of the generated translations or pedagogical choices.

See [the data guide](data/vocabulary/README.md) for the schema, source attribution,
editing workflow, and matching-conflict rules.

```sh
npm run build:vocabulary
npm test
```

Building, testing, and refreshing vocabulary requires Node.js 18+ and no installed
npm dependencies. To refresh the dictionary source, run
`node scripts/update-vocabulary-source.mjs --release latest`. The existing release
tools are separate.

## Overview

The schema is layed out as follows:

```text
                leading character
                        |
                -----------------------------
                |   |   |   |   |   |   |   |
                a   i   u   e   o   ya  yu  yo
                |   ...
            -----------------
            |       |       |
          Seion   Dakuon   Handakuon
            |       ...
      ---------------
      |      |      |
Katakana Hiragana Romaji
```

Here's a snippet for the `ka` syllable

```json
"k": {
  "a": {
      "Seion": {
          "Katakana": "カ",
          "Hiragana": "か",
          "Romaji": "ka"
      },
      "Dakuon": {
          "Katakana": "ガ",
          "Hiragana": "が",
          "Romaji": "ga"
      }
  }
}
```

## Caveats

- The leading character for the vowel characters (a, i, u, e, o) is '-'.
- The leading character for the single character representing 'n' is '\*'.
- Not all characters have Dakuon (&#12441; or Dakuten) counterparts and only 1 set of characters has a Handakuon counterpart (&#12442; or Handakuten)
- compound characters (Yōon digraphs) are denoted by the keys `ya`, `yu`, and `yo`
- The kanji in the arrays kanji-n1...n5.json are tentative and not fully verified. Also there's varying info about the JLPT levels and kanji, so please don't use this as a source of truth.

## License

Existing kana/kanji files and code are covered by the [MIT license](LICENSE).
The new vocabulary data is derived from JMdict and distributed under CC BY-SA 4.0.
See [LICENSES.md](LICENSES.md) and [the vocabulary attribution](data/vocabulary/NOTICE.md)
for file scopes and upstream notices.
