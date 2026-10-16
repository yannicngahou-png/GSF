import { useState } from 'react';
import { ALLOWED_EXTENSIONS, MAX_FILE_MB, MAX_FILES } from '../config.js';

const STATE_LABELS = { uploading: 'Envoi…', done: 'Envoyé', error: 'Échec' };

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? Math.ceil(bytes / 1024) + ' Ko' : (bytes / 1024 / 1024).toFixed(1) + ' Mo';
}

/** items : [{ id, file, status: 'pending' | 'uploading' | 'done' | 'error', error }] */
export default function FileDrop({ items, onChange, onError, disabled }) {
  const [over, setOver] = useState(false);

  const add = (list) => {
    if (disabled) return;
    const errors = [];
    const next = [...items];
    Array.from(list).forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) return errors.push(`${file.name} : format non autorisé`);
      if (file.size > MAX_FILE_MB * 1024 * 1024) return errors.push(`${file.name} : dépasse ${MAX_FILE_MB} Mo`);
      if (next.some((i) => i.file.name === file.name && i.file.size === file.size)) return;
      if (next.length >= MAX_FILES) return errors.push(`Maximum ${MAX_FILES} fichiers`);
      next.push({ id: crypto.randomUUID(), file, status: 'pending' });
    });
    onError(errors.join('\n'));
    onChange(next);
  };

  const dragProps = {
    onDragEnter: (e) => { e.preventDefault(); setOver(true); },
    onDragOver: (e) => { e.preventDefault(); setOver(true); },
    onDragLeave: (e) => { e.preventDefault(); setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); },
  };

  return (
    <>
      <label className={'dropzone' + (over ? ' is-over' : '')} {...dragProps}>
        <input
          type="file"
          multiple
          disabled={disabled}
          accept={ALLOWED_EXTENSIONS.map((e) => '.' + e).join(',')}
          onChange={(e) => { add(e.target.files); e.target.value = ''; }}
        />
        <span className="dz-title">
          Glissez vos fichiers ici ou <u>parcourez</u>
        </span>
        <span className="dz-hint">
          {ALLOWED_EXTENSIONS.join(', ').toUpperCase()} — {MAX_FILE_MB} Mo max par fichier, {MAX_FILES} fichiers max
        </span>
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
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
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
