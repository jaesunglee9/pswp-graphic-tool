/**
 * Tests for utility functions: walk, search, getObjectAABB, calculateRecursiveBoundingBox.
 */
import { describe, it, expect } from 'vitest';
import walk from '@/utils/walk';
import search from '@/utils/search';
import getObjectAABB from '@/utils/getObjectAABB';
import calculateRecursiveBoundingBox from '@/utils/calculateRecursiveBoundingBox';
import {
  GraphicObjectInterface,
  RectangleInterface,
  EllipseInterface,
  GroupInterface,
  LineInterface,
  TextInterface,
} from '@/models/GraphicObjectInterface';

function makeRect(id: string, x = 0, y = 0): RectangleInterface {
  return {
    id,
    title: 'rect',
    type: 'rectangle',
    color: '#fff',
    position: { x, y },
    rotation: 0,
    scale: { width: 100, height: 50 },
  };
}

function makeEllipse(id: string, x = 0, y = 0): EllipseInterface {
  return {
    id,
    title: 'ellipse',
    type: 'ellipse',
    color: '#fff',
    position: { x, y },
    rotation: 0,
    scale: { width: 80, height: 60 },
  };
}

function makeGroup(id: string, children: GraphicObjectInterface[]): GroupInterface {
  return {
    id,
    title: 'group',
    type: 'group',
    color: 'transparent',
    position: { x: 0, y: 0 },
    rotation: 0,
    children,
  };
}

// ─── walk (recursive tree position update) ───────────────────────

describe('walk', () => {
  it('updates position of a non-group object', () => {
    const obj = makeRect('r1', 10, 20);
    const ids = new Set(['r1']);
    const result = walk(obj, ids, { x: 5, y: -3 });
    expect(result.position.x).toBe(15);
    expect(result.position.y).toBe(17);
  });

  it('does not update position of non-target object', () => {
    const obj = makeRect('r1', 10, 20);
    const ids = new Set(['other']);
    const result = walk(obj, ids, { x: 5, y: -3 });
    expect(result.position.x).toBe(10);
    expect(result.position.y).toBe(20);
  });

  it('updates children of a selected group', () => {
    const child = makeRect('r1', 10, 20);
    const group = makeGroup('g1', [child]);
    const ids = new Set(['g1']);
    const result = walk(group, ids, { x: 5, y: 0 }) as GroupInterface;
    expect(result.children[0].position.x).toBe(15);
  });

  it('updates child directly if child is selected', () => {
    const child = makeRect('r1', 10, 20);
    const group = makeGroup('g1', [child]);
    const ids = new Set(['r1']);
    const result = walk(group, ids, { x: 5, y: 0 }) as GroupInterface;
    expect(result.children[0].position.x).toBe(15);
  });
});

// ─── search (recursive ID lookup) ────────────────────────────────

describe('search', () => {
  it('finds an object by id at root level', () => {
    const obj = makeRect('r1');
    expect(search('r1', obj)?.id).toBe('r1');
  });

  it('returns null for non-existent id', () => {
    const obj = makeRect('r1');
    expect(search('nonexistent', obj)).toBeNull();
  });

  it('finds a child inside a group and returns the group', () => {
    const child = makeRect('r1');
    const group = makeGroup('g1', [child]);
    const found = search('r1', group);
    expect(found).toBeDefined();
    expect(found!.id).toBe('g1');
  });

  it('returns null when child not in group', () => {
    const group = makeGroup('g1', []);
    expect(search('nothing', group)).toBeNull();
  });
});

// ─── getObjectAABB ──────────────────────────────────────────────

describe('getObjectAABB', () => {
  it('computes AABB for a rectangle', () => {
    const obj = makeRect('r1', 100, 100);
    const box = getObjectAABB(obj);
    expect(box.minX).toBe(50);   // 100 - 100/2
    expect(box.minY).toBe(75);   // 100 - 50/2
    expect(box.maxX).toBe(150);  // 50 + 100
    expect(box.maxY).toBe(125);  // 75 + 50
  });

  it('computes AABB for an ellipse', () => {
    const obj = makeEllipse('e1', 200, 150);
    const box = getObjectAABB(obj);
    expect(box.minX).toBe(160);
    expect(box.minY).toBe(120);
    expect(box.maxX).toBe(240);
    expect(box.maxY).toBe(180);
  });

  it('computes AABB for a line', () => {
    const obj: LineInterface = {
      id: 'l1',
      title: 'line',
      type: 'line',
      color: '#000',
      position: { x: 50, y: 50 },
      rotation: 0,
      length: 100,
      strokeWidth: 2,
    };
    const box = getObjectAABB(obj);
    expect(box.minX).toBeCloseTo(0);
    expect(box.minY).toBeCloseTo(49);
    expect(box.maxX).toBeCloseTo(100);
    expect(box.maxY).toBeCloseTo(51);
  });

  it('approximates AABB for text', () => {
    const obj: TextInterface = {
      id: 't1',
      title: 'text',
      type: 'text',
      color: 'transparent',
      position: { x: 100, y: 100 },
      rotation: 0,
      text: 'Hello',
      textColor: '#000',
      textSize: 16,
    };
    const box = getObjectAABB(obj);
    expect(box.minX).toBeCloseTo(76);   // 100 - 48/2
    expect(box.minY).toBe(92);          // 100 - 16/2
    expect(box.maxX).toBeCloseTo(124);  // 76 + 48
    expect(box.maxY).toBe(108);         // 92 + 16
  });
});

// ─── calculateRecursiveBoundingBox ──────────────────────────────

describe('calculateRecursiveBoundingBox', () => {
  it('delegates to getObjectAABB for non-group objects', () => {
    const obj = makeRect('r1', 100, 100);
    const box = calculateRecursiveBoundingBox(obj);
    expect(box.minX).toBe(50);
    expect(box.maxX).toBe(150);
  });

  it('computes bounding box for a group of children', () => {
    const child1 = makeRect('r1', 100, 100);
    const child2 = makeEllipse('e1', 200, 150);
    const group = makeGroup('g1', [child1, child2]);
    const box = calculateRecursiveBoundingBox(group);
    expect(box.minX).toBeCloseTo(50);   // minX from r1
    expect(box.minY).toBeCloseTo(75);   // minY from r1
    expect(box.maxX).toBeCloseTo(240);  // maxX from e1
    expect(box.maxY).toBeCloseTo(180);  // maxY from e1
  });

  it('returns zeros for empty group', () => {
    const group = makeGroup('g1', []);
    const box = calculateRecursiveBoundingBox(group);
    expect(box.minX).toBe(0);
    expect(box.minY).toBe(0);
    expect(box.maxX).toBe(0);
    expect(box.maxY).toBe(0);
  });

  it('handles nested groups', () => {
    const child1 = makeRect('r1', 100, 100);
    const child2 = makeRect('r2', 50, 50);
    const inner = makeGroup('inner', [child1]);
    const outer = makeGroup('outer', [inner, child2]);
    const box = calculateRecursiveBoundingBox(outer);
    expect(box.minX).toBeCloseTo(0);   // from child2: 50 - 100/2
    expect(box.minY).toBeCloseTo(25);  // from child2: 50 - 50/2
    expect(box.maxX).toBeCloseTo(150); // from r1: 100 + 100/2
    expect(box.maxY).toBeCloseTo(125); // from r1: 100 + 50/2
  });
});