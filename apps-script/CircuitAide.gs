/**
 * Circuit des demandes d'aide.
 *
 *  1. Nouvelle réponse dans « Formulaire » → copiée dans « Nouveaux dossiers »
 *     (sauf « Déclaration du membre… »), avec le statut « En cours d'examen ».
 *  2. Statut choisi dans « Nouveaux dossiers » → dossier copié selon CONFIG.CIRCUIT_AIDE.statusRules :
 *       « Validé » → « Dossiers Validés » + « Aides » (Finance), avec la date de validation ;
 *       « Refusé » → « Dossiers refusés », avec la date de refus.
 *     En cas de changement de décision, le dossier est retiré des feuilles de la décision précédente.
 *  3. « Archiver le dossier » = « Oui » → dossier copié dans le fichier des archives, puis retiré
 *     de « Nouveaux dossiers » :
 *       « Dossiers refusés » → « Aides refusées » ;
 *       « Aides » (Finance) → « Aides validées », seulement si « Status » = « Clôturé ».
 *     Le dossier Drive du matricule (documents) est déplacé dans « Documents Aides ».
 *
 * Les colonnes sont associées par leur nom (sans tenir compte des accents ni des majuscules), ou via
 * columnAliases (ex. « Date de réception » ← « Timestamp »). Seules les colonnes correspondantes sont écrites :
 * les colonnes propres à chaque feuille (analystes, finance) ne sont jamais écrasées.
 */

/** Étape 1 — appelée par onFormSubmitHandler une fois le matricule inscrit. */
function aideVersNouveauxDossiers_(formSheet, row) {
  const c = CONFIG.CIRCUIT_AIDE;
  const source = readRow_(formSheet, row);
  const excluded = c.excludedColumns.map(fullTitle_);
  const keep = source.headers.map(function (h) {
    return !excluded.some(function (x) { return fullTitle_(h).indexOf(x) === 0; });
  });

  const target = formSheet.getParent().getSheetByName(c.sheetNewFiles);
  if (!target) throw new Error('Feuille « ' + c.sheetNewFiles + ' » introuvable.');
  const extra = {};
  extra[c.statusHeader] = c.defaultStatus;

  copyRowTo_(source, target, extra, keep);
}

/**
 * Déclencheur « à la modification », posé sur le fichier de réponses d'aide et sur le fichier Finance :
 *  - « Statut » modifié dans « Nouveaux dossiers » → appliquerStatut_ ;
 *  - « Archiver le dossier » modifié dans une feuille de archiving.sources → archiverDossier_.
 */
function onEditHandler(e) {
  if (!e || !e.range) {
    throw new Error('Cette fonction se lance automatiquement quand une cellule est modifiée : ne l\'exécutez pas à la main.');
  }
  const c = CONFIG.CIRCUIT_AIDE;
  const sheet = e.range.getSheet();

  if (isSheet_(sheet, { sheet: c.sheetNewFiles })) {
    forEachEditedRow_(e, sheet, c.statusHeader, function (r, value) {
      const rule = c.statusRules.find(function (x) { return fullTitle_(x.status) === fullTitle_(value); });
      if (rule) appliquerStatut_(sheet, r, rule);
    });
    return;
  }

  const a = c.archiving;
  const src = a.sources.find(function (s) { return isSheet_(sheet, s); });
  if (src) {
    forEachEditedRow_(e, sheet, a.column, function (r, value, cell) {
      if (fullTitle_(value) !== fullTitle_(a.yes)) return;
      if (src.requires && !conditionRemplie_(sheet, r, src.requires)) {
        // Archivage refusé : on remet « Pas encore » et on explique pourquoi dans une note.
        const msg = 'Archivage impossible : « ' + src.requires.column + ' » doit être « ' + src.requires.value + ' ».';
        cell.setValue(a.notYet).setNote(msg);
        try { sheet.getParent().toast(msg, 'Archivage', 8); } catch (err) { /* toast indisponible */ }
        return;
      }
      cell.clearNote();
      archiverDossier_(sheet, r, src.archive);
    });
  }
}

