# 01: The big screen keeps its session through a dropped connection

**What to build:** `useGameConnection` reports whether it is `reconnecting` or `refused` (the server disconnected the socket, e.g. "Unknown game session code"). `/display` goes back to the picker only on `refused`. On `reconnecting` it keeps showing the last frame with a small "Reconnecting…" corner badge and resyncs when the socket comes back. The display remembers the last code it showed in localStorage (try/catch), and `/display` without `?code=` resumes that code, falling back to the picker if it's refused. The lobby screen gains a small "Pick another game" link.

Parent spec: `.scratch/reconnect-resilience/spec.md`

**Blocked by:** —

**Status:** done

- [x] `useGameConnection`: a transient disconnect yields `reconnecting` and keeps the snapshot; `io server disconnect` yields `refused`
- [x] `/display`: `reconnecting` keeps the current screen and shows the badge; `refused` shows the picker and clears the stored code
- [x] `/display` with no `?code=` resumes the stored code; an unknown stored code falls back to the picker
- [x] Storage reads and writes are wrapped in try/catch, and the page works with storage unavailable
- [x] `DOCUMENTATION.md` (The Three UIs) and the `/guide` page say the big screen reconnects on its own
