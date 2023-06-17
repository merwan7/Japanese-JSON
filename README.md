# Japanese syllabary in JSON format

There are a few transformation functions that you can use in transform.js -- you can use them as an example on how to generate files that might be more useful to you.

This is obviously a work in progress. In the future, I will be working on these aspects of the data set:

- Verifying Kunrei-shiki romanization (ISO 3602) for rōmaji interpretations of the characters.
- Looking at possibly organizing things in different schemas for easier uses.
- My goal is to add modern Kanji as well, although obviously this will take a longer time.

Please contact me if you have suggestions, ideas or any questions.

You can use this data by installing it from npm like this:

`npm i japanese-json`

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

MIT license. See LICENSE file for details.
