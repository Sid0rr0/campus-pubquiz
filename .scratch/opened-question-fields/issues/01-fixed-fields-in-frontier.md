# 01: Move the opened question's fixed fields into the live-edit frontier

**What to build:** A prefactor with no visible change. The list of saved question fields an **Opened question** keeps fixed (type, choices, match targets) moves out of the live-edit guard into the shared live-edit frontier module, which the quiz editor already reads its round rules from. The module exports it as a plain list or a small predicate. The guard reads it from there, so a save that changes a fixed field is refused exactly as today, with the same message.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The live-edit frontier module exports the opened question's fixed fields (type, choices, match targets)
- [ ] The live-edit guard holds no copy of its own and reads the exported list
- [ ] If exported as a predicate: one direct case in the live-edit frontier tests (fixed for type, choices, match targets; not for scoring mode, margin, answer, points)
- [ ] The live-edit guard spec and live-edit regrade specs pass unchanged
