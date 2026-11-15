# Vocabulary attribution

This vocabulary dataset uses the **JMdict (Japanese-Multilingual Dictionary)**
files. JMdict is the property of the **Electronic Dictionary Research and
Development Group**, and is used in conformance with the Group's licence.
The upstream notice identifies copyright held by James William Breen and EDRDG.

- [JMdict project and documentation](https://www.edrdg.org/jmdict/j_jmdict.html)
- [EDRDG General Dictionary Licence Statement](https://www.edrdg.org/edrdg/licence.html)
- [Bundled copy of that statement](EDRDG-LICENSE.html)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

The source was obtained through [scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified).
The exact release, download URL, dictionary date, and checksums are recorded in
`source-manifest.json`. The release used for this dataset is
`3.6.2+20261109214828`, containing the English common-word dictionary dated
2026-11-09.

Changes made for Japanese-JSON:

- Selected 300 word/sense combinations and their Japanese spellings/readings.
- Added simplified English labels and generated Spanish, German, and Arabic
  translations. The non-English labels were not imported from JMdict language editions.
- Added furigana segments, stable application IDs, study items, themed collections,
  and inferred kanji-list groupings.
- Recorded possible matching conflicts.

All new vocabulary JSON data is distributed under CC BY-SA 4.0. Generated labels,
furigana, and lesson selections remain drafts and are not endorsed by EDRDG.

Applications distributing this data should retain attribution and the upstream
notice/links. The EDRDG statement discusses commercial use, app acknowledgements,
and source updates. The refresh procedure is in [README.md](README.md).
