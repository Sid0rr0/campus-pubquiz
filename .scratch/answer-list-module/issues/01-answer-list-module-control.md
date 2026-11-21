# 01: The Answer list module, with /control grading on it

**What to build:** A quiz master grading on `/control` sees the picked question's Answer list straight away. It stays current as teams answer and grades change, isn't replaced or hidden by broadcasts for other questions, never goes backwards when a late read finishes after a newer broadcast, and reloads after a reconnect. Behind this, a new **Answer list** hook takes a join code and a question id (or none) and returns that question's Answer list, or nothing. Its data lives in the shared query cache under the existing per-question answers key: the REST read fills the entry, and the admin game hook's answers broadcast listener writes each broadcast into its question's entry. A broadcast arriving while that question's read is in flight wins. A reconnect re-reads. A failed read shows the existing "Could not load answers" toast. The answers panel and the question detail read from the hook. The control page's own load/focus/reconnect hook and the readers' question-id checks are deleted. The admin game hook loses its live answers setter and focus call. Its live answers slot stays only for `/remote`, which never set the focus, so `/remote` behaves as before. See the spec's "The Answer list module", "The admin game hook" and "Readers".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Hook tests through its interface (fake socket, real query client, stubbed REST read): the read fills the list; a broadcast for that question updates it; a broadcast for another question leaves it alone; switching question returns the new question's list, never the old one's; a broadcast during an in-flight read isn't overwritten by the read; a reconnect re-reads; a session change shows no previous-session answers; no question returns nothing and reads nothing; a failed read toasts
- [ ] `/control` grading and question detail page tests give the page an Answer list instead of stubbing the live answers, setter and focus members, and still pass
- [ ] The admin game hook's interface has no live answers setter or focus call; its tests drop those cases and keep "an answers broadcast reaches the Answer list of its question"
- [ ] `/remote`'s "N correct" behaves as before
- [ ] `GLOSSARY.md` has an **Answer list** entry near **Grading**
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
