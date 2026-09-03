import { describe, it, expect } from 'vitest';
import { YjsGraphicModel } from '@/models/YjsGraphicModel';
import { GraphicObjectInterface } from '@/models/GraphicObjectInterface';

const sample: GraphicObjectInterface[] = [
  {
    id: 'rect-1',
    title: 'my rect',
    type: 'rectangle',
    color: '#ff0000',
    position: { x: 100, y: 200 },
    rotation: 45,
    scale: { width: 50, height: 30 },
  },
  {
    id: 'group-1',
    title: 'my group',
    type: 'group',
    color: 'transparent',
    position: { x: 0, y: 0 },
    rotation: 0,
    children: [
      {
        id: 'ellipse-1',
        title: 'nested ellipse',
        type: 'ellipse',
        color: '#00ff00',
        position: { x: 10, y: 20 },
        rotation: 0,
        scale: { width: 30, height: 40 },
      },
    ],
  },
];

describe('YjsGraphicModel', () => {
  // ---- lifecycle ----
  it('starts with an empty snapshot', () => {
    const model = new YjsGraphicModel();
    expect(model.snapshot).toEqual([]);
  });

  it('round-trips objects via restore() and snapshot', () => {
    const model = new YjsGraphicModel();
    model.restore(sample);
    const result = model.snapshot;
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('rect-1');
    expect(result[1].type).toBe('group');
    const group = result[1] as { children: GraphicObjectInterface[] };
    expect(group.children).toHaveLength(1);
    expect(group.children[0].id).toBe('ellipse-1');
  });

  it('fires subscribers on changes', () => {
    const model = new YjsGraphicModel();
    let callCount = 0;
    const unsub = model.subscribe(() => callCount++);
    model.restore(sample);
    expect(callCount).toBe(1);
    unsub();
    model.restore([]);
    expect(callCount).toBe(1);
  });

  // ---- mutations ----
  it('add() creates an object and inserts at index 0', () => {
    const model = new YjsGraphicModel();
    const obj = model.add('rectangle');
    expect(obj.type).toBe('rectangle');
    expect(obj.id).toBeTruthy();
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].id).toBe(obj.id);
    const obj2 = model.add('ellipse');
    expect(model.snapshot).toHaveLength(2);
    expect(model.snapshot[0].id).toBe(obj2.id);
    expect(model.snapshot[1].id).toBe(obj.id);
  });

  it('insertObject() adds a pre-existing object and is idempotent', () => {
    const model = new YjsGraphicModel();
    model.insertObject(sample[0]);
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].id).toBe('rect-1');
    model.insertObject(sample[0]);
    expect(model.snapshot).toHaveLength(1);
  });

  it('remove() deletes matching objects by id', () => {
    const model = new YjsGraphicModel();
    model.restore(sample);
    expect(model.snapshot).toHaveLength(2);
    model.remove(['rect-1']);
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].id).toBe('group-1');
    model.remove(['nonexistent']);
    expect(model.snapshot).toHaveLength(1);
    model.remove([]);
    expect(model.snapshot).toHaveLength(1);
  });

  it('update() patches scalar and nested properties', () => {
    const model = new YjsGraphicModel();
    model.restore(sample);
    model.update(['rect-1'], {
      color: '#0000ff',
      rotation: 90,
    } as Partial<GraphicObjectInterface>);
    expect(model.snapshot[0].color).toBe('#0000ff');
    expect(model.snapshot[0].rotation).toBe(90);
    model.update(['rect-1'], {
      position: { x: 999 },
    } as Partial<GraphicObjectInterface>);
    expect(model.snapshot[0].position).toEqual({ x: 999, y: 200 });
    model.update([], { color: '#bad' } as Partial<GraphicObjectInterface>);
    expect(model.snapshot[0].color).toBe('#0000ff');
  });

  it('move() shifts top-level and nested objects by delta', () => {
    const model = new YjsGraphicModel();
    model.restore(sample);
    model.move(['rect-1'], { x: 50, y: -30 });
    expect(model.snapshot[0].position).toEqual({ x: 150, y: 170 });
    model.move(['ellipse-1'], { x: 5, y: 5 });
    const group = model.snapshot[1] as { children: GraphicObjectInterface[] };
    expect(group.children[0].position).toEqual({ x: 15, y: 25 });
    model.move([], { x: 100, y: 100 });
    expect(model.snapshot[0].position).toEqual({ x: 150, y: 170 });
  });

  it('group() wraps selected objects into a new group', () => {
    const model = new YjsGraphicModel();
    const r1 = model.add('rectangle');
    const r2 = model.add('ellipse');
    const group = model.group([r1.id, r2.id]);
    expect(group).toBeDefined();
    expect(group!.type).toBe('group');
    expect(group!.children).toHaveLength(2);
    const snap = model.snapshot;
    expect(snap).toHaveLength(1);
    expect(snap[0].type).toBe('group');
    const g = snap[0] as { children: GraphicObjectInterface[] };
    expect(g.children).toHaveLength(2);
    expect(model.group([r1.id])).toBeUndefined();
  });

  it('ungroup() unwraps a group and releases its children', () => {
    const model = new YjsGraphicModel();
    model.restore(sample);
    // sample has group-1 with ellipse-1 inside
    const released = model.ungroup(['group-1']);
    expect(released).toBeDefined();
    expect(released!).toHaveLength(1);
    expect(released![0].id).toBe('ellipse-1');
    // Group is gone, ellipse is now top-level
    const snap = model.snapshot;
    expect(snap).toHaveLength(2);
    expect(snap.every(o => o.type !== 'group')).toBe(true);
    // Empty ids returns undefined
    expect(model.ungroup([])).toBeUndefined();
  });

  it('reorder() moves an object to a new index', () => {
    const model = new YjsGraphicModel();
    const r1 = model.add('rectangle');
    const r2 = model.add('ellipse');
    const r3 = model.add('text');
    // r3 at 0, r2 at 1, r1 at 2
    expect(model.snapshot.map(o => o.id)).toEqual([r3.id, r2.id, r1.id]);
    model.reorder(r3.id, 2);
    expect(model.snapshot.map(o => o.id)).toEqual([r2.id, r1.id, r3.id]);
  });

  it('findSelectable() returns the root for a given id', () => {
    const model = new YjsGraphicModel();
    model.restore(sample);
    expect(model.findSelectable('rect-1')?.id).toBe('rect-1');
    // ellipse-1 is nested inside group-1, so root is group-1
    expect(model.findSelectable('ellipse-1')?.id).toBe('group-1');
    expect(model.findSelectable('nonexistent')).toBeUndefined();
  });

  it('onLocalUpdate() fires on local mutations but not on remote apply', () => {
    const model = new YjsGraphicModel();
    const updates: Uint8Array[] = [];
    model.onLocalUpdate((u) => updates.push(u));

    // Local mutation should fire
    model.add('rectangle');
    expect(updates).toHaveLength(1);

    // Remote apply should NOT fire
    const remoteModel = new YjsGraphicModel();
    remoteModel.restore(sample);
    model.applyRemoteUpdate(remoteModel.encodeStateAsUpdate());
    expect(updates).toHaveLength(1); // still 1, remote was filtered

    // Local mutation should still fire after remote
    model.remove([model.snapshot[0].id]);
    expect(updates).toHaveLength(2);
  });

  // ---- collaboration ----
  it('encodes state as binary update and applies to another doc', () => {
    const model1 = new YjsGraphicModel();
    model1.restore(sample);
    const update = model1.encodeStateAsUpdate();
    expect(update).toBeInstanceOf(Uint8Array);
    expect(update.length).toBeGreaterThan(0);
    const model2 = new YjsGraphicModel();
    model2.applyRemoteUpdate(update);
    const result = model2.snapshot;
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('rect-1');
    expect(result[1].type).toBe('group');
    const group = result[1] as { children: GraphicObjectInterface[] };
    expect(group.children).toHaveLength(1);
  });
});