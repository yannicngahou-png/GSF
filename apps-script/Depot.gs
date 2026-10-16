/**
 * Application web appelée par l'espace « Déposer mes documents » de la landing page.
 *
 *  1. open     → retrouve le dossier (type de demande + email + n° WhatsApp du formulaire),
 *                renvoie le matricule et un jeton
 *  2. upload   → enregistre un document dans le dossier du matricule (un appel par fichier)
 *  3. finalize → clôt le dépôt
 */
const SESSION_SECONDS = 6 * 60 * 60;

function doGet() {
  return json_({ ok: true, service: 'GSF dépôt' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    let result;
    switch (req.action) {
      case 'open': result = openDossier_(req); break;
      case 'upload': result = uploadFile_(req); break;
      case 'finalize': result = finalizeDossier_(req); break;
      default: throw new Error('Action inconnue.');
    }
    return json_(Object.assign({ ok: true }, result));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: err.message });
  }
}

function openDossier_(req) {
  if (req.website) throw new Error('Requête refusée.'); // champ piège anti-robot
  const typeKey = String(req.type || '');
  if (!CONFIG.TYPES[typeKey]) throw new Error('Veuillez choisir le type de demande (aide ou prêt).');
  const email = String(req.email || '').trim().toLowerCase();
  const phone = phoneKey_(req.telephone);
  const wanted = String(req.matricule || '').trim().toUpperCase();
  if (!email || !phone) throw new Error('Veuillez indiquer votre email et votre numéro WhatsApp.');

  let matches = findDossiers_(typeKey, email, phone);
  if (wanted) matches = matches.filter(function (m) { return m.matricule === wanted; });
  if (!matches.length) {
    throw new Error('Aucun dossier trouvé avec ces informations. Utilisez l\'email et le numéro WhatsApp ' +
      'indiqués dans votre formulaire. Si vous venez de l\'envoyer, patientez une minute puis réessayez.');
  }
  if (matches.length > 1) {
    return { choices: matches.map(function (m) { return { matricule: m.matricule, type: m.label, date: m.date }; }) };
  }

  const m = matches[0];
  const parent = DriveApp.getFolderById(CONFIG.TYPES[m.typeKey].folderId);
  const it = parent.getFoldersByName(m.matricule);
  const folder = it.hasNext() ? it.next() : parent.createFolder(m.matricule);

  const token = Utilities.getUuid();
  const count = countFiles_(folder);
  saveSession_(m.matricule, { token: token, folderId: folder.getId(), count: count });
  return { matricule: m.matricule, token: token, documents: count };
}

/**
 * Recherche dans le fichier de réponses du type choisi les envois correspondant à cet email + téléphone.
 * Si la demande a été remplie par une tierce personne (thirdParty), on compare avec ses coordonnées.
 */
function findDossiers_(typeKey, email, phone) {
  const t = CONFIG.TYPES[typeKey];
  const sheet = responseSheet_(SpreadsheetApp.openById(t.responseSheetId));
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values[0].map(normalizeTitle_);
  const col = function (title) { return title ? headers.indexOf(normalizeTitle_(title)) : -1; };

  const cMat = col(CONFIG.MATRICULE_HEADER);
  const member = { email: col(t.contacts.email), phone: col(t.contacts.telephone) };
  const tp = t.thirdParty;
  const third = tp ? { question: col(tp.question), email: col(tp.email), phone: col(tp.telephone) } : null;
  if (cMat < 0 || member.email < 0 || member.phone < 0) {
    throw new Error('Colonnes introuvables dans le fichier de réponses « ' + t.label + ' » : vérifiez Config.');
  }

  const found = [];
  values.slice(1).forEach(function (r) {
    const matricule = String(r[cMat] || '').trim().toUpperCase();
    if (!matricule) return;

    let c = member;
    if (third && third.question >= 0 && normalizeTitle_(r[third.question]) === normalizeTitle_(tp.answer) &&
        String(r[third.email] || '').trim() && String(r[third.phone] || '').trim()) {
      c = third;
    }
    if (String(r[c.email]).trim().toLowerCase() !== email || phoneKey_(r[c.phone]) !== phone) return;

    const date = r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : '';
    found.push({ matricule: matricule, typeKey: typeKey, label: t.label, date: date });
  });
  return found.reverse(); // le plus récent en premier
}

/** 1re ligne de l'intitulé, sans casse, espaces superflus ni « : » final. */
function normalizeTitle_(value) {
  return String(value == null ? '' : value).split('\n')[0].toLowerCase().replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
}

function uploadFile_(req) {
  const session = checkSession_(req);
  if (session.count >= CONFIG.MAX_FILES) throw new Error('Nombre maximum de documents atteint (' + CONFIG.MAX_FILES + ').');

  const name = String(req.name || 'document').replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (CONFIG.ALLOWED_EXTENSIONS.indexOf(ext) === -1) throw new Error('Format non autorisé : ' + name);

  const data = String(req.data || '');
  if (data.length * 0.75 > CONFIG.MAX_FILE_MB * 1024 * 1024) {
    throw new Error('Fichier trop volumineux (max ' + CONFIG.MAX_FILE_MB + ' Mo) : ' + name);
  }

  const blob = Utilities.newBlob(Utilities.base64Decode(data), req.mimeType || 'application/octet-stream', name);
  DriveApp.getFolderById(session.folderId).createFile(blob);

  session.count += 1;
  saveSession_(String(req.matricule).toUpperCase(), session);
  return { name: name };
}

function finalizeDossier_(req) {
  const session = checkSession_(req);
  const count = countFiles_(DriveApp.getFolderById(session.folderId));
  CacheService.getScriptCache().remove('depot:' + String(req.matricule).toUpperCase());
  return { documents: count };
}

/**
 * 8 derniers chiffres du numéro : tolère les variantes d'écriture (+237, 00237, 0 initial, espaces…),
 * y compris pour les pays aux numéros à 8 chiffres (ex. Gabon).
 */
function phoneKey_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : '';
}

function countFiles_(folder) {
  const files = folder.getFiles();
  let n = 0;
  while (files.hasNext()) { files.next(); n++; }
  return n;
}

function saveSession_(matricule, session) {
  CacheService.getScriptCache().put('depot:' + matricule, JSON.stringify(session), SESSION_SECONDS);
}

function checkSession_(req) {
  const raw = CacheService.getScriptCache().get('depot:' + String(req.matricule || '').toUpperCase());
  const session = raw ? JSON.parse(raw) : null;
  if (!session || session.token !== req.token) {
    throw new Error('Session de dépôt expirée ou invalide. Veuillez recommencer.');
  }
  return session;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
