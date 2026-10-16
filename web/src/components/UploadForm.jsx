import { useState } from 'react';
import { CONTENT } from '../content.js';
import { MIN_FILES, TYPE_BY_PREFIX } from '../config.js';
import { finalizeDossier, openDossier, uploadFile } from '../api.js';
import FileDrop from './FileDrop.jsx';

/**
 * Espace de dépôt en deux étapes :
 *  1. identification (email + n° WhatsApp du formulaire) → affiche le matricule ;
 *  2. dépôt des documents dans le dossier du matricule.
 */
export default function UploadForm({ initial, onBack, onDone }) {
  const [ident, setIdent] = useState({ email: initial.email || '', telephone: initial.telephone || '', website: '' });
  const [session, setSession] = useState(null); // { matricule, token, type, documents }
  const [choices, setChoices] = useState(null);
  const [items, setItems] = useState([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ ratio: 0, text: '' });

  const set = (name) => (e) => setIdent((f) => ({ ...f, [name]: e.target.value }));
  const updateItem = (id, patch) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function identify(e, matricule) {
    e?.preventDefault();
    if (busy) return;
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
    if (items.length < MIN_FILES) return setError(`Veuillez ajouter au moins ${MIN_FILES} document.`);
    if (!consent) return setError('Veuillez cocher la case de certification.');

    setError('');
    setBusy(true);
    try {
      let done = items.filter((i) => i.status === 'done').length;
      let failed = 0;
      for (const item of items.filter((i) => i.status !== 'done')) {
        setProgress({ ratio: done / items.length, text: `Envoi de « ${item.file.name} » (${done + 1}/${items.length})…` });
        updateItem(item.id, { status: 'uploading', error: null });
        try {
          await uploadFile(session, item.file);
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
        ident: { email: ident.email, telephone: ident.telephone },
      });
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
      if (/expirée|invalide/.test(err.message || '')) setSession(null); // réidentification
    } finally {
      setBusy(false);
    }
  }

  const type = session && TYPE_BY_PREFIX[session.matricule.split('_')[0]];
  const documents = type ? CONTENT.types[type].documents : [];

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
            <div className="row">
              <label>
                Email *
                <input type="email" value={ident.email} onChange={set('email')} maxLength={120} autoComplete="email" />
              </label>
              <label>
                N° WhatsApp *
                <input type="tel" value={ident.telephone} onChange={set('telephone')} maxLength={40}
                  placeholder="+237 6XX XX XX XX" autoComplete="tel" />
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
            {documents.length > 0 && (
              <div className="doc-hint">
                <p>Documents à fournir — {CONTENT.types[type].title} :</p>
                <ul>
                  {documents.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
            )}
            <FileDrop items={items} onChange={setItems} onError={setError} disabled={busy} />
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
