# 03: Teams see the margin and the accepted range

**What to build:** While a Number question is open, the phones and the big screen show its **margin** under the prompt, for example "within 10%" or "within 5". This tells teams how precise they need to be. On reveal, both show the key followed by the accepted range, for example "200 · 180–220 accepted", so everyone can see why a near miss did or didn't count. All of this text comes from one shared formatter, so phones and big screen never disagree. Numbers show at most 2 decimal places, with trailing zeros dropped. Grading always uses the exact range, never the rounded text.

This works with the 10% default margin from 01, and shows custom margins once 02 lands.

**Blocked by:** 01 (Number question type with a fixed 10% margin)

**Status:** done

- [ ] A shared formatter turns a key and margin into the margin text and the accepted range:
  - "within 10%", "within 2.5%", "within 5";
  - "180–220", "1772.1–2165.9";
  - negative keys give a correctly ordered range;
  - margin 0 gives a single value.
- [ ] Number questions carry their margin in the views the phones and big screen receive. No other type gets a margin.
- [ ] The phone shows the margin text under the prompt while the question is open, and the key plus the accepted range on reveal.
- [ ] The big screen shows the margin text while the question is up, and the key plus the accepted range on reveal.
- [ ] Component tests cover both surfaces, next to the existing display reveal and play answer tests.
