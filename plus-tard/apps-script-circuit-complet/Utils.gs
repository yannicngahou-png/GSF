/** Fonctions utilitaires partagées. */

function props_() {
  return PropertiesService.getScriptProperties();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function typeConfig_(typeKey) {
  const t = CONFIG.TYPES[typeKey];
  if (!t) throw new Error('Type de demande inconnu : ' + typeKey);
  return t;
}

function typeKeyFromLabel_(label) {
  return Object.keys(CONFIG.TYPES).find(function (k) {
    return CONFIG.TYPES[k].label === label;
  }) || '';
}

function cellByKey_(key) {
  return CONFIG.CELLS.find(function (c) { return c.key === key; });
}

function cellSpreadsheet_(key) {
  const id = props_().getProperty('cell:' + key);
  if (!id) throw new Error('Cellule « ' + key + ' » non initialisée : lancez setup().');
  return SpreadsheetApp.openById(id);
}

function cellBySpreadsheetId_(ssId) {
  const all = props_().getProperties();
  return CONFIG.CELLS.find(function (c) { return all['cell:' + c.key] === ssId; }) || null;
}

function firstCellForType_(typeKey) {
  return CONFIG.CELLS.find(function (c) { return c.types.indexOf(typeKey) !== -1; });
}

function nextCell_(cellKey, typeKey) {
  const i = CONFIG.CELLS.findIndex(function (c) { return c.key === cellKey; });
  for (let j = i + 1; j < CONFIG.CELLS.length; j++) {
    if (CONFIG.CELLS[j].types.indexOf(typeKey) !== -1) return CONFIG.CELLS[j];
  }
  return null;
}

function cellColumns_(cell) {
  const cols = BASE_COLUMNS.slice();
  (cell.extraColumns || []).forEach(function (c) {
    if (cols.indexOf(c) === -1) cols.push(c);
  });
  return cols;
}

function registrySheet_() {
  const id = props_().getProperty('registry');
  if (!id) throw new Error('Registre non initialisé : lancez setup().');
  return SpreadsheetApp.openById(id).getSheetByName(SHEET_REGISTRY);
}

/** { 'Nom de colonne': numéro de colonne (1-based) } */
function headerMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  const map = {};
  if (lastCol === 0) return map;
  sheet.getRange(1, 1, 1, lastCol).getValues()[0].forEach(function (h, i) {
    if (h !== '') map[String(h).trim()] = i + 1;
  });
  return map;
}

function findRow_(sheet, col, value) {
  if (!value || sheet.getLastRow() < 2) return -1;
  const found = sheet.getRange(2, col, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value)).matchEntireCell(true).findNext();
  return found ? found.getRow() : -1;
}

function rowObject_(sheet, row) {
  const map = headerMap_(sheet);
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const obj = {};
  Object.keys(map).forEach(function (h) { obj[h] = values[map[h] - 1]; });
  return obj;
}

function appendByHeaders_(sheet, obj) {
  const map = headerMap_(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');
  Object.keys(obj).forEach(function (k) {
    if (map[k]) row[map[k] - 1] = obj[k];
  });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function setByHeader_(sheet, row, header, value) {
  const col = headerMap_(sheet)[header];
  if (col) sheet.getRange(row, col).setValue(value);
}

function appendNote_(sheet, row, header, note) {
  const col = headerMap_(sheet)[header];
  if (!col) return;
  const range = sheet.getRange(row, col);
  const current = String(range.getValue() || '');
  range.setValue(current ? current + '\n' + note : note);
}

/** Neutralise les valeurs saisies qui seraient interprétées comme formules. */
function sanitize_(value, maxLength) {
  let s = String(value == null ? '' : value).trim().slice(0, maxLength || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function round_(n, decimals) {
  const f = Math.pow(10, decimals == null ? 2 : decimals);
  return Math.round(n * f) / f;
}

/** Le franc CFA n'a pas de centimes ; les autres devises sont arrondies au centime. */
function decimalsFor_(devise) {
  return /CFA|XAF|XOF/i.test(String(devise || '')) ? 0 : 2;
}

function addMonths_(date, months) {
  const d = new Date(date);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

function startOfDay_(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate_(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function notifyCell_(cell, subject, body) {
  const emails = (cell && cell.emails) || [];
  if (!emails.length) return;
  MailApp.sendEmail({ to: emails.join(','), subject: '[' + CONFIG.ORG_NAME + '] ' + subject, body: body });
}
