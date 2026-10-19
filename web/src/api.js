import { APPS_SCRIPT_URL, DEMO_MODE } from './config.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Corps en text/plain pour éviter la requête CORS préalable, non gérée par Apps Script.
async function call(payload) {
  if (DEMO_MODE) return demo(payload);
  let res;
  try {
    res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
  } catch {
    throw new Error('Connexion au serveur impossible.');
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error('Réponse inattendue du serveur.');
  }
  if (!json.ok) throw new Error(json.error || 'Erreur serveur.');
  return json;
}

/** Simule le serveur pour prévisualiser la page sans rien envoyer. */
async function demo(payload) {
  await wait(payload.action === 'upload' ? 600 : 400);
  if (payload.action === 'open') {
    // Matricule fictif : le vrai est attribué par Apps Script à l'envoi du formulaire.
    return { ok: true, matricule: payload.matricule || 'DEMO_00000000_00000', token: 'demo', documents: 0 };
  }
  if (payload.action === 'finalize') return { ok: true, documents: payload.count };
  return { ok: true };
}

/** { email, telephone, matricule?, website } → { matricule, token } ou { choices: [...] } */
export function openDossier(fields) {
  return call({ action: 'open', ...fields });
}

/** `name` : nom du fichier enregistré dans Drive (par défaut, le nom d'origine). */
export async function uploadFile(session, file, name) {
  const payload = {
    action: 'upload',
    matricule: session.matricule,
    token: session.token,
    name: name || file.name,
    mimeType: file.type || 'application/octet-stream',
    data: await toBase64(file),
  };
  try {
    return await call(payload);
  } catch (err) {
    if (/Format|volumineux|maximum|expirée/.test(err.message)) throw err;
    return call(payload); // une nouvelle tentative en cas de coupure réseau
  }
}

export function finalizeDossier(session, count) {
  return call({ action: 'finalize', matricule: session.matricule, token: session.token, count });
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Lecture impossible : ' + file.name));
    reader.readAsDataURL(file);
  });
}
