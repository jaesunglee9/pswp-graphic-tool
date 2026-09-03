/**
 * Yjs-backed graphic model — wraps a Y.Doc for CRDT collaboration.
 *
 * ## Why the internal shape is flat
 *
 * The obvious encoding — a Y.Array of shapes where a group nests its children
 * in another Y.Array — cannot express "move". Yjs arrays have no move
 * operation, so reordering or regrouping means deleting the shape's Y.Map and
 * building a new one. That is not CRDT-safe. Verified on yjs 13.6.31:
 *
 *   two peers reorder the same shape  -> the id appears TWICE, on both peers
 *   recolor concurrent with a reorder -> the recolor lands on the tombstone
 *                                        and is silently discarded
 *
 * Both peers converge, so a snapshot-equality test passes on the corruption.
 *
 * So the document is stored FLAT: every shape, at any depth, is one entry in a
 * single Y.Array, and structure lives in two fields on the shape itself:
 *
 *   order    fractional index (string) — position among siblings
 *   parentId id of the containing group, or null for top level
 *
 * Moving a shape is then a single `set()` on a field: last-writer-wins on that
 * one key, no clone, no tombstone, and concurrent edits to other fields on the
 * same shape survive untouched.
 *
 * `snapshot` rebuilds the nested tree the views expect, so this encoding is
 * invisible to everything outside this file.
 */
import * as Y from 'yjs';
import { generateKeyBetween } from 'fractional-indexing';
import {
  GraphicObjectInterface,
  GraphicObjectType,
  GroupInterface,
} from './GraphicObjectInterface';
import { PositionType } from './types';
import objectFactory from './ObjectFactory';

/** Fields that describe tree structure rather than the shape itself. */
const ORDER = 'order';
const PARENT = 'parentId';

/** Marks updates applied from a peer so onLocalUpdate can filter them out. */
export const REMOTE_ORIGIN = Symbol('remote');

type Row = { map: Y.Map<unknown>; id: string; parentId: string | null; order: string };

/** Plain view of one Y.Map, minus the structural fields. */
function rowToObject(map: Y.Map<unknown>): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of map.entries()) {
    if (key === ORDER || key === PARENT) continue;
    raw[key] = value;
  }
  return raw;
}

function objectToYMap(
  plain: Record<string, unknown>,
  parentId: string | null,
  order: string
): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(plain)) {
    if (key === 'children') continue; // structure is derived, never stored
    map.set(key, value);
  }
  map.set(PARENT, parentId);
  map.set(ORDER, order);
  return map;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function applyPatch(obj: Y.Map<unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'children') continue;
    if (isPlainObject(value) && isPlainObject(obj.get(key))) {
      obj.set(key, { ...(obj.get(key) as Record<string, unknown>), ...value });
    } else {
      obj.set(key, value);
    }
  }
}

export class YjsGraphicModel {
  readonly doc: Y.Doc;
  private readonly objects: Y.Array<Y.Map<unknown>>;

  constructor() {
    this.doc = new Y.Doc();
    this.objects = this.doc.getArray('objects');
  }

  // ---- internal helpers ----

  private rows(): Row[] {
    const out: Row[] = [];
    for (let i = 0; i < this.objects.length; i++) {
      const map = this.objects.get(i);
      const id = map.get('id') as string;
      if (!id) continue;
      out.push({
        map,
        id,
        parentId: (map.get(PARENT) as string | null) ?? null,
        order: (map.get(ORDER) as string) ?? 'a0',
      });
    }
    return out;
  }

  private byId(id: string): Y.Map<unknown> | undefined {
    return this.rows().find(r => r.id === id)?.map;
  }

  /** Siblings under a parent, in display order (top of the stack first). */
  private siblings(rows: Row[], parentId: string | null): Row[] {
    return rows
      .filter(r => r.parentId === parentId)
      .sort((x, y) => (x.order < y.order ? -1 : x.order > y.order ? 1 : x.id < y.id ? -1 : 1));
  }

  /** Order key that places a shape above every current sibling. */
  private orderAtTop(rows: Row[], parentId: string | null): string {
    const first = this.siblings(rows, parentId)[0];
    return generateKeyBetween(null, first ? first.order : null);
  }

