# Free text is excluded from quickfire rounds

Quickfire rounds accept only `multiple_choice`, `sort`, `match` and `number` questions. `free_text` is left out even though it grades itself on submit, the same as those three. A quickfire round is a race in which faster answers score more, and a typed answer adds typing speed and spelling to that race, so the quickfire-allowed list is its own explicit list rather than being derived from the auto-graded types. The quiz editor only offers quickfire-allowed types in a quickfire round, and won't let quickfire mode be switched on while a round holds a disallowed question.

`number` is typed too, but it is allowed: its answer is a few digits on a number keypad with nothing to misspell, so it adds little to the race beyond what tapping a choice does (see ADR 0003).
