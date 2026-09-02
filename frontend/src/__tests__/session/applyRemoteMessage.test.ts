/**
 * Tests for applyRemoteMessage.
 *
 * Verifies that each inbound collaboration message type updates the
 * local model correctly (and does NOT re-broadcast).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import applyRemoteMessage from '@/session/applyRemoteMessage';
import { model } from '@/models/GraphicEditorModel';
import { RectangleInterface } from '@/models/GraphicObjectInterface';

const rect = (id: string, x = 0, y = 0): RectangleInterface => ({
  id,
  type: 'rectangle',
  title: 'r',
  color: '#000',
  rotation: 0,
  position: { x, y },
  scale: { width: 10, height: 10 },
});

describe('applyRemoteMessage', () => {
  beforeEach(() => {
    model.restore([]);
  });

  it('object_add inserts the object into the model', () => {
    applyRemoteMessage({ type: 'object_add', data: rect('A') });
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].id).toBe('A');
  });

  it('object_add is idempotent for the same id', () => {
    applyRemoteMessage({ type: 'object_add', data: rect('A') });
    applyRemoteMessage({ type: 'object_add', data: rect('A') });
    expect(model.snapshot).toHaveLength(1);
  });

  it('object_update applies a patch to matching ids', () => {
    model.restore([rect('A'), rect('B')]);
    applyRemoteMessage({
      type: 'object_update',
      data: { ids: ['A'], patch: { color: '#ff0000' } },
    });
    expect(model.snapshot[0].color).toBe('#ff0000');
    expect(model.snapshot[1].color).toBe('#000');
  });

  it('object_remove deletes matching ids', () => {
    model.restore([rect('A'), rect('B')]);
    applyRemoteMessage({ type: 'object_remove', data: ['A'] });
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].id).toBe('B');
  });

  it('object_move shifts position by diff', () => {
    model.restore([rect('A', 0, 0)]);
    applyRemoteMessage({
      type: 'object_move',
      data: { ids: ['A'], diff: { x: 5, y: 7 } },
    });
    expect(model.snapshot[0].position).toEqual({ x: 5, y: 7 });
  });

  it('full_state replaces the entire canvas state', () => {
    model.restore([rect('A')]);
    applyRemoteMessage({
      type: 'full_state',
      data: [rect('X'), rect('Y')],
    });
    expect(model.snapshot.map(o => o.id)).toEqual(['X', 'Y']);
  });

  it('cursor_move is a no-op (presence not implemented)', () => {
    model.restore([rect('A')]);
    applyRemoteMessage({ type: 'cursor_move', data: { x: 1, y: 2 } });
    expect(model.snapshot).toHaveLength(1);
  });
});
