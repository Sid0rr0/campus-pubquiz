# 10: Contract: delete the fake-store harness

**What to build:** Once no spec uses them, the fake gateway harness pieces are deleted: the fixed-data fake answer store and its sibling fakes, and the separate concurrent-sessions fake fixture module. The real-store harness becomes the only way to test through the gateway. This is the contract step of the expand–contract. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** 07, 08, 09

**Status:** ready-for-agent

- [ ] The fake answer store and the concurrent-sessions fake fixture module no longer exist, and nothing references them.
- [ ] The full backend test suite passes.
- [ ] Backend lint and build pass.
