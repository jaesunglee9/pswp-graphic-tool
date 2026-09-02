/**
 * Session context: owns the *currently open document* and the
 * collaboration channel. Sits above ContextProvider so the controller
 * can broadcast mutations through it.
 */
import { createContext } from 'react';
import {
  CollaborationMessageType,
} from '@/collaboration/CollaborationClient';
import { DocumentSummary } from '@/api/documentApi';

export interface OpenDocument {
  id: string;
  title: string;
}

export type SessionStatus = 'idle' | 'loading' | 'open' | 'error';

export interface SessionContextInterface {
  /** The currently opened document, or `null` if editing locally. */
  current: OpenDocument | null;
  /** Cached summaries for the document picker. */
  documents: DocumentSummary[];
  status: SessionStatus;
  /** Last error message (used by the UI for surfacing failures). */
  error: string | null;
  /** True iff a WebSocket is connected for the current document. */
  isConnected: boolean;

  refreshDocuments: () => Promise<void>;
  openDocument: (id: string) => Promise<void>;
  closeDocument: () => void;
  createNewDocument: (title: string) => Promise<void>;
  saveDocument: () => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  renameCurrent: (title: string) => void;

  /**
   * Broadcasts a message to other clients in the room.
   * No-op when no document is open (= no collaboration session).
   */
  broadcast: (type: CollaborationMessageType, data: unknown) => void;
}

const noop = () => {};

export const SessionContext = createContext<SessionContextInterface>({
  current: null,
  documents: [],
  status: 'idle',
  error: null,
  isConnected: false,
  refreshDocuments: async () => {},
  openDocument: async () => {},
  closeDocument: noop,
  createNewDocument: async () => {},
  saveDocument: async () => {},
  removeDocument: async () => {},
  renameCurrent: noop,
  broadcast: noop,
});
