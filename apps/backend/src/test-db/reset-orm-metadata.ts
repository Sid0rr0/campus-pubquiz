import { MetadataStorage } from '@mikro-orm/core';

// MikroORM keeps its entity metadata on globalThis, and Jest lets that registry
// survive from one test file into the next when one process runs them in turn.
// The Maps the earlier file built belong to its realm, so MikroORM's clone()
// (an `instanceof Map` check) copies them as plain objects and the next file's
// ORM fails with "Map.prototype.set called on incompatible receiver", which
// Jest then reports with an empty message. Every file starts from an empty registry.
MetadataStorage.clear();
