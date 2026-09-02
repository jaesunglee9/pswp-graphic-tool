import { Command } from './Command';

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  executeCommand(command: Command) {
    this.undoStack.push(command);
    this.redoStack = [];
    return command.execute();
  }

  undo() {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  redo() {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
  }

  /** Empties the undo and redo stacks. Call when loading a new document. */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const commandManager = new CommandManager();
