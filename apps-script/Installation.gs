/**
 * À exécuter une fois (et après toute modification de responseSheetId) :
 * vérifie l'accès aux dossiers et aux fichiers de réponses, puis installe
 * le déclencheur « à l'envoi du formulaire » sur chaque fichier de réponses.
 */
function installer() {
  Object.keys(CONFIG.TYPES).forEach(function (k) {
    const t = CONFIG.TYPES[k];
    if (!t.responseSheetId) throw new Error('responseSheetId manquant pour « ' + t.label + ' » dans Config.');

    const folder = DriveApp.getFolderById(t.folderId);
    const sheet = responseSheet_(SpreadsheetApp.openById(t.responseSheetId));
    matriculeColumn_(sheet);
    Logger.log(t.label + ' — dossier : ' + folder.getName() + ' | réponses : ' +
      sheet.getParent().getName() + ' (onglet « ' + sheet.getName() + ' »)');
  });

  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'onFormSubmitHandler') ScriptApp.deleteTrigger(tr);
  });
  Object.keys(CONFIG.TYPES).forEach(function (k) {
    ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(CONFIG.TYPES[k].responseSheetId).onFormSubmit().create();
  });

  Logger.log('✅ Installation terminée.');
}

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
