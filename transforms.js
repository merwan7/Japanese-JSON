// Create simple jsons out of the big guy
// like this { Kana : Romaji } 
// i.e. {"ん": "n", ... }

function SimplestJSON(JapaneseJSON) {
	var KatakanaToRomaji = {};
	var HiraganaToRomaji = {};
	var RomajiToHiragana = {};
	var RomajiToKatakana = {};

 	for (var parent in JapaneseJSON) {
		if (JapaneseJSON.hasOwnProperty(parent)) {
			var vowels = JapaneseJSON[parent];

			for (var vowel in vowels) {
				if (vowels.hasOwnProperty(vowel)) {
					var types = vowels[vowel];

					for (var type in types) {
						if (types.hasOwnProperty(type)) {
							var character = types[type];

							HiraganaToRomaji[character["Hiragana"]] = character["Romaji"];
							KatakanaToRomaji[character["Katakana"]] = character["Romaji"];
							RomajiToHiragana[character["Romaji"]] 	= character["Hiragana"];
							RomajiToKatakana[character["Romaji"]] 	= character["Katakana"];
						}
					}
				}
			}
		}
	}
} 



// Create something a bit more complicated, but simpler than the big guy
// i.e. { k : [{ "カ" : "ka"}, ... ], ...}
function SimpleJSON(JapaneseJSON) {
	var RomajiToHiragana = {};
	var RomajiToKatakana = {};
	for (parent in JapaneseJSON) {
		if (JapaneseJSON.hasOwnProperty(parent)) {
			var vowels = JapaneseJSON[parent];

			RomajiToHiragana[parent] = [];
			RomajiToKatakana[parent] = [];

			for (vowel in vowels) {
				if (vowels.hasOwnProperty(vowel)) {
					var types = vowels[vowel];
					for (type in types) {
						if (types.hasOwnProperty(type)) {
							var character = types[type],
								tmp1 = character["Romaji"],
							 	tmpHiragana = {},
							 	tmpKatakana = {};

							 tmpHiragana[character["Romaji"]] = character["Hiragana"];
							 tmpKatakana[character["Romaji"]] = character["Katakana"];

							RomajiToHiragana[parent].push(tmpHiragana);
							RomajiToKatakana[parent].push(tmpKatakana);
						}
					}
				}
			}
		}
	} 
}