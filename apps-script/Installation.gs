/**
 * À exécuter une fois, et après toute modification de Config :
 * vérifie les accès, puis installe les déclencheurs
 *  - « à l'envoi du formulaire » sur chaque fichier de réponses (matricule + dossier) ;
 *  - « à la modification » sur le fichier de réponses d'aide et sur le fichier Finance
 *    (statut des analystes, archivage).
 */
function installer() {
  Object.keys(CONFIG.TYPES).forEach(function (k) {
    const t = CONFIG.TYPES[k];
    const folder = DriveApp.getFolderById(folderId_(k));
    const sheet = responseSheet_(SpreadsheetApp.openById(responseSheetId_(k)));
    matriculeColumn_(sheet);
    Logger.log(t.label + ' — dossier : ' + folder.getName() + ' | réponses : ' +
      sheet.getParent().getName() + ' (onglet « ' + sheet.getName() + ' »)');
  });

  verifierCircuitAide_();

  const handlers = ['onFormSubmitHandler', 'onEditHandler'];
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (handlers.indexOf(tr.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(tr);
  });
  Object.keys(CONFIG.TYPES).forEach(function (k) {
    ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(responseSheetId_(k)).onFormSubmit().create();
  });
  // Statut (Nouveaux dossiers) et archivage (Dossiers refusés) dans le fichier de réponses d'aide,
  // archivage dans le fichier Finance.
  ScriptApp.newTrigger('onEditHandler').forSpreadsheet(responseSheetId_('assistance')).onEdit().create();
  ScriptApp.newTrigger('onEditHandler').forSpreadsheet(financeSpreadsheetId_()).onEdit().create();

  Logger.log('✅ Installation terminée.');
}

/**
 * À exécuter à la main en cas de problème : vérifie les déclencheurs et, pour chaque feuille d'archivage,
 * les colonnes et les lignes où « Archiver le dossier » vaut « Oui ». N'écrit rien.
 */
function diagnostiquer() {
  const a = CONFIG.CIRCUIT_AIDE.archiving;
  const nom = function (id) {
    try { return SpreadsheetApp.openById(id).getName(); } catch (e) { return 'fichier inaccessible (' + id + ')'; }
  };

  Logger.log('— Déclencheurs installés :');
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) { Logger.log('  ' + t.getHandlerFunction() + ' sur « ' + nom(t.getTriggerSourceId()) + ' »'); });
  const watched = triggers.filter(function (t) { return t.getHandlerFunction() === 'onEditHandler'; })
    .map(function (t) { return t.getTriggerSourceId(); });
  [['réponses aide', fileId_()], ['Finance', fileId_('finance')]].forEach(function (f) {
    Logger.log((watched.indexOf(f[1]) !== -1 ? '  ✅' : '  ❌ MANQUANT :') + ' onEditHandler sur le fichier ' + f[0] +
      (watched.indexOf(f[1]) !== -1 ? '' : ' → relancez « installer »'));
  });

  a.sources.forEach(function (s) {
    Logger.log('— « ' + s.sheet + ' » (' + fileLabel_(s.file) + ') → archives « ' + s.archive.sheet + ' » :');
    const sheet = targetSheet_(s);
    const table = tableInfo_(sheet);
    Logger.log('  ligne des en-têtes : ' + table.headerRow);
    const cols = {};
    [CONFIG.MATRICULE_HEADER, a.column].concat(s.requires ? [s.requires.column] : []).forEach(function (h) {
      cols[h] = colIndex_(table.headers, h);
      Logger.log('  ' + (cols[h] >= 0 ? '✅' : '❌') + ' colonne « ' + h + ' »' + (cols[h] >= 0 ? '' : ' introuvable'));
    });
    targetSheet_(s.archive);
    Logger.log('  ✅ feuille d\'archives « ' + s.archive.sheet + ' » trouvée');
    if (cols[a.column] < 0 || sheet.getLastRow() <= table.headerRow) return;

    const rows = sheet.getRange(table.headerRow + 1, 1, sheet.getLastRow() - table.headerRow, table.headers.length).getValues();
    rows.forEach(function (r) {
      if (fullTitle_(r[cols[a.column]]) !== fullTitle_(a.yes)) return;
      let line = '  ligne « Oui » : ' + (cols[CONFIG.MATRICULE_HEADER] >= 0 ? r[cols[CONFIG.MATRICULE_HEADER]] : '?');
      if (s.requires && cols[s.requires.column] >= 0) {
        const v = r[cols[s.requires.column]];
        line += ' | ' + s.requires.column + ' = « ' + v + ' »' +
          (fullTitle_(v) === fullTitle_(s.requires.value) ? ' ✅' : ' ❌ (doit être « ' + s.requires.value + ' »)');
      }
      Logger.log(line);
    });
  });
  Logger.log('— Documents :');
  logDocumentsFolder_();
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

/** Fichier de la cellule Finance. */
function financeSpreadsheetId_() { return identifiant_('finance'); }

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
