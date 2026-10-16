import { CONTENT } from '../content.js';

export default function Header({ onHome }) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <button type="button" className="brand" onClick={onHome}>
          {CONTENT.logo && <img src={CONTENT.logo} alt="" className="brand-logo" />}
          <span>{CONTENT.orgName}</span>
        </button>
        <span className="topbar-note">{CONTENT.tagline}</span>
      </div>
    </header>
  );
}