/** La colonne `cond.column` de la ligne vaut-elle `cond.value` ? */
function conditionRemplie_(sheet, row, cond) {
  const headers = tableInfo_(sheet).headers;
  const col = colIndex_(headers, cond.column);
  if (col < 0) throw new Error('Colonne « ' + cond.column + ' » introuvable dans « ' + sheet.getName() + ' ».');
  return fullTitle_(sheet.getRange(row, col + 1).getValue()) === fullTitle_(cond.value);
}

/** Appelle fn(ligne, valeur, cellule) pour chaque ligne modifiée, si la modification touche la colonne `header`. */
function forEachEditedRow_(e, sheet, header, fn) {
  const table = tableInfo_(sheet);
  const col = colIndex_(table.headers, header) + 1;
  if (col < 1 || e.range.getColumn() > col || e.range.getLastColumn() < col) return;
  for (let r = Math.max(e.range.getRow(), table.headerRow + 1); r <= e.range.getLastRow(); r++) {
    const cell = sheet.getRange(r, col);
    fn(r, cell.getValue(), cell);
  }
}

/** La feuille correspond-elle à la cible { file, sheet } ? */
function isSheet_(sheet, target) {
  return sheet.getName() === target.sheet && sheet.getParent().getId() === fileId_(target.file);
}

/**
 * Archivage : copie le dossier dans la feuille d'archives `archive`, déplace son dossier Drive (documents)
 * dans « Documents Aides », puis le retire de « Nouveaux dossiers ».
 * Il reste dans la feuille où « Oui » a été choisi.
 */
function archiverDossier_(sheet, row, archive) {
  const a = CONFIG.CIRCUIT_AIDE.archiving;
  const source = readRow_(sheet, row);
  const matricule = String(source.values[colIndex_(source.headers, CONFIG.MATRICULE_HEADER)] || '').trim();
  const extra = {};
  if (a.dateHeader) extra[a.dateHeader] = new Date();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    copyRowTo_(source, targetSheet_(archive), extra, null);
    if (matricule) {
      archiverDocuments_(matricule);
      removeFromSheet_(targetSheet_(a.removeFrom), matricule);
    }
  } finally {
    lock.releaseLock();
  }
}

/** Déplace le dossier Drive du matricule dans « Documents Aides ». Sans effet s'il y est déjà. */
function archiverDocuments_(matricule) {
  const dest = documentsArchiveFolder_();
  if (dest.getFoldersByName(matricule).hasNext()) return; // déjà archivé
  const it = DriveApp.getFolderById(folderId_('assistance')).getFoldersByName(matricule);
  if (!it.hasNext()) throw new Error('Dossier Drive « ' + matricule + ' » introuvable dans le dossier des demandes d\'aide.');
  it.next().moveTo(dest);
}

/** Dossier « Documents Aides » : identifiant dans Identifiants, sinon cherché à côté du fichier des archives. */
function documentsArchiveFolder_() {
  const name = CONFIG.CIRCUIT_AIDE.archiving.documentsFolderName;
  const id = String(IDENTIFIANTS().dossierDocumentsAides || '').trim();
  if (id) return DriveApp.getFolderById(id);

  const parents = DriveApp.getFileById(fileId_('archives')).getParents();
  while (parents.hasNext()) {
    const found = parents.next().getFoldersByName(name);
    if (found.hasNext()) return found.next();
  }
  throw new Error('Dossier « ' + name + ' » introuvable à côté du fichier des archives : créez-le, ou indiquez ' +
    'son identifiant dans « dossierDocumentsAides » (fichier Identifiants).');
}

