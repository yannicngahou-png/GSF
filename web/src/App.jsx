import { useEffect, useState } from 'react';
import { CONTENT, THEME } from './content.js';
import { DEMO_MODE } from './config.js';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import UploadForm from './components/UploadForm.jsx';
import Done from './components/Done.jsx';
import Motto from './components/Motto.jsx';

// Couleurs de content.js → variables CSS utilisées dans styles.css
const CSS_VARS = {
  primary: '--primary',
  primaryDark: '--primary-dark',
  green: '--green',
  gold: '--gold',
  background: '--bg',
  text: '--ink',
  muted: '--muted',
};

// Accès direct à l'espace de dépôt : /?depot ou /?email=... (lien du message de confirmation ou d'un email)
const params = new URLSearchParams(window.location.search);
const fromLink = { email: params.get('email') || '', telephone: '' };
const directUpload = params.has('depot') || params.has('email');

export default function App() {
  // view : 'home' | 'upload' | 'done'
  const [view, setView] = useState(directUpload ? 'upload' : 'home');
  const [initial, setInitial] = useState(fromLink);
  const [result, setResult] = useState(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    Object.entries(CSS_VARS).forEach(([k, v]) => document.documentElement.style.setProperty(v, THEME[k]));
    document.title = `${CONTENT.orgName} — Demandes de financement`;
  }, []);

  useEffect(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [view]);

  const finish = (res) => {
    setResult(res);
    setView('done');
  };

  const uploadMore = () => {
    setInitial(result.ident);
    setFormKey((k) => k + 1);
    setView('upload');
  };

  return (
    <>
      <Header onHome={() => setView('home')} />
      {DEMO_MODE && (
        <div className="demo-banner">
          Mode démo : matricule fictif, aucun fichier n'est envoyé. Renseignez <code>VITE_APPS_SCRIPT_URL</code> dans{' '}
          <code>web/.env.local</code> pour brancher la page sur Apps Script.
        </div>
      )}
      <main className="wrap">
        {view === 'home' && <Home onUpload={() => setView('upload')} />}
        {view === 'upload' && (
          <UploadForm key={formKey} initial={initial} onBack={() => setView('home')} onDone={finish} />
        )}
        {view === 'done' && <Done result={result} onMore={uploadMore} onHome={() => setView('home')} />}
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <div className="footer-brand">
            {CONTENT.logo && <img src={CONTENT.logo} alt="" className="footer-logo" />}
            <span>
              <strong>{CONTENT.orgName}</strong>
              <span className="footer-tagline">{CONTENT.tagline}</span>
            </span>
          </div>
          <Motto className="footer-motto" />
          <p className="footer-copy">© {new Date().getFullYear()} {CONTENT.footer}</p>
        </div>
      </footer>
    </>
  );
}
