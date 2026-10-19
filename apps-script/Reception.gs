/**
 * À chaque envoi d'un formulaire :
 *  1. attribue le matricule (PREFIX_AAAAMMJJ_00001) ;
 *  2. l'inscrit dans la colonne « Matricule du dossier » de la réponse ;
 *  3. crée le dossier Drive portant ce matricule ;
 *  4. copie la réponse dans la 1re cellule du circuit (voir MoteurCircuits.gs).
 */
function onFormSubmitHandler(e) {
  if (!e || !e.range) {
    throw new Error('Cette fonction se lance automatiquement à chaque envoi du formulaire : ne l\'exécutez pas ' +
      'à la main. Pour traiter les réponses restées sans matricule, exécutez « rattraper ».');
  }
  const sheet = e.range.getSheet();
  const ssId = sheet.getParent().getId();
  const typeKey = Object.keys(CONFIG.TYPES).find(function (k) { return responseSheetId_(k) === ssId; });
  if (!typeKey) {
    throw new Error('Fichier de réponses « ' + sheet.getParent().getName() + ' » (' + ssId + ') non reconnu : ' +
      'vérifiez le fichier Identifiants.');
  }
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
    DriveApp.getFolderById(folderId_(typeKey)).createFolder(matricule);

    // Entrée dans le circuit de la cellule suivante (voir MoteurCircuits.gs).
    entreeCircuit_(typeKey, sheet, row);
  } finally {
    lock.releaseLock();
  }
}

/**
 * À exécuter à la main : traite les réponses restées sans matricule (ex. envoyées pendant une panne),
 * comme si elles venaient d'arriver. Le matricule porte la date du jour du rattrapage.
 */
function rattraper() {
  Object.keys(CONFIG.TYPES).forEach(function (k) {
    const sheet = responseSheet_(SpreadsheetApp.openById(responseSheetId_(k)));
    const col = matriculeColumn_(sheet);
    if (sheet.getLastRow() < 2) return;
    const values = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
    let n = 0;
    values.forEach(function (v, i) {
      if (String(v[0]).trim()) return;
      onFormSubmitHandler({ range: sheet.getRange(i + 2, 1) });
      n++;
    });
    Logger.log(CONFIG.TYPES[k].label + ' : ' + n + ' réponse(s) rattrapée(s).');
  });
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