/** Copie la ligne dans les feuilles prévues pour ce statut, avec la date du jour. */
function appliquerStatut_(sheet, row, rule) {
  const c = CONFIG.CIRCUIT_AIDE;
  const source = readRow_(sheet, row);

  // Dans les feuilles de destination, « Statut » devient « Statut analyse ».
  const iStatus = colIndex_(source.headers, c.statusHeader);
  if (iStatus >= 0) source.headers[iStatus] = c.statusHeaderElsewhere;
  const now = new Date();
  // Date de la décision + valeurs par défaut propres à chaque feuille de destination.
  const extraFor = function (t) {
    const extra = Object.assign({}, t.defaults || {});
    extra[rule.dateHeader] = now;
    return extra;
  };

  // Changement de décision : le dossier quitte les feuilles des autres décisions.
  const key = function (t) { return (t.file || '') + '|' + t.sheet; };
  const keep = rule.targets.map(key);
  const others = [];
  c.statusRules.forEach(function (x) {
    x.targets.forEach(function (t) {
      if (keep.indexOf(key(t)) === -1 && others.map(key).indexOf(key(t)) === -1) others.push(t);
    });
  });
  const matricule = source.values[colIndex_(source.headers, CONFIG.MATRICULE_HEADER)];

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (matricule) others.forEach(function (t) { removeFromSheet_(targetSheet_(t), matricule); });
    rule.targets.forEach(function (t) { copyRowTo_(source, targetSheet_(t), extraFor(t), null); });
  } finally {
    lock.releaseLock();
  }
}

/** Supprime de la feuille les lignes portant ce matricule. */
function removeFromSheet_(sheet, matricule) {
  const table = tableInfo_(sheet);
  const matIdx = colIndex_(table.headers, CONFIG.MATRICULE_HEADER);
  if (matIdx < 0 || sheet.getLastRow() <= table.headerRow) return;
  const values = sheet.getRange(table.headerRow + 1, matIdx + 1, sheet.getLastRow() - table.headerRow, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]).trim() === String(matricule).trim()) sheet.deleteRow(table.headerRow + 1 + i);
  }
}

/** Identifiant du fichier désigné par `file` : 'finance', 'archives', ou rien = fichier de réponses d'aide. */
function fileId_(file) {
  if (!file) return responseSheetId_('assistance');
  if (file === 'finance') return financeSpreadsheetId_();
  return identifiant_(file);
}

function fileLabel_(file) {
  return { finance: 'le fichier Finance', archives: 'le fichier des archives' }[file] || 'le fichier de réponses d\'aide';
}

/** Feuille { file, sheet }. */
function targetSheet_(target) {
  const sheet = SpreadsheetApp.openById(fileId_(target.file)).getSheetByName(target.sheet);
  if (!sheet) throw new Error('Feuille « ' + target.sheet + ' » introuvable dans ' + fileLabel_(target.file) + '.');
  return sheet;
}

/* ---------- Outils de copie par nom de colonne ---------- */

/** Ligne d'en-têtes : la 1re des 10 premières lignes qui contient la colonne du matricule. */
function tableInfo_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const rows = sheet.getRange(1, 1, Math.min(10, sheet.getMaxRows()), lastCol).getValues();
  let headerRow = 1;
  for (let i = 0; i < rows.length; i++) {
    if (colIndex_(rows[i], CONFIG.MATRICULE_HEADER) >= 0) { headerRow = i + 1; break; }
  }
  return { headerRow: headerRow, headers: rows[headerRow - 1].map(String) };
}

function readRow_(sheet, row) {
  const table = tableInfo_(sheet);
  const values = sheet.getRange(row, 1, 1, table.headers.length).getValues()[0];
  return { headers: table.headers.slice(), values: values };
}

/**
 * Colonne correspondant à un intitulé, par ordre de priorité : intitulé complet identique,
 * même 1re ligne, ou l'un égal à la dernière ligne de l'autre
 * (ex. « Nom de la banque » ↔ « Pour ceux qui ont un compte bancaire,\nNom de la banque »).
 * Une correspondance n'est retenue que si elle est unique.
 */
