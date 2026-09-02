import { useContext, useEffect } from 'react';

import s from './DocumentBar.module.css';
import { SessionContext } from '@/session/SessionContext';

/**
 * Top bar showing the current document and exposing
 * open / create / save / close controls.
 *
 * Sits as a sibling of the toolbar inside SessionProvider so it can
 * read and drive the session state.
 */
const DocumentBar = () => {
  const {
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
    renameCurrent,
  } = useContext(SessionContext);

  // Load the document list once on mount.
  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  const onPickDocument = (id: string) => {
    if (!id || id === current?.id) return;
    void openDocument(id);
  };

  const onNew = () => {
    const title = window.prompt('New document title?', 'Untitled');
    if (!title) return;
    void createNewDocument(title);
  };

  const onSave = () => {
    void saveDocument();
  };

  return (
    <div className={s.Bar}>
      <input
        className={`${s.Title} ${current ? '' : s.untitled}`}
        type="text"
        value={current?.title ?? 'No document open'}
        onChange={e => renameCurrent(e.target.value)}
        disabled={!current}
        aria-label="Document title"
      />

      <select
        className={s.Select}
        value={current?.id ?? ''}
        onChange={e => onPickDocument(e.target.value)}
        aria-label="Open document"
      >
        <option value="">{documents.length === 0 ? 'No documents' : 'Open…'}</option>
        {documents.map(doc => (
          <option key={doc.id} value={doc.id}>
            {doc.title}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={s.Action}
        onClick={() => void refreshDocuments()}
        title="Refresh list"
      >
        ↻
      </button>

      <button type="button" className={`${s.Action} ${s.Primary}`} onClick={onNew}>
        New
      </button>

      <button
        type="button"
        className={s.Action}
        onClick={onSave}
        disabled={!current || status === 'loading'}
      >
        Save
      </button>

      <button
        type="button"
        className={s.Action}
        onClick={closeDocument}
        disabled={!current}
      >
        Close
      </button>

      <div className={s.Spacer} />

      {current ? (
        <span className={`${s.Status} ${isConnected ? s.connected : s.disconnected}`}>
          {isConnected ? '● Live' : '○ Offline'}
        </span>
      ) : (
        <span className={s.Status}>Local only</span>
      )}

      {error ? <span className={s.Error} title={error}>⚠ {error}</span> : null}
    </div>
  );
};

export default DocumentBar;
