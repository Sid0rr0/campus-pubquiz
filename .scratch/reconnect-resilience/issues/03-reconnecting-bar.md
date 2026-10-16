# 03: An obvious reconnecting bar with "Tap to reconnect"

**What to build:** On `/play`, the inline magenta connection text is replaced by a full-width bar fixed to the top while the phone isn't connected ("Connection lost — reconnecting…"). After `RECONNECT_HELP_DELAY_MS` (10 s) without reconnecting, the bar adds a "Tap to reconnect" button that calls `forceReconnect`. Join errors and kick notices keep their current presentation; only the connection state uses the bar.

Parent spec: `.scratch/reconnect-resilience/spec.md`

**Blocked by:** —

**Status:** done

- [x] The bar shows while reconnecting and hides on reconnect
- [x] The button appears only after 10 s (fake timers) and calls `forceReconnect`
- [x] The bar is announced to screen readers (`role="alert"`) and doesn't cover the answer form's submit button
