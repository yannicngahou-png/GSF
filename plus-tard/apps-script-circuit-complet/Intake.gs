/**
 * Application web appelée par l'espace de dépôt de la landing page.
 * Le matricule et le dossier Drive existent déjà (créés à l'envoi du formulaire, voir Reception.gs).
 *
 *  1. open     → identifie le demandeur, renvoie son matricule et un jeton de dépôt
 *  2. upload   → enregistre un document dans le dossier (un appel par fichier)
 *  3. finalize → clôt le dépôt et met à jour le registre
 */
const UPLOAD_TTL_SECONDS = 6 * 60 * 60;

function doGet() {
  return json_({ ok: true, service: CONFIG.ORG_NAME + ' intake' });
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

/**
 * Identification du demandeur, au choix :
 *  - email + n° WhatsApp (ceux du formulaire) → retrouve le(s) dossier(s) ;
 *  - matricule + email (lien reçu par email).
 * Si plusieurs dossiers correspondent et qu'aucun matricule n'est donné, renvoie la liste à choisir.
 */
function openDossier_(req) {
  if (req.website) throw new Error('Requête refusée.'); // champ piège anti-robot
  const matricule = String(req.matricule || '').trim().toUpperCase();
  const email = String(req.email || '').trim().toLowerCase();
  const phone = phoneKey_(req.telephone);
  if (!email || (!matricule && !phone)) throw new Error('Veuillez indiquer votre email et votre numéro WhatsApp.');

  const sheet = registrySheet_();
  const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const map = headerMap_(sheet);
  const get = function (r, h) { return r[map[h] - 1]; };

  const matches = rows.filter(function (r) {
    if (String(get(r, 'Email')).trim().toLowerCase() !== email) return false;
    if (matricule) return String(get(r, 'Matricule')).toUpperCase() === matricule && (!phone || phoneKey_(get(r, 'Téléphone')) === phone);
    return phoneKey_(get(r, 'Téléphone')) === phone;
  });

  if (!matches.length) {
    throw new Error('Aucun dossier trouvé avec ces informations. Utilisez l\'email et le numéro WhatsApp ' +
      'indiqués dans votre formulaire. Si vous venez de l\'envoyer, patientez une minute puis réessayez.');
  }
  if (matches.length > 1) {
    return {
      choices: matches.map(function (r) {
        return { matricule: get(r, 'Matricule'), type: get(r, 'Type'), date: formatDate_(get(r, 'Date de souscription')) };
      }).reverse(),
    };
  }

  const data = {};
  Object.keys(map).forEach(function (h) { data[h] = get(matches[0], h); });

  const folderId = (String(data['Dossier (Drive)']).match(/folders\/([\w-]+)/) || [])[1];
  if (!folderId) throw new Error('Dossier introuvable, contactez-nous.');

  const found = String(data['Matricule']).toUpperCase();
  const token = Utilities.getUuid();
  const count = countFiles_(folderId);
  saveSession_(found, { token: token, folderId: folderId, count: count });
  return { matricule: found, token: token, nom: data['Nom / Raison sociale'], type: data['Type'], documents: count };
}

/** 9 derniers chiffres du numéro : tolère les variantes d'écriture (+237, 00237, espaces…). */
function phoneKey_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-9) : '';
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
  const matricule = String(req.matricule).toUpperCase();
  const count = countFiles_(session.folderId);

  const sheet = registrySheet_();
  const row = findRow_(sheet, headerMap_(sheet)['Matricule'], matricule);
  if (row > 0) {
    setByHeader_(sheet, row, 'Nb documents', count);
    setByHeader_(sheet, row, 'Dernier dépôt', new Date());
  }

  CacheService.getScriptCache().remove('upload:' + matricule);
  return { documents: count };
}

function countFiles_(folderId) {
  const files = DriveApp.getFolderById(folderId).getFiles();
  let count = 0;
  while (files.hasNext()) { files.next(); count++; }
  return count;
}

function saveSession_(matricule, session) {
  CacheService.getScriptCache().put('upload:' + matricule, JSON.stringify(session), UPLOAD_TTL_SECONDS);
}

function checkSession_(req) {
  const raw = CacheService.getScriptCache().get('upload:' + String(req.matricule || '').toUpperCase());
  const session = raw ? JSON.parse(raw) : null;
  if (!session || session.token !== req.token) {
    throw new Error('Session de dépôt expirée ou invalide. Veuillez recommencer.');
  }
  return session;
}
