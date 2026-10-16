# 01: The fun facts module and the display view field

**What to build:** A pure module that, given the session's revealed blocks (answers with verdicts, points and response times; question text and type) and its bonus awards, returns the ordered fun facts listed in the spec. Each fact is a typed object, not a sentence, so `/display` words it. The display view gains `funFacts`, filled only while the break screen is on air, from revealed blocks plus figures that give nothing away. It is never filled from the block in play.

Parent spec: `.scratch/break-fun-facts/spec.md`

**Blocked by:** —

**Status:** done

- [x] Unit tests for every fact, including the skip-when-no-data cases
- [x] A test that the block in play never contributes (e.g. a question nobody answered right in the block in play doesn't appear)
- [x] The first break yields only "answers so far" and "bonus awards so far"
- [x] The display view carries `funFacts` on the break screen and nowhere else
- [x] `DOCUMENTATION.md` (snapshot section) documents `funFacts`; `GLOSSARY.md` already has **Fun fact**
