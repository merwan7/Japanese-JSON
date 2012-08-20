Japanese syllabary in JSON format
=================================

There are a few transformation functions that you can use in transform.js -- you can use them as an example on 
how to generate files that might be more useful to you.

This is obviously a work in progress:  
 
 - Verifying Kunrei-shiki romanization (ISO 3602) for rōmaji interpretations of the characters.
 - Yoon (compound characters) are next in line.
 - Looking at possibly organizing things in different schemas for easier uses.
 - My goal is to add modern Kanji as well, although obviously this will take a longer time.

Please contact me if you have suggestions, ideas or any questions.

Overview
---------

The original JSON schema is as follows:
                                                  leading character
                                                         |
                                                  -----------------
                                                  |   |   |   |   |
                                                  a   i   u   e   o
                                                  |   ...
                                              -----------------
                                              |       |       |
                                            Seion   Dakuon   Handakuon
                                              |       ...
                                       ---------------
                                       |      |      |
                                  Katakana Hiragana Romaji     
                                  
                                  
Caveats
-------

- The leading character for the simple syllables (a, i, u, e, o) is '-'.  
- The leading character for the single character representing 'n' is '*'.
- Not all characters have Dakuon (" or Dakuten) counterparts and only 1 set of characters has a Handakuon counterpart (&circ; or maru)