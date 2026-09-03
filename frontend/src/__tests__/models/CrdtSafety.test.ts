/**
 * Concurrency invariants for the shape model.
 *
 * Snapshot equality is NOT a correctness test: two peers converge happily on a
 * document with a shape duplicated. These assert the invariants instead.
 */
import { describe, it, expect } from 'vitest';
import { YjsGraphicModel } from '@/models/YjsGraphicModel';
import { GraphicObjectInterface, GroupInterface } from '@/models/GraphicObjectInterface';

/** Every id in the tree, at any depth. */
const allIds = (objs: GraphicObjectInterface[]): string[] =>
  objs.flatMap(o =>
    o.type === 'group' ? [o.id, ...allIds((o as GroupInterface).children)] : [o.id]
  );

const findDeep = (objs: GraphicObjectInterface[], id: string): GraphicObjectInterface | undefined => {
  for (const o of objs) {
    if (o.id === id) return o;
    if (o.type === 'group') {
      const hit = findDeep((o as GroupInterface).children, id);
      if (hit) return hit;
    }
  }
  return undefined;
};

/** Fork two peers from a common ancestor. */
const fork = (seed: (m: YjsGraphicModel) => void) => {
  const base = new YjsGraphicModel();
  seed(base);
  const state = base.encodeStateAsUpdate();
  const a = new YjsGraphicModel();
  const b = new YjsGraphicModel();
  a.applyRemoteUpdate(state);
  b.applyRemoteUpdate(state);
  return { a, b };
};

const sync = (a: YjsGraphicModel, b: YjsGraphicModel) => {
  const ua = a.encodeStateAsUpdate();
  const ub = b.encodeStateAsUpdate();
  a.applyRemoteUpdate(ub);
  b.applyRemoteUpdate(ua);
};

describe('CRDT safety under concurrent edits', () => {
  it('concurrent reorder of the same shape does not duplicate it', () => {
    let ids: string[] = [];
    const { a, b } = fork(m => {
      m.add('rectangle');
      m.add('ellipse');
      m.add('text');
      ids = m.snapshot.map(o => o.id);
    });

    a.reorder(ids[0], 2);
    b.reorder(ids[0], 2);
    sync(a, b);

    const seen = allIds(a.snapshot);
    expect(seen).toHaveLength(new Set(seen).size); // no duplicates
    expect(seen).toHaveLength(3);
    expect(allIds(b.snapshot).sort()).toEqual(seen.sort());
  });

  it('a property edit concurrent with a reorder is not discarded', () => {
    let target = '';
    const { a, b } = fork(m => {
      m.add('rectangle');
      m.add('ellipse');
      target = m.snapshot[0].id;
    });

    a.update([target], { color: 'BLUE' });
    b.reorder(target, 1);
    sync(a, b);

    expect(findDeep(a.snapshot, target)?.color).toBe('BLUE');
    expect(findDeep(b.snapshot, target)?.color).toBe('BLUE');
  });

  it('concurrent grouping of the same shapes does not duplicate children', () => {
    let ids: string[] = [];
    const { a, b } = fork(m => {
      m.add('rectangle');
      m.add('ellipse');
      ids = m.snapshot.map(o => o.id);
    });

    a.group(ids);
    b.group(ids);
    sync(a, b);

    const seen = allIds(a.snapshot);
    const shapes = seen.filter(id => ids.includes(id));
    expect(shapes).toHaveLength(new Set(shapes).size);
    expect(shapes.sort()).toEqual([...ids].sort());
  });

  it('a property edit concurrent with grouping is not discarded', () => {
    let ids: string[] = [];
    const { a, b } = fork(m => {
      m.add('rectangle');
      m.add('ellipse');
      ids = m.snapshot.map(o => o.id);
    });

    a.update([ids[0]], { color: 'BLUE' });
    b.group(ids);
    sync(a, b);

    expect(findDeep(a.snapshot, ids[0])?.color).toBe('BLUE');
  });

  it('every id appears exactly once in the tree after concurrent edits', () => {
    let ids: string[] = [];
    const { a, b } = fork(m => {
      m.add('rectangle');
      m.add('ellipse');
      m.add('text');
      ids = m.snapshot.map(o => o.id);
    });

    a.reorder(ids[2], 0);
    b.group([ids[0], ids[1]]);
    sync(a, b);

    const seen = allIds(a.snapshot);
    expect(seen).toHaveLength(new Set(seen).size);
    ids.forEach(id => expect(findDeep(a.snapshot, id)).toBeDefined());
  });
});
