/**
 * Yjs-backed graphic model — wraps a Y.Doc for CRDT collaboration.
 *
 * Replaces the plain-array GraphicEditorModel with Yjs shared types:
 *   Y.Array → top-level layer ordering
 *   Y.Map   → each individual graphic object and its properties
 *   Y.Array → group children (nested inside a group's Y.Map)
 *
 * The public API mirrors GraphicEditorModel so the transition is
 * transparent to views and controllers.
 */
import * as Y from 'yjs';
import {
  GraphicObjectInterface,
  GraphicObjectType,
  GroupInterface,
} from './GraphicObjectInterface';
import { PositionType } from './types';
import objectFactory from './ObjectFactory';

/** Recursively walk a Y.Map tree and produce a plain GraphicObjectInterface. */
function yMapToObject(obj: Y.Map<unknown>): GraphicObjectInterface {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of obj.entries()) {
    if (key === 'children' && value instanceof Y.Array) {
      raw[key] = value.toArray().map((item: unknown) =>
        yMapToObject(item as Y.Map<unknown>)
      );
    } else {
      raw[key] = value;
    }
  }
  return raw as unknown as GraphicObjectInterface;
}

/** Convert a plain GraphicObjectInterface into a Y.Map. */
function objectToYMap(plain: GraphicObjectInterface): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(plain)) {
    if (key === 'children' && Array.isArray(value)) {
      const arr = new Y.Array<Y.Map<unknown>>();
      arr.push(value.map((child: GraphicObjectInterface) => objectToYMap(child)));
      map.set(key, arr);
    } else {
      map.set(key, value);
    }
  }
  return map;
}

/**
 * Apply a partial update to a Y.Map. Handles nested plain objects
 * (e.g. position, scale) by shallow-merging them.
 */
function applyPatch(
  obj: Y.Map<unknown>,
  patch: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(obj.get(key))) {
      obj.set(key, { ...(obj.get(key) as Record<string, unknown>), ...value });
    } else {
      obj.set(key, value);
    }
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Search for an id in a plain-object tree, returning the root. */
function searchInSnapshot(
  searchId: string,
  node: GraphicObjectInterface,
): GraphicObjectInterface | null {
  if (node.id === searchId) return node;
  if (node.type === 'group') {
    for (const child of (node as GroupInterface).children) {
      const found = searchInSnapshot(searchId, child);
      if (found) return node;
    }
  }
  return null;
}

/**
 * Recursively walk a Y.Map tree and update positions for matching ids.
 * Counterpart to utils/walk.ts but operating on Yjs shared types.
 */
function yWalk(
  obj: Y.Map<unknown>,
  idSet: Set<string>,
  diff: PositionType,
  isParentSelected: boolean,
): void {
  const id = obj.get('id') as string;
  const type = obj.get('type') as string;
  const isSelected = isParentSelected || idSet.has(id);

  if (type !== 'group') {
    if (isSelected) {
      const pos = obj.get('position') as PositionType;
      obj.set('position', { x: pos.x + diff.x, y: pos.y + diff.y });
    }
    return;
  }

  // Group: recurse into children
  const children = obj.get('children') as Y.Array<Y.Map<unknown>>;
  if (children) {
    for (let i = 0; i < children.length; i++) {
      yWalk(children.get(i), idSet, diff, isSelected);
    }
  }
}

// ---------------------------------------------------------------------------
// YjsGraphicModel
// ---------------------------------------------------------------------------

export class YjsGraphicModel {
  readonly doc: Y.Doc;
  private readonly objects: Y.Array<Y.Map<unknown>>;

  constructor() {
    this.doc = new Y.Doc();
    this.objects = this.doc.getArray('objects');
  }

  // ---- Public API (mirrors GraphicEditorModel) ----

  /** Returns a plain-array snapshot of the current state. */
  get snapshot(): GraphicObjectInterface[] {
    return this.objects.toArray().map((item) => yMapToObject(item));
  }

  /** Create a new object and insert at the top of the layer stack. */
  add(type: Exclude<GraphicObjectType, 'group'>): GraphicObjectInterface {
    const plain = objectFactory(type);
    this.doc.transact(() => {
      this.objects.insert(0, [objectToYMap(plain)]);
    });
    return plain;
  }

  /**
   * Insert a fully-formed object (with existing id) at top of layer stack.
   * Used by remote collaboration to mirror peer-created objects.
   */
  insertObject(plain: GraphicObjectInterface): void {
    // Idempotent: skip if an object with this id already exists
    for (let i = 0; i < this.objects.length; i++) {
      if (this.objects.get(i).get('id') === plain.id) return;
    }
    this.doc.transact(() => {
      this.objects.insert(0, [objectToYMap(plain)]);
    });
  }

