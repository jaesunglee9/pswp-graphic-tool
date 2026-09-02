/**
 * Applies an inbound collaboration message to the local model.
 *
 * Mutates the model directly, bypassing the controller layer so that
 * remote changes are NOT re-broadcast (the server already excludes the
 * sender from broadcasts, but this also avoids feedback loops if that
 * guarantee ever changes).
 */
import { model } from '@/models/GraphicEditorModel';
import { GraphicObjectInterface } from '@/models/GraphicObjectInterface';
import { PositionType } from '@/models/types';
import { CollaborationMessage } from '@/collaboration/CollaborationClient';

export default function applyRemoteMessage(msg: CollaborationMessage): void {
  switch (msg.type) {
    case 'object_add':
      model.insertObject(msg.data as GraphicObjectInterface);
      return;

    case 'object_update': {
      const { ids, patch } = msg.data as {
        ids: string[];
        patch: Partial<GraphicObjectInterface>;
      };
      model.update(ids, patch);
      return;
    }

    case 'object_remove':
      model.remove(msg.data as string[]);
      return;

    case 'object_move': {
      const { ids, diff } = msg.data as { ids: string[]; diff: PositionType };
      model.move(ids, diff);
      return;
    }

    case 'full_state':
      model.restore(msg.data as GraphicObjectInterface[]);
      return;

    case 'cursor_move':
      // Presence indicators are not implemented yet; ignore.
      return;
  }
}
