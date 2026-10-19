import { CONTENT } from '../content.js';

/** Devise en écriture manuscrite, soulignée d'un trait doré. */
export default function Motto({ className = '' }) {
  return (
    <p className={'motto ' + className}>
      <span className="motto-words">{CONTENT.motto.join(' · ')}</span>
      <svg className="motto-swoosh" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
        <path d="M3 10 C 50 3, 120 2, 197 6" />
      </svg>
    </p>
  );
}