  private buildTree(rows: Row[], parentId: string | null): GraphicObjectInterface[] {
    return this.siblings(rows, parentId).map(row => {
      const plain = rowToObject(row.map);
      if (plain.type === 'group') {
        plain.children = this.buildTree(rows, row.id);
      }
      return plain as unknown as GraphicObjectInterface;
    });
  }

  private descendantIds(rows: Row[], id: string): string[] {
    const kids = rows.filter(r => r.parentId === id);
    return kids.flatMap(k => [k.id, ...this.descendantIds(rows, k.id)]);
  }

  /** Walks up the parent chain to the outermost ancestor. */
  private rootOf(rows: Row[], id: string): Row | undefined {
    let cur = rows.find(r => r.id === id);
    while (cur?.parentId) {
      const next = rows.find(r => r.id === cur!.parentId);
      if (!next) break;
      cur = next;
    }
    return cur;
  }

  private deleteRows(ids: Set<string>): void {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      if (ids.has(this.objects.get(i).get('id') as string)) this.objects.delete(i, 1);
    }
  }

  // ---- Public API (unchanged shape) ----

  /** Nested plain-object snapshot, top of the layer stack first. */
  get snapshot(): GraphicObjectInterface[] {
    return this.buildTree(this.rows(), null);
  }

  add(type: Exclude<GraphicObjectType, 'group'>): GraphicObjectInterface {
    const plain = objectFactory(type) as unknown as Record<string, unknown>;
    this.doc.transact(() => {
      const order = this.orderAtTop(this.rows(), null);
      this.objects.push([objectToYMap(plain, null, order)]);
    });
    return plain as unknown as GraphicObjectInterface;
  }

  /** Insert a fully-formed object. Idempotent at any depth. */
  insertObject(plain: GraphicObjectInterface): void {
    if (this.byId(plain.id)) return;
    this.doc.transact(() => {
      const order = this.orderAtTop(this.rows(), null);
      this.objects.push([
        objectToYMap(plain as unknown as Record<string, unknown>, null, order),
      ]);
    });
  }

  /** Remove objects and everything nested inside them. */
  remove(ids: string[]): void {
    if (ids.length === 0) return;
    this.doc.transact(() => {
      const rows = this.rows();
      const doomed = new Set<string>();
      for (const id of ids) {
        doomed.add(id);
        this.descendantIds(rows, id).forEach(d => doomed.add(d));
      }
      this.deleteRows(doomed);
    });
  }

  /** Patch properties on matching objects, at any depth. */
  update(ids: string[], patch: Partial<GraphicObjectInterface>): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    this.doc.transact(() => {
      for (const row of this.rows()) {
        if (idSet.has(row.id)) applyPatch(row.map, patch as Record<string, unknown>);
      }
    });
  }

  /** Move objects, and everything inside a selected group, by a delta. */
  move(ids: string[], diff: PositionType): void {
    if (ids.length === 0) return;
    this.doc.transact(() => {
      const rows = this.rows();

      // A selected group moves its whole subtree.
      const moving = new Set<string>();
      for (const id of ids) {
        moving.add(id);
        this.descendantIds(rows, id).forEach(d => moving.add(d));
      }

      for (const row of rows) {
        if (!moving.has(row.id)) continue;
        // A group has no position of its own; its bounds are derived from its
        // children, which are in `moving` too and get shifted below.
        if (row.map.get('type') === 'group') continue;
        const pos = row.map.get('position') as PositionType | undefined;
        if (!pos) continue;
        row.map.set('position', { x: pos.x + diff.x, y: pos.y + diff.y });
      }
    });
  }

  /**
   * Group objects. Reparents them by setting parentId — the shapes' Y.Maps are
   * never recreated, so a concurrent edit to one of them survives.
   */
  group(ids: string[]): GroupInterface | undefined {
    if (ids.length < 2) return undefined;
    const groupId = crypto.randomUUID();
    let ok = false;

    this.doc.transact(() => {
      const rows = this.rows();
      const members = rows.filter(r => ids.includes(r.id));
      if (members.length < 2) return;

      const parentId = members[0].parentId;
      const groupMap = objectToYMap(
        {
          id: groupId,
          title: 'group',
          type: 'group',
          color: 'transparent',
          position: { x: 0, y: 0 },
          rotation: 0,
        },
        parentId,
        this.orderAtTop(rows, parentId)
      );
      this.objects.push([groupMap]);

      // Preserve relative order inside the group.
      const ordered = members.sort((x, y) => (x.order < y.order ? -1 : 1));
      let prev: string | null = null;
      for (const m of ordered) {
        prev = generateKeyBetween(prev, null);
        m.map.set(PARENT, groupId);
        m.map.set(ORDER, prev);
      }

      ok = true;
    });

    return ok ? (this.snapshot.find(o => o.id === groupId) as GroupInterface) : undefined;
  }

  /**
   * Ungroup. Children are reparented, not rebuilt, so concurrent edits to them
   * survive.
   */
  ungroup(ids: string[]): GraphicObjectInterface[] | undefined {
    if (ids.length === 0) return undefined;
    const released: GraphicObjectInterface[] = [];

    this.doc.transact(() => {
      const rows = this.rows();
      const groups = rows.filter(r => ids.includes(r.id) && r.map.get('type') === 'group');

      for (const g of groups) {
        const kids = this.siblings(rows, g.id);
        let prev: string | null = g.order;
        for (const kid of kids) {
          // Slot the children in where the group used to sit.
          prev = generateKeyBetween(prev, null);
          kid.map.set(PARENT, g.parentId);
          kid.map.set(ORDER, prev);
          released.push(rowToObject(kid.map) as unknown as GraphicObjectInterface);
        }
        this.deleteRows(new Set([g.id]));
      }
    });

    return released.length > 0 ? released : undefined;
  }

  /**
   * Move an object to a different index among its siblings.
   * One `set()` on the order field: concurrent reorders resolve last-writer-wins
   * on that key instead of duplicating the shape.
   */
  reorder(id: string, targetIdx: number): void {
    this.doc.transact(() => {
      const rows = this.rows();
      const row = rows.find(r => r.id === id);
      if (!row) return;

      const sibs = this.siblings(rows, row.parentId).filter(r => r.id !== id);
      const clamped = Math.max(0, Math.min(targetIdx, sibs.length));
      const before = clamped === 0 ? null : sibs[clamped - 1].order;
      const after = clamped >= sibs.length ? null : sibs[clamped].order;
      row.map.set(ORDER, generateKeyBetween(before, after));
    });
  }

  /** The outermost ancestor of an id — what a click should select. */
  findSelectable(id: string): GraphicObjectInterface | undefined {
    const rows = this.rows();
    const root = this.rootOf(rows, id);
    if (!root) return undefined;
    return this.snapshot.find(o => o.id === root.id);
  }

  /** Subscribe to any change in the document. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    this.doc.on('update', handler);
    return () => this.doc.off('update', handler);
  }

  /**
   * Register a callback for local-only updates. Updates applied via
   * applyRemoteUpdate are filtered out so they are never echoed back.
   */
  onLocalUpdate(callback: (update: Uint8Array) => void): () => void {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin !== REMOTE_ORIGIN && origin !== this) callback(update);
    };
    this.doc.on('update', handler);
    return () => this.doc.off('update', handler);
  }

  /** Replace the whole document with a plain-array snapshot. */
  restore(objects: GraphicObjectInterface[]): void {
    this.doc.transact(() => {
      this.objects.delete(0, this.objects.length);
      const flatten = (list: GraphicObjectInterface[], parentId: string | null) => {
        let prev: string | null = null;
        for (const obj of list) {
          prev = generateKeyBetween(prev, null);
          this.objects.push([
            objectToYMap(obj as unknown as Record<string, unknown>, parentId, prev),
          ]);
          if (obj.type === 'group') flatten((obj as GroupInterface).children, obj.id);
        }
      };
      flatten(objects, null);
    });
  }

  /** Apply a Yjs update from a peer or from storage. */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, REMOTE_ORIGIN);
  }

  /** Full document state as a Yjs update. */
  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }
}

export const model = new YjsGraphicModel();
