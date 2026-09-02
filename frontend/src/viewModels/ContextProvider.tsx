import { PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import {
  ControllerContext,
  ControllerContextInterface,
  SelectedObjectsContext,
} from '@/viewModels/GraphicEditorContext';
import {
  GraphicObjectInterface,
  GraphicObjectType,
  GroupInterface,
} from '@/models/GraphicObjectInterface';
import { PositionType } from '@/models/types';
import { commandManager } from '@/commands/CommandManager';
import {
  AddCommand,
  CommandWithDebounce,
  GroupCommand,
  RemoveAllCommand,
  RemoveCommand,
  ReorderLayersCommand,
  UngroupCommand,
} from '@/commands/Command';
import { model } from '@/models/GraphicEditorModel';
import { SessionContext } from '@/session/SessionContext';

const DEBOUNCE_TIME = 500;

const ContextProvider = ({ children }: PropsWithChildren) => {
  const { broadcast } = useContext(SessionContext);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const debounceRef = useRef<{
    timer: number;
    cmd: CommandWithDebounce;
  } | null>(null);

  // Clean Up Debounce Timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current.timer);
      }
    };
  }, []);

  // Controller Functions
  const add = (type: Exclude<GraphicObjectType, 'group'>) => {
    const cmd = new AddCommand(type);
    const addedObject = commandManager.executeCommand(
      cmd
    ) as unknown as GraphicObjectInterface;
    setSelectedIds([addedObject.id]);
    broadcast('object_add', addedObject);
  };

  const remove = () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    const cmd = new RemoveCommand(ids);
    commandManager.executeCommand(cmd);
    clearSelect();
    broadcast('object_remove', ids);
  };

  const update = (patch: Partial<GraphicObjectInterface>) => {
    let cmd: CommandWithDebounce;
    if (debounceRef.current !== null) {
      cmd = debounceRef.current.cmd;
      clearTimeout(debounceRef.current.timer);
    } else {
      cmd = new CommandWithDebounce();
      commandManager.executeCommand(cmd);
    }

    model.update(selectedIds, patch);
    broadcast('object_update', { ids: selectedIds, patch });

    debounceRef.current = {
      timer: setTimeout(() => {
        debounceRef.current = null;
        cmd.setDoneStates();
      }, DEBOUNCE_TIME),
      cmd,
    };
  };

  const move = (diff: PositionType) => {
    let cmd: CommandWithDebounce;
    if (debounceRef.current !== null) {
      cmd = debounceRef.current.cmd;
      clearTimeout(debounceRef.current.timer);
    } else {
      cmd = new CommandWithDebounce();
      commandManager.executeCommand(cmd);
    }

    model.move(selectedIds, diff);
    broadcast('object_move', { ids: selectedIds, diff });

    debounceRef.current = {
      timer: setTimeout(() => {
        debounceRef.current = null;
        cmd.setDoneStates();
      }, DEBOUNCE_TIME),
      cmd,
    };
  };

  const select = (id: string) => setSelectedIds([id]);
  const withSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  const clearSelect = () => setSelectedIds([]);

  /** Sends a full-state snapshot. Used for ops that don't map cleanly to a
   *  single message type (group/ungroup/reorder/clear). */
  const broadcastFullState = () => broadcast('full_state', model.snapshot);

  const clear = () => {
    clearSelect();
    const cmd = new RemoveAllCommand();
    commandManager.executeCommand(cmd);
    broadcastFullState();
  };

  const group = () => {
    const cmd = new GroupCommand(selectedIds);
    const newGroup = commandManager.executeCommand(
      cmd
    ) as unknown as GroupInterface;
    if (newGroup) {
      setSelectedIds([newGroup.id]);
      broadcastFullState();
    }
  };

  const ungroup = () => {
    const cmd = new UngroupCommand(selectedIds);
    const ungroupedChildren = commandManager.executeCommand(
      cmd
    ) as unknown as GraphicObjectInterface[];
    if (ungroupedChildren) {
      setSelectedIds(ungroupedChildren.map(c => c.id));
      broadcastFullState();
    }
  };

  const reorderLayers = (id: string, idx: number) => {
    const cmd = new ReorderLayersCommand(id, idx);
    commandManager.executeCommand(cmd);
    broadcastFullState();
  };

  const undo = () => {
    commandManager.undo();
    broadcastFullState();
  };
  const redo = () => {
    commandManager.redo();
    broadcastFullState();
  };

  const controller: ControllerContextInterface = {
    add,
    remove,
    update,
    move,
    select,
    withSelect,
    clearSelect,
    clear,
    group,
    ungroup,
    reorderLayers,
    undo,
    redo,
  };

  return (
    <SelectedObjectsContext.Provider value={selectedIds}>
      <ControllerContext.Provider value={controller}>
        {children}
      </ControllerContext.Provider>
    </SelectedObjectsContext.Provider>
  );
};

export default ContextProvider;
