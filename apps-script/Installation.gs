/**
 * À exécuter une fois, et après toute modification de Config ou d'Identifiants :
 * vérifie les accès, puis installe les déclencheurs
 *  - « à l'envoi du formulaire » sur chaque fichier de réponses (matricule + dossier + entrée dans le circuit) ;
 *  - « à la modification » sur chaque fichier de cellule (décisions, passages, archivage).
 * Un fichier dont l'identifiant est vide est signalé et ignoré.
 */
function installer() {
  // 1. Chaque identifiant doit désigner une vraie Google Sheet accessible (pas un fichier Excel importé).
  Logger.log('— Fichiers :');
  const bad = verifierFichiers_();
  if (bad.length) {
    Logger.log('❌ Installation interrompue : corrigez le(s) fichier(s) ci-dessus (' + bad.join(', ') + '), puis relancez « installer ».');
    return;
  }

  Object.keys(CONFIG.TYPES).forEach(function (k) {
    const t = CONFIG.TYPES[k];
    const folder = DriveApp.getFolderById(folderId_(k));
    const sheet = responseSheet_(SpreadsheetApp.openById(responseSheetId_(k)));
    matriculeColumn_(sheet);
    Logger.log(t.label + ' — dossier : ' + folder.getName() + ' | réponses : ' +
      sheet.getParent().getName() + ' (onglet « ' + sheet.getName() + ' »)');
  });

  verifierCircuits_();

  const handlers = ['onFormSubmitHandler', 'onEditHandler'];
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (handlers.indexOf(tr.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(tr);
  });
  Object.keys(CONFIG.TYPES).forEach(function (k) {
    ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(responseSheetId_(k)).onFormSubmit().create();
  });
  Logger.log('— Déclencheurs « à la modification » :');
  watchedFiles_().forEach(function (f) {
    const id = fileIdOrNull_(f);
    if (!id) { Logger.log('  ⚠ ' + fileLabel_(f) + ' : identifiant « ' + f + ' » vide, non surveillé'); return; }
    try {
      ScriptApp.newTrigger('onEditHandler').forSpreadsheet(id).onEdit().create();
      Logger.log('  ✅ ' + fileLabel_(f));
    } catch (e) {
      Logger.log('  ❌ ' + fileLabel_(f) + ' (' + f + ') : déclencheur impossible — ' + e.message);
    }
  });

  Logger.log('✅ Installation terminée.');
}

/**
 * Vérifie chaque fichier déclaré dans Identifiants (réponses + cellules + archives) : identifiant valide,
 * accessible, et de type Google Sheets. Écrit le résultat dans le journal ; renvoie les clés en erreur.
 */
function verifierFichiers_() {
  const keys = Object.keys(CONFIG.TYPES).map(function (k) { return CONFIG.TYPES[k].responseSheetKey; })
    .concat(watchedFiles_(), ['archives'])
    .filter(function (k, i, all) { return all.indexOf(k) === i; });
  const bad = [];
  keys.forEach(function (k) {
    const id = String(IDENTIFIANTS()[k] || '').trim();
    if (!id) { Logger.log('  ⚠ ' + k + ' : identifiant vide (circuit correspondant inactif)'); return; }
    const problem = problemeFichier_(id);
    if (problem) { Logger.log('  ❌ ' + k + ' : ' + problem); bad.push(k); return; }
    Logger.log('  ✅ ' + k + ' : « ' + SpreadsheetApp.openById(id).getName() + ' »');
  });
  return bad;
}

/** Explication si l'identifiant ne désigne pas une Google Sheet modifiable, sinon ''. */
function problemeFichier_(id) {
  if (/[\/\s]/.test(id)) return 'l\'identifiant contient « / » ou un espace : collez seulement la partie entre /d/ et /edit';
  let file;
  try { file = DriveApp.getFileById(id); } catch (e) { return 'fichier introuvable ou inaccessible (identifiant erroné, ou fichier non partagé avec vous)'; }
  const mime = file.getMimeType();
  if (mime !== MimeType.GOOGLE_SHEETS) {
    const excel = /spreadsheetml|ms-excel/.test(mime);
    return '« ' + file.getName() + ' » n\'est pas une Google Sheet' + (excel
      ? ' mais un fichier Excel importé. Ouvrez-le, puis Fichier → Enregistrer au format Google Sheets, et utilisez l\'identifiant de la copie créée'
      : ' (type : ' + mime + ')');
  }
  try { SpreadsheetApp.openById(id); } catch (e) { return '« ' + file.getName() + ' » ne peut pas être ouvert : ' + e.message; }
  return '';
}

