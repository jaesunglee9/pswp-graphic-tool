import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  SessionContext,
  SessionContextInterface,
  SessionStatus,
  OpenDocument,
} from '@/session/SessionContext';
import { CollaborationClient } from '@/collaboration/CollaborationClient';
import {
  DocumentSummary,
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from '@/api/documentApi';
import { GraphicObjectInterface } from '@/models/GraphicObjectInterface';
import { model } from '@/models/GraphicEditorModel';
import { commandManager } from '@/commands/CommandManager';

/**
 * Owns the lifecycle of "which document is open" and the WebSocket
 * collaboration channel for that document.
 *
 * The collaboration client is intentionally kept in a ref rather than
 * state: changes to it never need to trigger a re-render (only
 * `isConnected` does), and keeping it stable lets the controller layer
 * call `broadcast` from anywhere without dependency churn.
 */
/** Yjs updates are binary; the documents.content column is TEXT. */
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const SessionProvider = ({ children }: PropsWithChildren) => {
  const [current, setCurrent] = useState<OpenDocument | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const collabRef = useRef<CollaborationClient | null>(null);
  const modelUnsubRef = useRef<(() => void) | null>(null);
  const openUnsubRef = useRef<(() => void) | null>(null);

  const teardownCollab = useCallback(() => {
    if (collabRef.current) {
      collabRef.current.disconnect();
      collabRef.current = null;
    }
    if (modelUnsubRef.current) {
      modelUnsubRef.current();
      modelUnsubRef.current = null;
    }
    if (openUnsubRef.current) {
      openUnsubRef.current();
      openUnsubRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return teardownCollab;
  }, [teardownCollab]);

  const refreshDocuments = useCallback(async () => {
    try {
      const list = await listDocuments();
      setDocuments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list documents');
    }
  }, []);

  /**
   * Loads stored document content into the model.
   *
   * Content is a base64-encoded Yjs update, NOT JSON. This matters: seeding two
   * clients from a JSON snapshot makes each one build its own Y.Map objects, so
   * the two replicas share no CRDT identity and merging them duplicates every
   * shape (verified: two docs seeded from ['x','y'] merge to
   * ["x","y","x","y"]). Applying the same update bytes is idempotent instead,
   * so every client converges on one document.
   *
   * Legacy JSON content is still read, once, so documents created before this
   * change still open. The next save rewrites them as binary.
   */
  const loadContentIntoModel = (content: string) => {
    if (!content) {
      commandManager.clear();
      return;
    }

    if (content.trimStart().startsWith('[')) {
      // Legacy JSON snapshot. Safe here only because the model is empty.
      let parsed: GraphicObjectInterface[];
      try {
        parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        parsed = [];
      }
      model.restore(parsed);
      commandManager.clear();
      return;
    }

    try {
      model.applyRemoteUpdate(base64ToBytes(content));
    } catch (err) {
      console.error('[Session] Could not apply stored document state:', err);
    }
    commandManager.clear();
  };

  const startCollabSession = (documentId: string) => {
    teardownCollab();

    const client = new CollaborationClient(documentId);
    collabRef.current = client;

    const sendSync = (update: Uint8Array) => {
      const packet = new Uint8Array(1 + update.length);
      packet[0] = 0; // envelope: 0 = Yjs document sync
      packet.set(update, 1);
      client.send(packet);
    };

    client.onMessage(uint8 => {
      if (uint8.length < 1) return;
      const msgType = uint8[0];
      const payload = uint8.subarray(1);

      if (msgType === 0) {
        model.applyRemoteUpdate(payload);
      } else if (msgType === 2) {
        // A peer just joined and is asking who has state. Answer with ours.
        // This is the return leg of the handshake: without it a joiner only
        // ever announces what it has and nobody tells it what it is missing,
        // so opening a document with existing content shows a blank canvas.
        sendSync(model.encodeStateAsUpdate());
      }
    });

    // On every connect (including reconnects) push our whole document state.
    // The server keeps no replica, so this is what makes a peer converge: each
    // side hands the other everything it has, and Yjs merges. It is also how a
    // client that edited while disconnected gets its work back into the room --
    // send() silently drops frames while the socket is closed.
    openUnsubRef.current = client.onOpen(() => {
      sendSync(model.encodeStateAsUpdate());
      client.send(new Uint8Array([2])); // ask peers for theirs
    });

    // Capture and package outbound local model updates
    modelUnsubRef.current = model.onLocalUpdate(sendSync);

    // Best-effort liveness signal. We can't subscribe to the underlying
    // `ws.onopen` from outside the class, so poll once shortly after.
    const checkConnected = () => setIsConnected(client.isConnected);
    client.connect();
    const t = window.setTimeout(checkConnected, 250);
    const t2 = window.setTimeout(checkConnected, 1000);
    // Cleanup tied to teardown via WeakRef-free closure: nothing to clean
    // up explicitly — the timeouts only flip a stale flag.
    void t;
    void t2;
  };

  const openDocument = useCallback(async (id: string) => {
    setStatus('loading');
    setError(null);
    try {
      const doc = await getDocument(id);
      loadContentIntoModel(doc.content);
      setCurrent({ id: doc.id, title: doc.title });
      startCollabSession(doc.id);
      setStatus('open');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open document');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDocument = useCallback(() => {
    teardownCollab();
    setCurrent(null);
    setStatus('idle');
    model.restore([]);
    commandManager.clear();
  }, [teardownCollab]);

  const createNewDocument = useCallback(async (title: string) => {
    setStatus('loading');
    setError(null);
    try {
      const content = bytesToBase64(model.encodeStateAsUpdate());
      const doc = await createDocument(title, content);
      setCurrent({ id: doc.id, title: doc.title });
      startCollabSession(doc.id);
      await refreshDocuments();
      setStatus('open');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDocuments]);

  const saveDocument = useCallback(async () => {
    if (!current) return;
    setError(null);
    try {
      const content = bytesToBase64(model.encodeStateAsUpdate());
      await updateDocument(current.id, { title: current.title, content });
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    }
  }, [current, refreshDocuments]);

  const renameCurrent = useCallback((title: string) => {
    setCurrent(prev => (prev ? { ...prev, title } : prev));
  }, []);

  const removeDocument = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await deleteDocument(id);
        if (current?.id === id) {
          closeDocument();
        }
        await refreshDocuments();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete document');
      }
    },
    [current, closeDocument, refreshDocuments]
  );

  const broadcast = useCallback(
    () => {
      // No-op: sync is handled by the model's Yjs local-update listener.
      // TODO(ship-review): delete broadcast() and its 13 call sites entirely --
      // see PLAN.md decision log, cleanup step 12.
    },
    []
  );

  const value: SessionContextInterface = {
    current,
    documents,
    status,
    error,
    isConnected,
    refreshDocuments,
    openDocument,
    closeDocument,
    createNewDocument,
    saveDocument,
    removeDocument,
    renameCurrent,
    broadcast,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export default SessionProvider;
