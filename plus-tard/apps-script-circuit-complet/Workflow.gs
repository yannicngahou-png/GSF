/**
 * Circuit des dossiers : arrivée dans la 1re cellule et passage d'une cellule
 * à la suivante lorsqu'un dossier devient « Favorable ».
 * (Non actif tant que setup() n'a pas été lancé.)
 */

/** Ajoute un dossier dans la 1re cellule de son circuit (appelé par Reception.gs). */
function addToFirstCell_(typeKey, matricule, responseUrl, formValues) {
  const type = CONFIG.TYPES[typeKey];
  const cell = firstCellForType_(typeKey);
  const target = cellSpreadsheet_(cell.key).getSheetByName(SHEET_DOSSIERS);
  if (findRow_(target, headerMap_(target)['Matricule'], matricule) > 0) return;

  const registry = registrySheet_();
  const reg = rowObject_(registry, findRow_(registry, headerMap_(registry)['Matricule'], matricule));
  const row = {
    'Matricule': matricule,
    'Type': type.label,
    'Nom / Raison sociale': reg['Nom / Raison sociale'],
    'Email': reg['Email'],
    'Téléphone': reg['Téléphone'],
    'Dossier (Drive)': reg['Dossier (Drive)'],
    'Formulaire (réponse)': responseUrl,
    "Date d'entrée": new Date(),
    'Statut': CONFIG.STATUS_NEW,
    'Nb documents': reg['Nb documents'] || 0,
  };
  Object.keys(formValues).forEach(function (col) { row[col] = sanitize_(formValues[col], 2000); });
  appendByHeaders_(target, row);

  notifyCell_(cell, 'Nouveau dossier ' + matricule,
    'Un nouveau dossier (' + type.label + ') est arrivé dans « ' + cell.name + ' ».\n\n' +
    'Matricule : ' + matricule + '\nFeuille : ' + target.getParent().getUrl());
}

/** Déclencheur « à la modification » posé sur chaque feuille de cellule. */
function onCellEdit(e) {
  if (!e || !e.range) return;
  const cell = cellBySpreadsheetId_(e.source.getId());
  if (!cell) return;
  const sheet = e.range.getSheet();

  if (sheet.getName() === SHEET_SCHEDULE) {
    refreshRepayments_({ notify: false });
    return;
  }
  if (sheet.getName() !== SHEET_DOSSIERS) return;

  const map = headerMap_(sheet);
  const statusCol = map['Statut'];
  if (!statusCol || e.range.getColumn() > statusCol || e.range.getLastColumn() < statusCol) return;

  for (let r = Math.max(2, e.range.getRow()); r <= e.range.getLastRow(); r++) {
    handleStatusChange_(cell, sheet, r);
  }
}

function handleStatusChange_(cell, sheet, row) {
  const data = rowObject_(sheet, row);
  const status = data['Statut'];
  if (!status) return;

  if (CONFIG.DECISION_STATUSES.indexOf(status) !== -1) setByHeader_(sheet, row, 'Date décision', new Date());
  if (status !== CONFIG.STATUS_FAVORABLE || data['Date transmission']) return;

  const typeKey = typeKeyFromLabel_(data['Type']);
  const required = cell.requiredForFavorable || [];
  const missing = (Array.isArray(required) ? required : required[typeKey] || [])
    .filter(function (c) { return data[c] === '' || data[c] == null; });
  if (missing.length) {
    setByHeader_(sheet, row, 'Statut', 'En cours');
    appendNote_(sheet, row, 'Observations', '⚠ À renseigner avant de passer « Favorable » : ' + missing.join(', '));
    return;
  }

  const next = nextCell_(cell.key, typeKey);
  if (!next) return; // dernière cellule du circuit pour ce type (ex. aide après décaissement)

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (sheet.getRange(row, headerMap_(sheet)['Date transmission']).getValue()) return;
    transferToCell_(data, cell, next);
    if (cell.onFavorable === 'createSchedule' && next.key === 'suivi') createSchedule_(data);
    setByHeader_(sheet, row, 'Transmis à', next.name);
    setByHeader_(sheet, row, 'Date transmission', new Date());
  } finally {
    lock.releaseLock();
  }

  notifyCell_(next, 'Dossier ' + data['Matricule'] + ' transmis',
    'Le dossier ' + data['Matricule'] + ' (' + data['Nom / Raison sociale'] + ') a reçu un avis favorable de « ' +
    cell.name + ' » et arrive dans « ' + next.name + ' ».\n\nFeuille : ' + cellSpreadsheet_(next.key).getUrl());
}

/** Copie le dossier dans la cellule suivante (colonnes de même nom). */
function transferToCell_(data, from, to) {
  const target = cellSpreadsheet_(to.key).getSheetByName(SHEET_DOSSIERS);
  const map = headerMap_(target);
  if (findRow_(target, map['Matricule'], data['Matricule']) > 0) return;

  const out = {};
  Object.keys(data).forEach(function (h) {
    if (WORKFLOW_COLUMNS.indexOf(h) === -1 && map[h]) out[h] = data[h];
  });
  out["Date d'entrée"] = new Date();
  out['Statut'] = CONFIG.STATUS_NEW;
  out['Avis cellule précédente'] = from.name + ' : Favorable' + (data['Observations'] ? ' — ' + data['Observations'] : '');
  appendByHeaders_(target, out);
}
