/**
 * À chaque envoi d'un formulaire :
 *  1. attribue le matricule (PREFIX_AAAAMMJJ_00001) ;
 *  2. l'inscrit dans la colonne « Matricule du dossier » de la réponse ;
 *  3. crée le dossier Drive portant ce matricule.
 */
function onFormSubmitHandler(e) {
  const sheet = e.range.getSheet();
  const typeKey = Object.keys(CONFIG.TYPES).find(function (k) {
    return CONFIG.TYPES[k].responseSheetId === sheet.getParent().getId();
  });
  if (!typeKey) return;
  const type = CONFIG.TYPES[typeKey];
  const row = e.range.getRow();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cell = sheet.getRange(row, matriculeColumn_(sheet));
    // Google déclenche parfois deux fois le même envoi : on ne réattribue pas.
    if (new RegExp('^' + type.prefix + '_\\d{8}_\\d{5}$').test(String(cell.getValue()))) return;

    const matricule = nextMatricule_(typeKey);
    cell.setValue(matricule);
    SpreadsheetApp.flush();
    DriveApp.getFolderById(type.folderId).createFolder(matricule);
  } finally {
    lock.releaseLock();
  }
}

/** Date du jour + compteur propre à chaque type, qui augmente à chaque souscription. */
function nextMatricule_(typeKey) {
  const props = PropertiesService.getScriptProperties();
  const key = 'compteur:' + typeKey;
  const n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  return CONFIG.TYPES[typeKey].prefix + '_' + date + '_' + ('0000' + n).slice(-5);
}
