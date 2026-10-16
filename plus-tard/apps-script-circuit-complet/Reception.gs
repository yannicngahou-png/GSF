/**
 * Réception des demandes : à chaque envoi d'un Google Form, le script
 *  1. attribue le matricule et l'inscrit sur la ligne de réponse ;
 *  2. crée le dossier Drive du demandeur, nommé uniquement par le matricule ;
 *  3. ajoute le demandeur au registre ;
 *  4. (si CONFIG.SEND_EMAILS) envoie au demandeur son matricule par email.
 * Sans email, le demandeur retrouve son matricule sur la landing page (voir Intake.gs).
 */

/** Déclencheur « à l'envoi du formulaire » posé sur chaque feuille de réponses. */
function onFormSubmitHandler(e) {
  const sheet = e.range.getSheet();
  const ss = sheet.getParent();
  const typeKey = Object.keys(CONFIG.TYPES).find(function (k) {
    return CONFIG.TYPES[k].responseSheetId === ss.getId();
  });
  if (!typeKey) return;
  const type = CONFIG.TYPES[typeKey];

  // Les clés de namedValues sont les intitulés des questions.
  const nv = e.namedValues || {};
  const field = function (prefix) {
    if (!prefix) return '';
    const p = prefix.toLowerCase();
    const k = Object.keys(nv).find(function (key) { return key.trim().toLowerCase().indexOf(p) === 0; });
    return k ? String(nv[k][0] || '').trim() : '';
  };
  const ff = type.formFields;
  const nom = (field(ff.nom).toUpperCase() + ' ' + field(ff.prenom)).trim();
  const email = field(ff.email).toLowerCase();
  const responseRow = e.range.getRow();
  const responseUrl = ss.getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + responseRow;

  const registry = registrySheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let matricule;
  let folder;
  try {
    // Un même envoi peut déclencher deux fois : on ne réattribue pas un matricule déjà enregistré.
    const col = ensureColumn_(sheet, CONFIG.MATRICULE_HEADER);
    const current = String(sheet.getRange(responseRow, col).getValue() || '').trim();
    if (current && findRow_(registry, headerMap_(registry)['Matricule'], current) > 0) return;

    matricule = nextMatricule_(typeKey);
    sheet.getRange(responseRow, col).setValue(matricule);

    const parentId = props_().getProperty('folder:type:' + typeKey);
    folder = DriveApp.getFolderById(parentId).createFolder(matricule);

    appendByHeaders_(registry, {
      'Matricule': matricule,
      'Type': type.label,
      'Nom / Raison sociale': sanitize_(nom, 120),
      'Email': sanitize_(email, 120),
      'Téléphone': sanitize_(field(ff.telephone), 40),
      'Date de souscription': new Date(),
      'Dossier (Drive)': folder.getUrl(),
      'Nb documents': 0,
      'Formulaire (réponse)': responseUrl,
    });
  } finally {
    lock.releaseLock();
  }

  if (CONFIG.SEND_EMAILS) {
    try {
      sendMatriculeEmail_(type, matricule, nom, email);
    } catch (err) {
      console.error(err);
      const row = findRow_(registry, headerMap_(registry)['Matricule'], matricule);
      appendNote_(registry, row, 'Observations', '⚠ Email non envoyé : ' + err.message);
    }
  }

  // Étape suivante (circuit des cellules), seulement si setup() a été lancé.
  if (cellsInitialized_()) {
    const formValues = {};
    Object.keys(type.formColumns || {}).forEach(function (c) { formValues[c] = field(type.formColumns[c]); });
    addToFirstCell_(typeKey, matricule, responseUrl, formValues);
  }
}

/**
 * Matricule unique : PREFIX_AAAAMMJJ_00001
 * (date de souscription + compteur par type, voir CONFIG.COUNTER_RESET).
 * À appeler sous verrou (LockService).
 */
function nextMatricule_(typeKey) {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const scope = { daily: 'yyyyMMdd', yearly: 'yyyy' }[CONFIG.COUNTER_RESET];
  const key = 'counter:' + typeKey + (scope ? ':' + Utilities.formatDate(now, tz, scope) : '');
  const n = Number(props_().getProperty(key) || 0) + 1;
  props_().setProperty(key, String(n));
  return typeConfig_(typeKey).prefix + '_' + Utilities.formatDate(now, tz, 'yyyyMMdd') + '_' + ('0000' + n).slice(-5);
}

/** Numéro de la colonne portant cet en-tête ; la crée en fin de tableau si besoin. */
function ensureColumn_(sheet, header) {
  const col = headerMap_(sheet)[header];
  if (col) return col;
  const newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue(header).setFontWeight('bold');
  return newCol;
}

function sendMatriculeEmail_(type, matricule, nom, email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('adresse email absente ou invalide');

  const base = CONFIG.UPLOAD_PAGE_URL.replace(/\/+$/, '');
  const link = base ? base + '/?matricule=' + encodeURIComponent(matricule) + '&email=' + encodeURIComponent(email) : '';
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  const html =
    '<p>Bonjour ' + esc(nom) + ',</p>' +
    '<p>Nous avons bien reçu votre demande (' + esc(type.label) + '). Voici votre <b>matricule de dossier</b> :</p>' +
    '<p style="font-size:20px;font-weight:bold;letter-spacing:1px">' + esc(matricule) + '</p>' +
    '<p>Conservez-le : il vous sera demandé pour tout suivi.</p>' +
    (link
      ? '<p><b>Prochaine étape :</b> déposez vos pièces justificatives.</p>' +
        '<p><a href="' + esc(link) + '" style="background:#1f8a5b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Déposer mes documents</a></p>'
      : '') +
    '<p>Cordialement,<br>' + esc(CONFIG.ORG_NAME) + '</p>';

  const text =
    'Bonjour ' + nom + ',\n\nNous avons bien reçu votre demande (' + type.label + ').\n' +
    'Votre matricule de dossier : ' + matricule + '\n\n' +
    (link ? 'Déposez vos pièces justificatives ici : ' + link + '\n\n' : '') +
    'Cordialement,\n' + CONFIG.ORG_NAME;

  MailApp.sendEmail({
    to: email,
    subject: '[' + CONFIG.ORG_NAME + '] Votre matricule de dossier : ' + matricule,
    body: text,
    htmlBody: html,
    name: CONFIG.ORG_NAME,
    replyTo: CONFIG.REPLY_TO || undefined,
  });
}