/**
 * À exécuter à la main en cas de problème : vérifie les déclencheurs, puis feuilles, colonnes et dossiers
 * de chaque circuit, et liste les lignes en attente d'une condition (ex. « Archiver » = Oui sans date). N'écrit rien.
 */
function diagnostiquer() {
  const nom = function (id) {
    try { return SpreadsheetApp.openById(id).getName(); } catch (e) { return 'fichier inaccessible (' + id + ')'; }
  };
  Logger.log('— Déclencheurs installés :');
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) { Logger.log('  ' + t.getHandlerFunction() + ' sur « ' + nom(t.getTriggerSourceId()) + ' »'); });
  const watched = triggers.filter(function (t) { return t.getHandlerFunction() === 'onEditHandler'; })
    .map(function (t) { return t.getTriggerSourceId(); });
  watchedFiles_().forEach(function (f) {
    const id = fileIdOrNull_(f);
    if (!id) Logger.log('  ⚠ ' + fileLabel_(f) + ' : identifiant « ' + f + ' » vide');
    else if (watched.indexOf(id) === -1) Logger.log('  ❌ MANQUANT : onEditHandler sur ' + fileLabel_(f) + ' → relancez « installer »');
    else Logger.log('  ✅ onEditHandler sur ' + fileLabel_(f));
  });

  verifierCircuits_();

  Logger.log('— Lignes bloquées par une condition :');
  allRules_().forEach(function (rule) {
    rule.cases.filter(function (c) { return c.requires; }).forEach(function (c) {
      if (!fileIdOrNull_(rule.on.file)) return;
      const sheet = targetSheet_(rule.on);
      const table = tableInfo_(sheet);
      const col = colIndex_(table.headers, rule.column);
      const mat = colIndex_(table.headers, CONFIG.MATRICULE_HEADER);
      if (col < 0 || sheet.getLastRow() <= table.headerRow) return;
      for (let r = table.headerRow + 1; r <= sheet.getLastRow(); r++) {
        const v = sheet.getRange(r, col + 1).getValue();
        if (!c.values.some(function (x) { return fullTitle_(x) === fullTitle_(v); })) continue;
        const missing = conditionsManquantes_(sheet, r, c.requires);
        if (missing) {
          Logger.log('  ' + rule.on.sheet + ' (' + rule.on.file + ') ligne ' + r +
            (mat >= 0 ? ' — ' + sheet.getRange(r, mat + 1).getValue() : '') + ' : ' + missing);
        }
      }
    });
  });
}

/** Valeur d'Identifiants.gs ; erreur explicite si elle est vide. */
function identifiant_(key) {
  const id = String(IDENTIFIANTS()[key] || '').trim();
  if (!id) throw new Error('Identifiant « ' + key + ' » vide dans le fichier Identifiants.');
  return id;
}

/** Fichier de réponses d'un type de demande. */
function responseSheetId_(typeKey) { return identifiant_(CONFIG.TYPES[typeKey].responseSheetKey); }

/** Dossier Drive d'un type de demande. */
function folderId_(typeKey) { return identifiant_(CONFIG.TYPES[typeKey].folderKey); }


/** Onglet qui reçoit les réponses du formulaire. */
function responseSheet_(ss) {
  return ss.getSheets().find(function (s) { return s.getFormUrl(); }) || ss.getSheets()[0];
}

/** Numéro de la colonne « Matricule du dossier » ; la crée en fin de tableau si besoin. */
function matriculeColumn_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  const i = headers.indexOf(CONFIG.MATRICULE_HEADER);
  if (i !== -1) return i + 1;
  const col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(CONFIG.MATRICULE_HEADER).setFontWeight('bold');
  return col;
}
