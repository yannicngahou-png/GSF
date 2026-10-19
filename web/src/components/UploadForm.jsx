import { useState } from 'react';
import { CONTENT } from '../content.js';
import { ALLOWED_EXTENSIONS, MAX_FILE_MB, MAX_FILES, TYPE_BY_PREFIX } from '../config.js';
import { finalizeDossier, openDossier, uploadFile } from '../api.js';
import FileDrop from './FileDrop.jsx';

/**
 * Espace de dépôt en deux étapes :
 *  1. identification (type de demande + email + n° WhatsApp du formulaire) → affiche le matricule ;
 *  2. dépôt des documents : une zone par document attendu (CONTENT.types[type].documents).
 */
export default function UploadForm({ initial, onBack, onDone }) {
  const [ident, setIdent] = useState({
    type: initial.type || '',
    email: initial.email || '',
    telephone: initial.telephone || '',
    website: '',
  });
  const [session, setSession] = useState(null); // { matricule, token, documents }
  const [choices, setChoices] = useState(null);
  const [items, setItems] = useState([]); // { id, doc (index), file, status, error }
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ ratio: 0, text: '' });

  const type = (session && TYPE_BY_PREFIX[session.matricule.split('_')[0]]) || ident.type;
  const documents = type ? CONTENT.types[type].documents : [];

  const set = (name) => (e) => setIdent((f) => ({ ...f, [name]: e.target.value }));
  const updateItem = (id, patch) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  /** Ajoute des fichiers à la rubrique `doc`, après contrôle du format, de la taille et du nombre. */
  function addFiles(doc, list) {
    const errors = [];
    setItems((current) => {
      const next = [...current];
      Array.from(list).forEach((file) => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) return errors.push(`${file.name} : format non autorisé`);
        if (file.size > MAX_FILE_MB * 1024 * 1024) return errors.push(`${file.name} : dépasse ${MAX_FILE_MB} Mo`);
        if (next.some((i) => i.doc === doc && i.file.name === file.name && i.file.size === file.size)) return;
        if (next.length >= MAX_FILES) return errors.push(`Maximum ${MAX_FILES} fichiers au total`);
        next.push({ id: crypto.randomUUID(), doc, file, status: 'pending' });
      });
      return next;
    });
    setError(errors.join('\n'));
  }

  async function identify(e, matricule) {
    e?.preventDefault();
    if (busy) return;
    if (!ident.type) return setError('Veuillez choisir le type de demande.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ident.email.trim())) return setError('Adresse email invalide.');
    if (ident.telephone.replace(/\D/g, '').length < 8) return setError('Numéro WhatsApp invalide.');

    setError('');
    setBusy(true);
    try {
      const res = await openDossier({ ...ident, email: ident.email.trim(), matricule: matricule || '' });
      if (res.choices) {
        setChoices(res.choices);
      } else {
        setChoices(null);
        setSession({ matricule: res.matricule, token: res.token, documents: res.documents });
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }

  async function upload(e) {
    e.preventDefault();
    if (busy) return;
    const missing = documents.filter((d, i) => d.required && !items.some((it) => it.doc === i));
    if (missing.length) {
      return setError('Documents obligatoires manquants :\n' + missing.map((d) => '• ' + d.label).join('\n'));
    }
    if (!items.length) return setError('Veuillez ajouter au moins un document.');
    if (!consent) return setError('Veuillez cocher la case de certification.');

    setError('');
    setBusy(true);
    try {
      // Envoi dans l'ordre des rubriques ; le nom du fichier commence par celui du document.
      const ordered = [...items].sort((a, b) => a.doc - b.doc);
      let done = ordered.filter((i) => i.status === 'done').length;
      let failed = 0;
      for (const item of ordered.filter((i) => i.status !== 'done')) {
        const doc = documents[item.doc];
        setProgress({ ratio: done / items.length, text: `${doc.label} : « ${item.file.name} » (${done + 1}/${items.length})…` });
        updateItem(item.id, { status: 'uploading', error: null });
        try {
          await uploadFile(session, item.file, `${doc.prefix} - ${item.file.name}`);
          updateItem(item.id, { status: 'done' });
          done++;
        } catch (err) {
          updateItem(item.id, { status: 'error', error: err.message });
          failed++;
        }
      }
      if (failed) {
        throw new Error(`${failed} document(s) n'ont pas pu être envoyés. Vérifiez votre connexion puis cliquez sur « Réessayer ».`);
      }

      setProgress({ ratio: 1, text: 'Finalisation…' });
      const fin = await finalizeDossier(session, items.length);
      onDone({
        matricule: session.matricule,
        sent: items.length,
        documents: fin.documents,
        ident: { type: ident.type, email: ident.email, telephone: ident.telephone },
      });
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
      if (/expirée|invalide/.test(err.message || '')) setSession(null); // réidentification
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <button type="button" className="back" onClick={onBack} disabled={busy}>
        ← Retour
      </button>
      <h2>{CONTENT.upload.title}</h2>

      {!session ? (
        <form className="card" onSubmit={identify} noValidate>
          <p className="muted intro">{CONTENT.upload.text}</p>
          <fieldset disabled={busy}>
            <legend>1. Identifiez-vous</legend>
            <div className="type-switch" role="radiogroup" aria-label="Type de demande">
              {['assistance', 'pret'].map((t) => (
                <label key={t} className={'type-option' + (ident.type === t ? ' is-active' : '')}>
                  <input type="radio" name="type" value={t} checked={ident.type === t}
                    onChange={() => { setIdent((f) => ({ ...f, type: t })); setChoices(null); }} />
                  {CONTENT.types[t].title}
                </label>
              ))}
            </div>
            {ident.type && CONTENT.upload.hints[ident.type] && (
              <p className="field-hint">{CONTENT.upload.hints[ident.type]}</p>
            )}
            <div className="row">
              <label>
                Email *
                <input type="email" value={ident.email} onChange={set('email')} maxLength={120} autoComplete="email" />
              </label>
              <label>
                N° WhatsApp *
                <input type="tel" value={ident.telephone} onChange={set('telephone')} maxLength={40}
                  placeholder="+33 XX XX XX XX" autoComplete="tel" />
              </label>
            </div>
            <label className="hp" aria-hidden="true">
              Site web
              <input tabIndex={-1} value={ident.website} onChange={set('website')} autoComplete="off" />
            </label>
          </fieldset>

          {choices && (
            <div className="choices-list">
              <p>Plusieurs dossiers correspondent. Choisissez celui à compléter :</p>
              {choices.map((c) => (
                <button key={c.matricule} type="button" className="btn btn-ghost" disabled={busy}
                  onClick={(e) => identify(e, c.matricule)}>
                  <code>{c.matricule}</code> — {c.type}, {c.date}
                </button>
              ))}
            </div>
          )}

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Recherche…' : 'Retrouver mon dossier'}
          </button>
        </form>
      ) : (
        <form className="card" onSubmit={upload} noValidate>
          <div className="matricule-found">
            <span>Votre matricule de dossier</span>
            <code>{session.matricule}</code>
            <small>Notez-le : il vous sera demandé pour tout suivi.
              {session.documents > 0 && ` ${session.documents} document(s) déjà dans votre dossier.`}</small>
          </div>

          <fieldset>
            <legend>2. Vos documents</legend>
            <p className="field-hint">
              {ALLOWED_EXTENSIONS.join(', ').toUpperCase()} — {MAX_FILE_MB} Mo max par fichier.
              Les documents marqués <strong className="req">*</strong> sont obligatoires.
            </p>
            <ol className="doc-slots">
              {documents.map((d, i) => {
                const slotItems = items.filter((it) => it.doc === i);
                return (
                  <li key={d.prefix} className={'doc-slot' + (slotItems.length ? ' is-filled' : '')}>
                    <div className="doc-slot-head">
                      <span className="doc-slot-num">{slotItems.length ? '✓' : i + 1}</span>
                      <div>
                        <p className="doc-slot-label">
                          {d.label} {d.required ? <strong className="req">*</strong> : <span className="opt">(facultatif)</span>}
                        </p>
                        {d.hint && <p className="doc-slot-hint">{d.hint}</p>}
                        {d.template && (
                          <a className="btn btn-gold btn-template" href={d.template.url}
                            {...(d.template.url.startsWith('/')
                              ? { download: d.template.url.split('/').pop() }  // fichier du site : téléchargement direct
                              : { target: '_blank', rel: 'noopener noreferrer' })}>
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                              <path fill="currentColor" d="M11 4h2v8.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3V4zM5 18h14v2H5v-2z" />
                            </svg>
                            {d.template.label}
                          </a>
                        )}
                      </div>
                    </div>
                    <FileDrop
                      compact
                      items={slotItems}
                      disabled={busy}
                      onAdd={(list) => addFiles(i, list)}
                      onRemove={(id) => setItems((list) => list.filter((it) => it.id !== id))}
                    />
                  </li>
                );
              })}
            </ol>
          </fieldset>

          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
            <span>{CONTENT.consent}</span>
          </label>

          {error && <div className="alert alert-error" role="alert">{error}</div>}

          {busy && (
            <div className="progress">
              <div className="progress-bar"><span style={{ width: Math.round(progress.ratio * 100) + '%' }} /></div>
              <p>{progress.text}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {items.some((i) => i.status === 'error') ? 'Réessayer' : 'Envoyer mes documents'}
          </button>
        </form>
      )}
    </section>
  );
}
