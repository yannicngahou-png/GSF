import { CONTENT } from '../content.js';
import Motto from './Motto.jsx';

export default function Header({ onHome }) {
  return (
    <header className="topbar">
      <span className="corner corner-gold" aria-hidden="true" />
      <span className="corner corner-green" aria-hidden="true" />
      <div className="wrap topbar-inner">
        <button type="button" className="brand" onClick={onHome} aria-label={CONTENT.orgName + ' — accueil'}>
          {CONTENT.logo && <img src={CONTENT.logo} alt="" className="brand-logo" />}
          <span className="brand-text">
            <span className="brand-name">{CONTENT.orgName}</span>
            <span className="brand-tagline">{CONTENT.tagline}</span>
          </span>
        </button>
        <Motto className="topbar-motto" />
      </div>
    </header>
  );
}