function colIndex_(headers, title) {
  const rules = [
    function (t, h) { return fullTitle_(t) === fullTitle_(h); },
    function (t, h) { return firstLine_(t) === firstLine_(h); },
    function (t, h) { return fullTitle_(t) === lastLine_(h) || lastLine_(t) === fullTitle_(h); },
  ];
  if (!fullTitle_(title)) return -1;
  for (let k = 0; k < rules.length; k++) {
    const hits = [];
    headers.forEach(function (h, i) { if (fullTitle_(h) && rules[k](title, h)) hits.push(i); });
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return -1; // ambigu : on ne devine pas
  }
  return -1;
}

/** Intitulé normalisé : sans accents, majuscules, espaces superflus ni « : » final. */
function fullTitle_(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
}

/** Colonne d'origine pour une colonne de destination : même nom, sinon un nom prévu dans columnAliases. */
function sourceIndex_(sourceHeaders, targetHeader) {
  const s = colIndex_(sourceHeaders, targetHeader);
  if (s >= 0) return s;
  const aliases = CONFIG.CIRCUIT_AIDE.columnAliases || {};
  const key = Object.keys(aliases).find(function (k) { return fullTitle_(k) === fullTitle_(targetHeader); });
  if (!key) return -1;
  for (let i = 0; i < aliases[key].length; i++) {
    const a = colIndex_(sourceHeaders, aliases[key][i]);
    if (a >= 0) return a;
  }
  return -1;
}
function firstLine_(v) { return fullTitle_(String(v == null ? '' : v).split('\n')[0]); }
function lastLine_(v) { const l = String(v == null ? '' : v).split('\n'); return l.length > 1 ? fullTitle_(l[l.length - 1]) : ''; }

/**
 * Copie une ligne dans `target`, colonne par colonne selon les noms, sur la 1re ligne libre du tableau.
 * `extra` : { intitulé : valeur } imposés. `keep` : masque des colonnes source à copier (null = toutes).
 * Ne fait rien si le matricule figure déjà dans `target`.
 */
function copyRowTo_(source, target, extra, keep) {
  const table = tableInfo_(target);
  const matIdx = colIndex_(table.headers, CONFIG.MATRICULE_HEADER);
  const srcMat = source.values[colIndex_(source.headers, CONFIG.MATRICULE_HEADER)];

  if (matIdx >= 0 && srcMat && target.getLastRow() > table.headerRow) {
    const existing = target.getRange(table.headerRow + 1, matIdx + 1, target.getLastRow() - table.headerRow, 1)
      .getValues().map(function (r) { return String(r[0]).trim(); });
    if (existing.indexOf(String(srcMat).trim()) !== -1) return; // déjà transmis
  }

  const out = new Array(table.headers.length).fill(undefined);
  table.headers.forEach(function (h, i) {
    if (!String(h).trim()) return;
    const extraKey = Object.keys(extra).find(function (k) { return fullTitle_(k) === fullTitle_(h); });
    if (extraKey) { out[i] = extra[extraKey]; return; }
    const s = sourceIndex_(source.headers, h);
    if (s >= 0 && (!keep || keep[s])) out[i] = source.values[s];
  });

  const row = nextFreeRow_(target, table.headerRow, matIdx >= 0 ? matIdx + 1 : 1);
  if (row > table.headerRow + 1) {
    // Reprend le format et les listes déroulantes de la ligne du dessus.
    const prev = target.getRange(row - 1, 1, 1, table.headers.length);
    prev.copyTo(target.getRange(row, 1, 1, table.headers.length), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    prev.copyTo(target.getRange(row, 1, 1, table.headers.length), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }

  // Écrit uniquement les colonnes correspondantes, par blocs contigus (les formules voisines sont préservées).
  let i = 0;
  while (i < out.length) {
    if (out[i] === undefined) { i++; continue; }
    let j = i;
    while (j + 1 < out.length && out[j + 1] !== undefined) j++;
    target.getRange(row, i + 1, 1, j - i + 1).setValues([out.slice(i, j + 1)]);
    i = j + 1;
  }
}

/** 1re ligne vide du tableau, d'après la colonne clé (matricule). */
function nextFreeRow_(sheet, headerRow, keyCol) {
  const max = sheet.getMaxRows();
  let row = headerRow + 1;
  if (max > headerRow) {
    const values = sheet.getRange(headerRow + 1, keyCol, max - headerRow, 1).getValues();
    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i][0]).trim() !== '') { row = headerRow + 2 + i; break; }
    }
  }
  if (row > max) sheet.insertRowsAfter(max, row - max);
  return row;
}