  /** Remove objects by their ids. No-op if ids is empty. */
  remove(ids: string[]): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    this.doc.transact(() => {
      // Iterate backwards so indices stay valid as we delete
      for (let i = this.objects.length - 1; i >= 0; i--) {
        if (idSet.has(this.objects.get(i).get('id') as string)) {
          this.objects.delete(i, 1);
        }
      }
    });
  }

  /**
   * Patch properties on matching objects. Supports nested updates
   * (e.g. { position: { x: 10 } } and { scale: { width: 200 } }).
   */
  update(ids: string[], patch: Partial<GraphicObjectInterface>): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    this.doc.transact(() => {
      for (let i = 0; i < this.objects.length; i++) {
        const obj = this.objects.get(i);
        if (idSet.has(obj.get('id') as string)) {
          applyPatch(obj, patch);
        }
      }
    });
  }

  /**
   * Move matching objects (and selected children in groups) by a delta.
   * Recursively walks into group children.
   */
  move(ids: string[], diff: PositionType): void {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    this.doc.transact(() => {
      for (let i = 0; i < this.objects.length; i++) {
        yWalk(this.objects.get(i), idSet, diff, false);
      }
    });
  }

  /**
   * Group the given objects (by id) into a new group.
   * Returns the new group's id, or undefined if fewer than 2 objects.
   */
  group(ids: string[]): GroupInterface | undefined {
    if (ids.length < 2) return undefined;
    const idSet = new Set(ids);
    const groupId = crypto.randomUUID();

    let newGroup: GroupInterface | undefined;
    this.doc.transact(() => {
      const children: GraphicObjectInterface[] = [];
      // Collect and remove matching top-level objects
      for (let i = this.objects.length - 1; i >= 0; i--) {
        const obj = this.objects.get(i);
        if (idSet.has(obj.get('id') as string)) {
          children.unshift(yMapToObject(obj));
          this.objects.delete(i, 1);
        }
      }

      const groupYMap = new Y.Map<unknown>();
      const childrenArray = new Y.Array<Y.Map<unknown>>();
      childrenArray.push(children.map(c => objectToYMap(c)));

      groupYMap.set('id', groupId);
      groupYMap.set('title', 'group');
      groupYMap.set('type', 'group');
      groupYMap.set('color', 'transparent');
      groupYMap.set('position', { x: 0, y: 0 });
      groupYMap.set('rotation', 0);
      groupYMap.set('children', childrenArray);

      this.objects.insert(0, [groupYMap]);

      newGroup = yMapToObject(groupYMap) as GroupInterface;
    });

    return newGroup;
  }

  /**
   * Ungroup matching groups, inserting their children at the
   * group's position in the top-level array. Returns the ungrouped
   * children, or undefined if no groups were ungrouped.
   */
  ungroup(ids: string[]): GraphicObjectInterface[] | undefined {
    if (ids.length === 0) return undefined;
    const idSet = new Set(ids);
    const released: GraphicObjectInterface[] = [];

    this.doc.transact(() => {
      for (let i = this.objects.length - 1; i >= 0; i--) {
        const obj = this.objects.get(i);
        if (
          idSet.has(obj.get('id') as string) &&
          obj.get('type') === 'group'
        ) {
          const children = obj.get('children') as Y.Array<Y.Map<unknown>>;
          if (children) {
            // Convert to plain, then back to fresh Y.Maps (safer than clone)
            const plainChildren: GraphicObjectInterface[] = [];
            for (let j = 0; j < children.length; j++) {
              plainChildren.push(yMapToObject(children.get(j)));
            }
            released.unshift(...plainChildren);
            this.objects.delete(i, 1);
            this.objects.insert(i, plainChildren.map(c => objectToYMap(c)));
          }
        }
      }
    });

    return released.length > 0 ? released : undefined;
  }

  /** Move an object to a different index in the top-level array. */
  reorder(id: string, targetIdx: number): void {
    this.doc.transact(() => {
      for (let i = 0; i < this.objects.length; i++) {
        if (this.objects.get(i).get('id') === id) {
          const plain = yMapToObject(this.objects.get(i));
          this.objects.delete(i, 1);
          const clampedIdx = Math.min(targetIdx, this.objects.length);
          this.objects.insert(clampedIdx, [objectToYMap(plain)]);
          return;
        }
      }
    });
  }

  /**
   * Find the top-level or containing-group root for a given id.
   * Returns the selectable root object, or undefined if not found.
   */
  findSelectable(id: string): GraphicObjectInterface | undefined {
    for (const obj of this.snapshot) {
      const found = searchInSnapshot(id, obj);
      if (found) return found;
    }
    return undefined;
  }

  /** Subscribe to any change in the document. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    this.doc.on('update', handler);
    return () => this.doc.off('update', handler);
  }

  /**
   * Register a callback for local-only yjs updates (binary diffs).
   * Remote updates (via applyRemoteUpdate) are filtered out.
   * Returns an unsubscribe function.
   */
  onLocalUpdate(callback: (update: Uint8Array) => void): () => void {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin !== this) callback(update);
    };
    this.doc.on('update', handler);
    return () => this.doc.off('update', handler);
  }

  /** Load a plain-array snapshot into the document (replaces everything). */
  restore(objects: GraphicObjectInterface[]): void {
    this.doc.transact(() => {
      this.objects.delete(0, this.objects.length);
      this.objects.push(
        objects.map((obj) => objectToYMap(obj))
      );
    });
  }

  /**
   * Apply a yjs update (binary) from a remote peer.
   * This is the primary path for collaboration sync.
   */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, this);
  }

  /**
   * Encode the full document state as a yjs update binary.
   * Sent to peers on initial sync or to the backend for persistence.
   */
  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }
}

export const model = new YjsGraphicModel();