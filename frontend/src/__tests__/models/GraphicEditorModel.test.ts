/**
 * Tests for the GraphicEditorModel.
 */
import GraphicEditorModel from '@/models/GraphicEditorModel';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('GraphicEditorModel', () => {
  let model: GraphicEditorModel;

  beforeEach(() => {
    model = new GraphicEditorModel();
  });

  it('starts with an empty snapshot', () => {
    expect(model.snapshot).toEqual([]);
  });

  it('adds a rectangle', () => {
    const obj = model.add('rectangle');
    expect(model.snapshot).toHaveLength(1);
    expect(obj.type).toBe('rectangle');
    expect(obj.id).toBeTruthy();
  });

  it('adds all shape types', () => {
    const types = ['rectangle', 'ellipse', 'line', 'text', 'image'] as const;
    for (const t of types) {
      model.add(t);
    }
    expect(model.snapshot).toHaveLength(5);
  });

  it('removes objects by id', () => {
    const obj = model.add('rectangle');
    expect(model.snapshot).toHaveLength(1);
    model.remove([obj.id]);
    expect(model.snapshot).toHaveLength(0);
  });

  it('does nothing when removing empty ids', () => {
    model.add('rectangle');
    model.remove([]);
    expect(model.snapshot).toHaveLength(1);
  });

  it('updates object properties', () => {
    const obj = model.add('rectangle');
    model.update([obj.id], { color: '#ff0000' });
    expect(model.snapshot[0].color).toBe('#ff0000');
  });

  it('moves objects by a delta', () => {
    const obj = model.add('rectangle');
    const originalPos = { ...obj.position };
    model.move([obj.id], { x: 10, y: 20 });
    expect(model.snapshot[0].position.x).toBe(originalPos.x + 10);
    expect(model.snapshot[0].position.y).toBe(originalPos.y + 20);
  });

  it('groups objects', () => {
    const a = model.add('rectangle');
    const b = model.add('ellipse');
    const group = model.group([a.id, b.id]);
    expect(group).toBeDefined();
    expect(group!.type).toBe('group');
    expect(group!.children).toHaveLength(2);
    // The group should be in the snapshot, children removed from top level
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].type).toBe('group');
  });

  it('does not group fewer than 2 objects', () => {
    const a = model.add('rectangle');
    const result = model.group([a.id]);
    expect(result).toBeUndefined();
    expect(model.snapshot).toHaveLength(1);
  });

  it('ungroups objects', () => {
    const a = model.add('rectangle');
    const b = model.add('ellipse');
    const group = model.group([a.id, b.id]);
    const children = model.ungroup([group!.id]);
    expect(children).toHaveLength(2);
    expect(model.snapshot).toHaveLength(2);
  });

  it('reorders objects', () => {
    const a = model.add('rectangle');
    const b = model.add('ellipse');
    // model.add uses unshift, so snapshot is [b (idx 0), a (idx 1)]
    expect(model.snapshot[0].id).toBe(b.id);
    expect(model.snapshot[1].id).toBe(a.id);

    model.reorder(a.id, 0); // move 'a' to front
    expect(model.snapshot[0].id).toBe(a.id);
    expect(model.snapshot[1].id).toBe(b.id);
  });

  it('restores a previous state', () => {
    const a = model.add('rectangle');
    const snapshot = [...model.snapshot];
    model.add('ellipse');
    expect(model.snapshot).toHaveLength(2);
    model.restore(snapshot);
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].id).toBe(a.id);
  });

  it('notifies subscribers on changes', () => {
    const listener = vi.fn();
    model.subscribe(listener);
    model.add('rectangle');
    expect(listener).toHaveBeenCalledTimes(1);
    model.remove([model.snapshot[0].id]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('finds selectable objects including group children', () => {
    const a = model.add('rectangle');
    const b = model.add('ellipse');
    model.group([a.id, b.id]);
    // findSelectable on the child IDs should return the group
    const found = model.findSelectable(a.id);
    expect(found).toBeDefined();
    expect(found!.type).toBe('group');
  });
});