// Create simple jsons out of the big guy
// like this { Kana : Romaji }
// i.e. {"ん": "n", ... }

const KatakanaToRomaji = {};
const HiraganaToRomaji = {};
const RomajiToHiragana = {};
const RomajiToKatakana = {};

function SimplestJSON(JapaneseJSON) {
  for (const [parent, vowels] of Object.entries(JapaneseJSON)) {
    for (const [vowel, types] of Object.entries(vowels)) {
      for (const [type, character] of Object.entries(types)) {
        HiraganaToRomaji[character.Hiragana] = character.Romaji;
        KatakanaToRomaji[character.Katakana] = character.Romaji;
        RomajiToHiragana[character.Romaji] = character.Hiragana;
        RomajiToKatakana[character.Romaji] = character.Katakana;
      }
    }
  }

  return {
    HiraganaToRomaji,
    KatakanaToRomaji,
    RomajiToHiragana,
    RomajiToKatakana,
  };
}

// Create something a bit more complicated, but simpler than the big guy
// i.e. { k : [{ "カ" : "ka"}, ... ], ...}
const RomajiToHiragana = {};
const RomajiToKatakana = {};

function SimpleJSON(JapaneseJSON) {
  for (const [parent, vowels] of Object.entries(JapaneseJSON)) {
    RomajiToHiragana[parent] = [];
    RomajiToKatakana[parent] = [];

    for (const [vowel, types] of Object.entries(vowels)) {
      for (const [type, character] of Object.entries(types)) {
        const tmp1 = character.Romaji;
        const tmpHiragana = {};
        const tmpKatakana = {};

        tmpHiragana[character.Romaji] = character.Hiragana;
        tmpKatakana[character.Romaji] = character.Katakana;

        RomajiToHiragana[parent].push(tmpHiragana);
        RomajiToKatakana[parent].push(tmpKatakana);
      }
    }
  }

  return { RomajiToHiragana, RomajiToKatakana };
}

function kanjiFirstOnKun(kanjiJSON) {
  const normalizedKanji = {};
  for (const [key, value] of Object.entries(kanjiJSON)) {
    normalizedKanji[key] = {};
    if (value.Kun.length) {
      normalizedKanji[key].Kun = value.Kun[0];
    }

    if (value.On.length) {
      normalizedKanji[key].On = value.On[0];
    }
  }

  return normalizedKanji;
}
