/**
 * Guards the sync + persistence mechanism that collaboration now relies on.
 *
 * The bug this exists to prevent: seeding two clients from a JSON snapshot
 * makes each build its own Y.Map objects, so the replicas share no CRDT
 * identity and merging duplicates every shape. Persisting and replaying the
 * Yjs update instead is idempotent.
 */
import { describe, it, expect } from 'vitest';
import { YjsGraphicModel } from '@/models/YjsGraphicModel';

const ids = (m: YjsGraphicModel) => m.snapshot.map(o => o.id).sort();

describe('Yjs sync and persistence', () => {
  it('replays a stored update without duplicating shapes', () => {
    const author = new YjsGraphicModel();
    author.add('rectangle');
    author.add('ellipse');
    const stored = author.encodeStateAsUpdate();

    const reader = new YjsGraphicModel();
    reader.applyRemoteUpdate(stored);

    expect(ids(reader)).toEqual(ids(author));
    expect(reader.snapshot).toHaveLength(2);
  });

  it('is idempotent — applying the same update twice changes nothing', () => {
    const author = new YjsGraphicModel();
    author.add('rectangle');
    const stored = author.encodeStateAsUpdate();

    const reader = new YjsGraphicModel();
    reader.applyRemoteUpdate(stored);
    reader.applyRemoteUpdate(stored);

    expect(reader.snapshot).toHaveLength(1);
  });

  it('converges two peers that exchange full state on connect', () => {
    // Mirrors the handshake: each side sends everything it has, and the
    // joiner asks peers for theirs.
    const a = new YjsGraphicModel();
    const b = new YjsGraphicModel();
    a.add('rectangle');
    b.add('ellipse');

    b.applyRemoteUpdate(a.encodeStateAsUpdate());
    a.applyRemoteUpdate(b.encodeStateAsUpdate());

    expect(ids(a)).toEqual(ids(b));
    expect(a.snapshot).toHaveLength(2);
  });

  it('does not duplicate when a late joiner is seeded then synced', () => {
    const author = new YjsGraphicModel();
    author.add('rectangle');
    const stored = author.encodeStateAsUpdate();

    // Late joiner loads persisted state, THEN a peer answers its request
    // with the same content. This double-delivery must not duplicate.
    const joiner = new YjsGraphicModel();
    joiner.applyRemoteUpdate(stored);
    joiner.applyRemoteUpdate(author.encodeStateAsUpdate());

    expect(joiner.snapshot).toHaveLength(1);
    expect(ids(joiner)).toEqual(ids(author));
  });

  it('local edits after sync propagate without clobbering peer state', () => {
    const a = new YjsGraphicModel();
    const b = new YjsGraphicModel();
    a.add('rectangle');
    b.applyRemoteUpdate(a.encodeStateAsUpdate());

    b.add('text');
    a.applyRemoteUpdate(b.encodeStateAsUpdate());

    expect(a.snapshot).toHaveLength(2);
    expect(ids(a)).toEqual(ids(b));
  });
});
