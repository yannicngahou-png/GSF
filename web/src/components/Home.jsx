import { CONTENT } from '../content.js';
import { FORMS } from '../config.js';

const ICONS = {
  assistance: (
    <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2 0 3.5 1.1 4.3 2.4h2c.8-1.3 2.3-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
  ),
  pret: (
    <path fill="currentColor" d="M3 10 12 4l9 6v2H3v-2zm2 4h2v5H5v-5zm4 0h2v5H9v-5zm4 0h2v5h-2v-5zm4 0h2v5h-2v-5zM3 20h18v2H3v-2z" />
  ),
  upload: (
    <path fill="currentColor" d="M11 16V7.8l-3.3 3.3-1.4-1.4L12 4l5.7 5.7-1.4 1.4L13 7.8V16h-2zm-7 2h16v2H4v-2z" />
  ),
};

export default function Home({ onUpload }) {
  return (
    <section>
      {/* Bandeau « coup de pinceau » */}
      <div className="hero">
        <div className="brush">
          <svg className="hero-megaphone" viewBox="0 0 64 64" aria-hidden="true">
            <path className="ray" d="M50 14l6-6M54 26h8M50 38l6 6" />
            <path className="horn" d="M8 26h8l24-14v40L16 38H8z" />
            <path className="handle" d="M16 38l4 14h7l-3-13" />
          </svg>
          <div className="brush-content">
            <p className="hero-kicker">{CONTENT.hero.kicker}</p>
            <h1>
              {CONTENT.hero.title}
              <span className="hero-highlight">{CONTENT.hero.highlight}</span>
            </h1>
            <p className="hero-script">{CONTENT.tagline}</p>
          </div>
        </div>
        <p className="lead">{CONTENT.hero.text}</p>
      </div>

      {/* Étapes */}
      <ol className="steps-overview">
        {CONTENT.steps.map((s, i) => (
          <li key={s}>
            <span className="step-num">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {/* Les deux demandes */}
      <div className="choices">
        {['assistance', 'pret'].map((t) => {
          const c = CONTENT.types[t];
          return (
            <a key={t} className={'choice choice-' + t} href={FORMS[t]} target="_blank" rel="noopener noreferrer">
              <span className="choice-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28">{ICONS[t]}</svg>
              </span>
              <span className="choice-title">{c.title}</span>
              <span className="choice-text">{c.text}</span>
              <span className="choice-cta">{c.cta} →</span>
            </a>
          );
        })}
      </div>

      {/* Dépôt des documents */}
      <button type="button" className="upload-card" onClick={onUpload}>
        <span className="choice-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">{ICONS.upload}</svg>
        </span>
        <span className="upload-card-body">
          <span className="choice-title">{CONTENT.uploadCard.title}</span>
          <span className="choice-text">{CONTENT.uploadCard.text}</span>
        </span>
        <span className="btn btn-gold">{CONTENT.uploadCard.cta} →</span>
      </button>
    </section>
  );
}
