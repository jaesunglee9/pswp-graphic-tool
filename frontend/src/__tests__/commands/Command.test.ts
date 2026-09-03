/**
 * Tests for Command classes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  Command,
  AddCommand,
  RemoveCommand,
  RemoveAllCommand,
  ReorderLayersCommand,
  GroupCommand,
  UngroupCommand,
} from '@/commands/Command';
import { model } from '@/models/GraphicEditorModel';

describe('Command', () => {
  beforeEach(() => {
    // Clear the model
    model.restore([]);
  });

  describe('AddCommand', () => {
    it('adds a rectangle to the model', () => {
      const cmd = new AddCommand('rectangle');
      cmd.execute();
      expect(model.snapshot).toHaveLength(1);
    });

    it('undo restores previous state', () => {
      model.add('rectangle');
      const cmd = new AddCommand('rectangle');
      cmd.execute();
      expect(model.snapshot).toHaveLength(2);
      cmd.undo();
      expect(model.snapshot).toHaveLength(1);
    });
  });

  describe('RemoveCommand', () => {
    it('removes objects by id', () => {
      const obj = model.add('rectangle');
      const cmd = new RemoveCommand([obj.id]);
      cmd.execute();
      expect(model.snapshot).toHaveLength(0);
    });

    it('undo restores removed objects', () => {
      const obj = model.add('rectangle');
      const cmd = new RemoveCommand([obj.id]);
      cmd.execute();
      expect(model.snapshot).toHaveLength(0);
      cmd.undo();
      expect(model.snapshot).toHaveLength(1);
    });
  });

  describe('RemoveAllCommand', () => {
    it('removes all objects', () => {
      model.add('rectangle');
      model.add('ellipse');
      const cmd = new RemoveAllCommand();
      cmd.execute();
      expect(model.snapshot).toHaveLength(0);
    });

    it('undo restores all objects', () => {
      model.add('rectangle');
      model.add('ellipse');
      const cmd = new RemoveAllCommand();
      cmd.execute();
      cmd.undo();
      expect(model.snapshot).toHaveLength(2);
    });
  });

  describe('ReorderLayersCommand', () => {
    it('reorders layers', () => {
      const a = model.add('rectangle');
      const b = model.add('ellipse');
      // Currently: [b (idx 0), a (idx 1)]
      const cmd = new ReorderLayersCommand(b.id, 1);
      cmd.execute();
      expect(model.snapshot[0].id).toBe(a.id);
      expect(model.snapshot[1].id).toBe(b.id);
    });
  });

  describe('GroupCommand', () => {
    it('groups objects', () => {
      const a = model.add('rectangle');
      const b = model.add('ellipse');
      const cmd = new GroupCommand([a.id, b.id]);
      const group = cmd.execute() as { type: string; children: unknown[] };
      expect(group.type).toBe('group');
      expect(group.children).toHaveLength(2);
    });

    it('undo ungroups', () => {
      const a = model.add('rectangle');
      const b = model.add('ellipse');
      const cmd = new GroupCommand([a.id, b.id]);
      cmd.execute();
      expect(model.snapshot).toHaveLength(1);
      cmd.undo();
      expect(model.snapshot).toHaveLength(2);
    });
  });

  describe('UngroupCommand', () => {
    it('ungroups a group', () => {
      const a = model.add('rectangle');
      const b = model.add('ellipse');
      const groupCmd = new GroupCommand([a.id, b.id]);
      const group = groupCmd.execute() as { id: string };
      const cmd = new UngroupCommand([group.id]);
      const children = cmd.execute() as unknown[];
      expect(children).toHaveLength(2);
      expect(model.snapshot).toHaveLength(2);
    });
  });

  describe('Command base class', () => {
    it('starts with an empty model snapshot', () => {
      void new Command();
      expect(model.snapshot).toEqual([]);
    });
  });
});