# 01: The Quiz mode module, with the server's refusals going through it

**What to build:** One shared module states what each quiz mode allows, and the server refuses quickfire settings, leagues and coin awards through it. The quiz master sees the same refusals with the same messages as today; the difference is that the rule now lives in one place both apps can import.

Parent spec: `.scratch/quiz-mode-module/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A shared-types module beside the quiz mode list holds one table of what each mode allows (jokers, power-ups, coins, leagues, the quickfire question timer: pub allows all but the timer, quickfire only the timer) and derives from it: the settings refusal (mode, settings patch, league ids → first message or none, checking only what the patch names, in today's order and wording), the settings to send (quickfire drops the coin settings), the settings a mode plays with (disallowed features switched off, every field still present), and "is quickfire". Every function tickets 02–04 need is added here, so they don't edit this file.
- [ ] The league and coin-award refusal messages move into the module unchanged.
- [ ] A Vitest table test per mode covers what it allows, plus the refusal cases (each disallowed setting named, unrelated settings accepted, league ids, the order, pub refusing nothing), the settings to send, and the settings a mode plays with. The backend's existing settings-refusal cases move here.
- [ ] Session creation, the lobby's settings and league save, league assignment, coin awards, the running-sessions summary and the quickfire-quiz check all ask the module; the backend's own quickfire session rules file is deleted.
- [ ] The existing sessions controller, league service, league changes and bonus awards specs pass unchanged.
- [ ] `GLOSSARY.md`'s **Quiz mode** entry says a quickfire quiz's sessions have no jokers, power-ups, coins or leagues, if it doesn't already.
- [ ] `pnpm crap:changed` passes; `pnpm mutate:changed` leaves no survivors in the module.