/** Journal de contrôle (appelé par installer) : colonnes sans correspondance. */
function verifierCircuitAide_() {
  const c = CONFIG.CIRCUIT_AIDE;
  const ss = SpreadsheetApp.openById(responseSheetId_('assistance'));
  const form = responseSheet_(ss);
  const nouveaux = ss.getSheetByName(c.sheetNewFiles);
  if (!nouveaux) throw new Error('Feuille « ' + c.sheetNewFiles + ' » introuvable dans le fichier de réponses d\'aide.');

  const report = function (fromName, from, to, toName, renamed, dateHeader, required) {
    const src = tableInfo_(from).headers.map(function (h) {
      return renamed && fullTitle_(h) === fullTitle_(c.statusHeader) ? c.statusHeaderElsewhere : h;
    });
    const auto = [c.statusHeader, c.statusHeaderElsewhere, dateHeader].concat(required || []).map(fullTitle_);
    const toHeaders = tableInfo_(to).headers;
    const missing = toHeaders.filter(function (h) {
      return String(h).trim() && sourceIndex_(src, h) < 0 && auto.indexOf(fullTitle_(h)) < 0;
    });
    let line = '  ' + fromName + ' → ' + toName + ' : ' + (missing.length
      ? missing.length + ' colonne(s) remplie(s) à la main : ' + missing.map(firstLine_).join(' | ')
      : 'toutes les colonnes correspondent');
    [CONFIG.MATRICULE_HEADER].concat(required || []).forEach(function (h) {
      if (colIndex_(toHeaders, h) < 0) line += '  ⚠ colonne « ' + h + ' » absente';
    });
    if (dateHeader && colIndex_(toHeaders, dateHeader) < 0) line += '  (colonne « ' + dateHeader + ' » absente : date non notée)';
    Logger.log(line);
  };
  const name = function (t) {
    return t.sheet + ({ finance: ' (Finance)', archives: ' (Archives)' }[t.file] || '');
  };

  Logger.log('Circuit aide — colonnes sans correspondance (normal pour les colonnes des analystes / de la finance) :');
  report('Formulaire', form, nouveaux, c.sheetNewFiles, false, null);
  c.statusRules.forEach(function (rule) {
    rule.targets.forEach(function (t) {
      const required = [rule.dateHeader].concat(Object.keys(t.defaults || {}));
      report(c.sheetNewFiles, nouveaux, targetSheet_(t), name(t) + ' [' + rule.status + ']', true, null, required);
    });
  });

  const a = c.archiving;
  a.sources.forEach(function (s) {
    const from = targetSheet_(s);
    [a.column].concat(s.requires ? [s.requires.column] : []).forEach(function (h) {
      if (colIndex_(tableInfo_(from).headers, h) < 0) Logger.log('  ⚠ ' + name(s) + ' : colonne « ' + h + ' » absente');
    });
    report(name(s), from, targetSheet_(s.archive), name(s.archive) + ' [archivage]', false, a.dateHeader);
  });
  logDocumentsFolder_();
}

/** Indique dans le journal si le dossier « Documents Aides » est trouvé. */
function logDocumentsFolder_() {
  try {
    Logger.log('  ✅ dossier des documents archivés : « ' + documentsArchiveFolder_().getName() + ' »');
  } catch (err) {
    Logger.log('  ⚠ ' + err.message);
  }
}
