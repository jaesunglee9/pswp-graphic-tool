/**
 * Tests for the CommandManager (undo/redo).
 */
import { CommandManager } from '@/commands/CommandManager';
import { AddCommand } from '@/commands/Command';
import { model } from '@/models/GraphicEditorModel';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CommandManager', () => {
  let manager: CommandManager;

  beforeEach(() => {
    model.restore([]);
    manager = new CommandManager();
  });

  it('executes a command and adds to undo stack', () => {
    manager.executeCommand(new AddCommand('rectangle'));
    expect(model.snapshot).toHaveLength(1);
  });

  it('undo restores previous state', () => {
    manager.executeCommand(new AddCommand('rectangle'));
    expect(model.snapshot).toHaveLength(1);
    manager.undo();
    expect(model.snapshot).toHaveLength(0);
  });

  it('redo re-executes the command', () => {
    manager.executeCommand(new AddCommand('rectangle'));
    manager.undo();
    expect(model.snapshot).toHaveLength(0);
    manager.redo();
    expect(model.snapshot).toHaveLength(1);
  });

  it('redo stack clears after a new command', () => {
    manager.executeCommand(new AddCommand('rectangle'));
    manager.undo();
    expect(model.snapshot).toHaveLength(0);
    manager.executeCommand(new AddCommand('ellipse'));
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].type).toBe('ellipse');
    // Redo stack is gone — first command shouldn't come back
    manager.redo();
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].type).toBe('ellipse');
  });

  it('handles multiple undo/redo cycles', () => {
    manager.executeCommand(new AddCommand('rectangle'));
    manager.executeCommand(new AddCommand('ellipse'));
    manager.executeCommand(new AddCommand('line'));
    expect(model.snapshot).toHaveLength(3);

    manager.undo();
    expect(model.snapshot).toHaveLength(2);
    manager.undo();
    expect(model.snapshot).toHaveLength(1);
    manager.undo();
    expect(model.snapshot).toHaveLength(0);

    manager.redo();
    expect(model.snapshot).toHaveLength(1);
    expect(model.snapshot[0].type).toBe('rectangle');
    manager.redo();
    expect(model.snapshot).toHaveLength(2);
    manager.redo();
    expect(model.snapshot).toHaveLength(3);
  });

  it('undo with empty stack does nothing', () => {
    manager.undo();
    expect(model.snapshot).toEqual([]);
  });

  it('redo with empty stack does nothing', () => {
    manager.redo();
    expect(model.snapshot).toEqual([]);
  });

  it('provides correct return value from executeCommand', () => {
    const result = manager.executeCommand(new AddCommand('rectangle')) as unknown as { type: string };
    expect(result).toBeDefined();
    expect(result.type).toBe('rectangle');
  });
});