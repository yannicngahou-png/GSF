import { CONTENT } from '../content.js';

export default function Done({ result, onMore, onHome }) {
  return (
    <section className="card done">
      <div className="done-check" aria-hidden="true">✓</div>
      <h2>{CONTENT.done.title}</h2>
      <p>{CONTENT.done.text}</p>
      <div className="matricule-box">
        <code>{result.matricule}</code>
      </div>
      <p className="muted">
        {result.sent} document(s) envoyé(s) — {result.documents} document(s) au total dans votre dossier.
      </p>
      <p className="muted small">{CONTENT.done.note}</p>
      <div className="done-actions">
        <button type="button" className="btn btn-primary" onClick={onMore}>Ajouter d'autres documents</button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>Retour à l'accueil</button>
      </div>
    </section>
  );
}
