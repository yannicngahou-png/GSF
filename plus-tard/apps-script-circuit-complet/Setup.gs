/**
 * Initialisation. Idempotent : peut être relancé sans dupliquer les fichiers existants.
 *
 *  - setupReception() : étape 1, réception seule (dossiers Drive, registre,
 *    rattachement des réponses aux formulaires). Ne crée aucune cellule.
 *  - setup()          : circuit complet (réception + feuilles des cellules + suivi).
 */
function setupReception() {
  const registry = setupReceptionParts_();
  installTriggers();
  Logger.log('Registre : ' + registry.getUrl());
}

function setup() {
  const registry = setupReceptionParts_();
  const root = DriveApp.getFolderById(props_().getProperty('folder:root'));
  const cellsFolder = getOrCreateFolder_('folder:cells', 'Cellules', root);

  CONFIG.CELLS.forEach(function (cell) {
    const ss = getOrCreateSpreadsheet_('cell:' + cell.key, cell.name, cellsFolder);
    const sheet = ss.getSheetByName(SHEET_DOSSIERS) || ss.getSheets()[0];
    formatSheet_(sheet, SHEET_DOSSIERS, cellColumns_(cell), cell.statuses || CONFIG.STATUSES);
    if (cell.key === 'suivi') {
      const sched = ss.getSheetByName(SHEET_SCHEDULE) || ss.insertSheet(SHEET_SCHEDULE);
      formatSheet_(sched, SHEET_SCHEDULE, SCHEDULE_COLUMNS, null);
    }
  });

  installTriggers();

  Logger.log('Registre : ' + registry.getUrl());
  CONFIG.CELLS.forEach(function (cell) {
    Logger.log(cell.name + ' : ' + cellSpreadsheet_(cell.key).getUrl());
  });
}

/** Dossiers des demandeurs + registre. Renvoie le registre. */
function setupReceptionParts_() {
  const root = getOrCreateFolder_('folder:root', CONFIG.ROOT_FOLDER_NAME, DriveApp.getRootFolder());

  Object.keys(CONFIG.TYPES).forEach(function (k) {
    const t = CONFIG.TYPES[k];
    if (t.folderId) {
      const folder = DriveApp.getFolderById(t.folderId); // échoue si le compte n'a pas accès
      props_().setProperty('folder:type:' + k, t.folderId);
      Logger.log('Dossier ' + t.label + ' : ' + folder.getName() + ' — ' + folder.getUrl());
    } else {
      const dossiers = getOrCreateFolder_('folder:dossiers', 'Dossiers des demandeurs', root);
      getOrCreateFolder_('folder:type:' + k, 'Demandes - ' + t.label, dossiers);
    }
  });

  const registry = getOrCreateSpreadsheet_('registry', '00 - Registre des dossiers', root);
  formatSheet_(registry.getSheets()[0], SHEET_REGISTRY, REGISTRY_COLUMNS, null);
  return registry;
}

/**
 * (Ré)installe les déclencheurs. À relancer après avoir renseigné les responseSheetId.
 * Les déclencheurs des cellules ne sont posés que si les cellules existent (setup()).
 */
function installTriggers() {
  const handlers = ['onCellEdit', 'onFormSubmitHandler', 'dailyRepaymentCheck'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });

  Object.keys(CONFIG.TYPES).forEach(function (k) {
    const id = CONFIG.TYPES[k].responseSheetId;
    if (!id) {
      Logger.log('⚠ responseSheetId manquant pour « ' + k + ' » : les réponses ne seront pas rattachées au registre.');
      return;
    }
    ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(id).onFormSubmit().create();
  });

  if (!cellsInitialized_()) return;

  CONFIG.CELLS.forEach(function (cell) {
    ScriptApp.newTrigger('onCellEdit').forSpreadsheet(cellSpreadsheet_(cell.key)).onEdit().create();
  });
  ScriptApp.newTrigger('dailyRepaymentCheck').timeBased().everyDays(1).atHour(8).create();
}

function cellsInitialized_() {
  return Boolean(props_().getProperty('cell:' + CONFIG.CELLS[0].key));
}

function getOrCreateFolder_(propKey, name, parent) {
  const id = props_().getProperty(propKey);
  if (id) {
    try {
      const f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (e) { /* supprimé : on recrée */ }
  }
  const folder = parent.createFolder(name);
  props_().setProperty(propKey, folder.getId());
  return folder;
}

function getOrCreateSpreadsheet_(propKey, name, folder) {
  const id = props_().getProperty(propKey);
  if (id) {
    try {
      const file = DriveApp.getFileById(id);
      if (!file.isTrashed()) return SpreadsheetApp.openById(id);
    } catch (e) { /* supprimé : on recrée */ }
  }
  const ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  props_().setProperty(propKey, ss.getId());
  return ss;
}

/**
 * Pose les en-têtes (ajoute les colonnes manquantes sans toucher aux données),
 * la mise en forme, la liste déroulante et les couleurs du statut.
 */
function formatSheet_(sheet, name, columns, statuses) {
  if (sheet.getName() !== name) sheet.setName(name);

  const existing = headerMap_(sheet);
  let lastCol = sheet.getLastColumn();
  columns.forEach(function (c) {
    if (!existing[c]) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue(c);
    }
  });

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  header.setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff').setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  sheet.setColumnWidths(1, sheet.getLastColumn(), 150);

  const map = headerMap_(sheet);
  const maxRows = Math.max(sheet.getMaxRows(), 1000);
  if (sheet.getMaxRows() < maxRows) sheet.insertRowsAfter(sheet.getMaxRows(), maxRows - sheet.getMaxRows());

  Object.keys(map).forEach(function (h) {
    if (/^Date/.test(h) || h === 'Prochaine échéance') {
      sheet.getRange(2, map[h], maxRows - 1, 1).setNumberFormat('dd/mm/yyyy');
    }
  });

  if (!statuses || !map['Statut']) return;

  const statusRange = sheet.getRange(2, map['Statut'], maxRows - 1, 1);
  statusRange.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).setAllowInvalid(false).build()
  );

  const rowRange = sheet.getRange(2, 1, maxRows - 1, sheet.getLastColumn());
  const colLetter = columnLetter_(map['Statut']);
  const rules = statuses.filter(function (s) { return STATUS_COLORS[s]; }).map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + colLetter + '2="' + s + '"')
      .setBackground(STATUS_COLORS[s])
      .setRanges([rowRange])
      .build();
  });
  sheet.setConditionalFormatRules(rules);
}

function columnLetter_(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
