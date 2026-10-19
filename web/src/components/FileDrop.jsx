import { useState } from 'react';
import { ALLOWED_EXTENSIONS, MAX_FILE_MB } from '../config.js';

const STATE_LABELS = { uploading: 'Envoi…', done: 'Envoyé', error: 'Échec' };

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' Ko' : (bytes / 1024 / 1024).toFixed(1) + ' Mo';
}

/**
 * Zone de dépôt d'un document.
 * items : [{ id, file, status: 'pending' | 'uploading' | 'done' | 'error', error }]
 * onAdd(FileList) : fichiers choisis ou glissés · onRemove(id) : retrait d'un fichier
 */
export default function FileDrop({ items, onAdd, onRemove, disabled, compact }) {
  const [over, setOver] = useState(false);

  const dragProps = {
    onDragEnter: (e) => { e.preventDefault(); setOver(true); },
    onDragOver: (e) => { e.preventDefault(); setOver(true); },
    onDragLeave: (e) => { e.preventDefault(); setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); if (!disabled) onAdd(e.dataTransfer.files); },
  };

  return (
    <>
      <label className={'dropzone' + (over ? ' is-over' : '') + (compact ? ' dropzone-compact' : '')} {...dragProps}>
        <input
          type="file"
          multiple
          disabled={disabled}
          accept={ALLOWED_EXTENSIONS.map((e) => '.' + e).join(',')}
          onChange={(e) => { onAdd(e.target.files); e.target.value = ''; }}
        />
        <span className="dz-title">
          {items.length ? 'Ajouter un autre fichier' : 'Glissez le fichier ici ou'} <u>parcourez</u>
        </span>
        {!compact && (
          <span className="dz-hint">
            {ALLOWED_EXTENSIONS.join(', ').toUpperCase()} — {MAX_FILE_MB} Mo max par fichier
          </span>
        )}
      </label>

      {items.length > 0 && (
        <ul className="file-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="file-name" title={item.file.name}>{item.file.name}</span>
              <span className="file-size">{formatSize(item.file.size)}</span>
              {STATE_LABELS[item.status] && (
                <span className={`file-state ${item.status}`} title={item.error || ''}>
                  {STATE_LABELS[item.status]}
                </span>
              )}
              {item.status !== 'done' && !disabled && (
                <button
                  type="button"
                  className="file-remove"
                  aria-label={'Retirer ' + item.file.name}
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
