/**
 * Moteur des circuits entre cellules : applique les règles décrites dans CircuitAide.gs et CircuitPret.gs.
 *
 *  - Entrée : à l'arrivée d'une réponse au formulaire, la ligne est copiée dans la 1re cellule du circuit.
 *  - Règles : quand une colonne de décision ou de passage change (« Statut », « Passer à… », « Archiver »…),
 *    le dossier est copié dans les feuilles prévues, avec la date du jour et des valeurs par défaut,
 *    éventuellement retiré d'autres feuilles, et son dossier Drive archivé.
 *
 * Syntaxe d'un circuit (CIRCUIT_AIDE / CIRCUIT_PRET) :
 *  - type      : type de demande (clé de CONFIG.TYPES)
 *  - propagateNewColumns : une colonne ajoutée dans une feuille est recréée, avec son contenu, dans les feuilles
 *                suivantes où le dossier passe (sauf la colonne qui déclenche le passage)
 *  - documents : { folderName, idKey } dossier Drive où sont archivés les documents
 *  - entry     : { excludedColumns, target } où copier une nouvelle réponse au formulaire
 *  - rules     : quand la colonne `column` de la feuille `on` change, le cas (`cases`) dont une des valeurs
 *                (`values`) correspond s'applique :
 *      targets          : feuilles où copier le dossier ; `defaults` = valeurs posées à son arrivée
 *      dateHeader       : colonne remplie avec la date du jour dans ces feuilles (si elle existe)
 *      removeFrom       : feuilles d'où le dossier est retiré
 *      archiveDocuments : déplace le dossier Drive du matricule dans le dossier `documents`
 *      requires         : conditions ({ column, equals } ou { column, notEmpty: true }) ; si elles ne sont pas
 *                         remplies, rien n'est fait, la cellule repasse à `resetTo` et une note explique pourquoi
 *    exclusive     : changer de cas retire le dossier des feuilles des autres cas (changement de décision)
 *    renameColumns : colonnes renommées dans les feuilles de destination
 * Une feuille se désigne par { file, sheet } : `file` est une clé du fichier Identifiants.
 *
 * Les colonnes sont associées par leur nom (sans accents ni majuscules), ou via CONFIG.COLUMN_ALIASES.
 * Seules les colonnes correspondantes sont écrites : les colonnes propres à chaque feuille ne sont jamais écrasées.
 */

/** Les circuits actifs. */
function circuits_() {
  const missing = [];
  if (typeof CIRCUIT_AIDE !== 'function') missing.push('CircuitAide (fonction CIRCUIT_AIDE)');
  if (typeof CIRCUIT_PRET !== 'function') missing.push('CircuitPret (fonction CIRCUIT_PRET)');
  if (missing.length) {
    throw new Error('Fichier(s) absent(s) ou ancienne version : ' + missing.join(', ') + '. Collez le contenu actuel de ' +
      'CircuitAide.gs et CircuitPret.gs, et supprimez l\'ancien fichier « Circuits » s\'il existe.');
  }
  return { aide: CIRCUIT_AIDE(), pret: CIRCUIT_PRET() };
}

/* ---------- Entrée dans le circuit ---------- */

/** Appelée par onFormSubmitHandler une fois le matricule inscrit. */
function entreeCircuit_(typeKey, formSheet, row) {
  const circuit = circuitForType_(typeKey);
  if (!circuit || !circuit.entry) return;
  const entry = circuit.entry;
  if (!fileIdOrNull_(entry.target.file)) {
    console.warn('Circuit « ' + typeKey + ' » non configuré : identifiant « ' + entry.target.file + ' » vide.');
    return;
  }
  const source = readRow_(formSheet, row);
  const excluded = (entry.excludedColumns || []).map(fullTitle_);
  const keep = source.headers.map(function (h) {
    return !excluded.some(function (x) { return fullTitle_(h).indexOf(x) === 0; });
  });
  copyRowTo_(source, targetSheet_(entry.target), Object.assign({}, entry.target.defaults || {}), keep,
    { addMissingColumns: circuit.propagateNewColumns });
}

function circuitForType_(typeKey) {
  const all = circuits_();
  const k = Object.keys(all).find(function (c) { return all[c].type === typeKey; });
  return k ? all[k] : null;
}

/** Toutes les règles de tous les circuits ; chaque règle connaît son circuit (`rule.circuit`). */
function allRules_() {
  const all = circuits_();
  return Object.keys(all).reduce(function (list, k) {
    return list.concat((all[k].rules || []).map(function (r) { r.circuit = all[k]; return r; }));
  }, []);
}

/* ---------- Déclencheur « à la modification » ---------- */

/** Posé par installer sur chaque fichier de cellule concerné par une règle. */
function onEditHandler(e) {
  if (!e || !e.range) {
    throw new Error('Cette fonction se lance automatiquement quand une cellule est modifiée : ne l\'exécutez pas à la main.');
  }
  const sheet = e.range.getSheet();
  allRules_().forEach(function (rule) {
    if (!isSheet_(sheet, rule.on)) return;
    forEachEditedRow_(e, sheet, rule.column, function (r, value, cell) {
      const kase = rule.cases.find(function (c) {
        return c.values.some(function (v) { return fullTitle_(v) === fullTitle_(value); });
      });
      if (!kase) return;

      const missing = conditionsManquantes_(sheet, r, kase.requires);
      if (missing) {
        // Condition non remplie : rien n'est fait, on remet la valeur d'attente et on explique pourquoi.
        const msg = 'Action impossible : ' + missing + '.';
        if (kase.resetTo) cell.setValue(kase.resetTo);
        cell.setNote(msg);
        try { sheet.getParent().toast(msg, rule.column, 8); } catch (err) { /* toast indisponible */ }
        return;
      }
      if (kase.requires) cell.clearNote();
      appliquerRegle_(sheet, r, rule, kase);
    });
  });
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

/** Texte décrivant les conditions non remplies, ou '' si tout est bon. */
function conditionsManquantes_(sheet, row, requires) {
  if (!requires || !requires.length) return '';
  const headers = tableInfo_(sheet).headers;
  const problems = [];
  requires.forEach(function (cond) {
    const col = colIndex_(headers, cond.column);
    if (col < 0) { problems.push('colonne « ' + cond.column + ' » introuvable'); return; }
    const v = sheet.getRange(row, col + 1).getValue();
    if (cond.notEmpty && String(v).trim() === '') problems.push('« ' + cond.column + ' » doit être rempli');
    if (cond.equals !== undefined && fullTitle_(v) !== fullTitle_(cond.equals)) {
      problems.push('« ' + cond.column + ' » doit être « ' + cond.equals + ' »');
    }
  });
  return problems.join(' ; ');
}

/** Copie le dossier vers les feuilles du cas, archive ses documents, le retire des feuilles prévues. */
function appliquerRegle_(sheet, row, rule, kase) {
  const source = readRow_(sheet, row);
  Object.keys(rule.renameColumns || {}).forEach(function (from) {
    const i = colIndex_(source.headers, from);
    if (i >= 0) source.headers[i] = rule.renameColumns[from];
  });
  const matricule = String(source.values[colIndex_(source.headers, CONFIG.MATRICULE_HEADER)] || '').trim();
  const now = new Date();
  const extraFor = function (t) {
    const extra = Object.assign({}, t.defaults || {});
    if (kase.dateHeader) extra[kase.dateHeader] = now;
    return extra;
  };

  // Changement de décision : le dossier quitte les feuilles des autres cas.
  const key = function (t) { return t.file + '|' + t.sheet; };
  const own = kase.targets.map(key);
  const others = [];
  if (rule.exclusive) {
    rule.cases.forEach(function (c) {
      if (c === kase) return;
      c.targets.forEach(function (t) {
        if (own.indexOf(key(t)) === -1 && others.map(key).indexOf(key(t)) === -1) others.push(t);
      });
    });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (matricule) others.forEach(function (t) { removeFromSheet_(targetSheet_(t), matricule); });
    // Nouvelles colonnes propagées (sauf la colonne qui déclenche la règle, propre à la cellule d'origine).
    const opts = { addMissingColumns: rule.circuit.propagateNewColumns, skipColumns: [rule.column] };
    kase.targets.forEach(function (t) { copyRowTo_(source, targetSheet_(t), extraFor(t), null, opts); });
    if (matricule && kase.archiveDocuments) archiverDocuments_(matricule, rule.circuit);
    if (matricule) (kase.removeFrom || []).forEach(function (t) { removeFromSheet_(targetSheet_(t), matricule); });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Fichiers, feuilles et documents ---------- */

/** Identifiant du fichier `file` (clé du fichier Identifiants). */
function fileId_(file) { return identifiant_(file); }

function fileIdOrNull_(file) {
  try { return fileId_(file); } catch (e) { return null; }
}

function fileLabel_(file) {
  return {
    reponsesAide: 'le fichier de réponses d\'aide', reponsesPret: 'le fichier de réponses de prêt',
    analyse: 'le fichier Cellule analyse', verification: 'le fichier Cellule vérification',
    finance: 'le fichier Finance', suivi: 'le fichier Cellule suivi', archives: 'le fichier des archives',
  }[file] || 'le fichier « ' + file + ' »';
}

/** La feuille correspond-elle à { file, sheet } ? (faux si l'identifiant n'est pas renseigné) */
function isSheet_(sheet, target) {
  return sheet.getName() === target.sheet && sheet.getParent().getId() === fileIdOrNull_(target.file);
}

/** Feuille { file, sheet }. */
function targetSheet_(target) {
  const sheet = SpreadsheetApp.openById(fileId_(target.file)).getSheetByName(target.sheet);
  if (!sheet) throw new Error('Feuille « ' + target.sheet + ' » introuvable dans ' + fileLabel_(target.file) + '.');
  return sheet;
}

/** Déplace le dossier Drive du matricule dans le dossier d'archives des documents du circuit. Sans effet s'il y est déjà. */
function archiverDocuments_(matricule, circuit) {
  const dest = documentsFolder_(circuit.documents);
  if (dest.getFoldersByName(matricule).hasNext()) return; // déjà archivé
  const it = DriveApp.getFolderById(folderId_(circuit.type)).getFoldersByName(matricule);
  if (!it.hasNext()) throw new Error('Dossier Drive « ' + matricule + ' » introuvable.');
  it.next().moveTo(dest);
}

/** Dossier d'archives des documents : identifiant dans Identifiants, sinon cherché à côté du fichier des archives. */
function documentsFolder_(docs) {
  const id = String(IDENTIFIANTS()[docs.idKey] || '').trim();
  if (id) return DriveApp.getFolderById(id);
  const parents = DriveApp.getFileById(fileId_('archives')).getParents();
  while (parents.hasNext()) {
    const found = parents.next().getFoldersByName(docs.folderName);
    if (found.hasNext()) return found.next();
  }
  throw new Error('Dossier « ' + docs.folderName + ' » introuvable à côté du fichier des archives : créez-le, ou ' +
    'indiquez son identifiant dans « ' + docs.idKey + ' » (fichier Identifiants).');
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

/** Intitulé ou valeur normalisés : sans accents, majuscules, espaces superflus ni « : » final. */
function fullTitle_(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
}
function firstLine_(v) { return fullTitle_(String(v == null ? '' : v).split('\n')[0]); }
function lastLine_(v) { const l = String(v == null ? '' : v).split('\n'); return l.length > 1 ? fullTitle_(l[l.length - 1]) : ''; }

/** Colonne d'origine pour une colonne de destination : même nom, sinon un nom prévu dans COLUMN_ALIASES. */
function sourceIndex_(sourceHeaders, targetHeader) {
  const s = colIndex_(sourceHeaders, targetHeader);
  if (s >= 0) return s;
  const aliases = CONFIG.COLUMN_ALIASES || {};
  const key = Object.keys(aliases).find(function (k) { return fullTitle_(k) === fullTitle_(targetHeader); });
  if (!key) return -1;
  for (let i = 0; i < aliases[key].length; i++) {
    const a = colIndex_(sourceHeaders, aliases[key][i]);
    if (a >= 0) return a;
  }
  return -1;
}

/**
 * Copie une ligne dans `target`, colonne par colonne selon les noms, sur la 1re ligne libre du tableau.
 * `extra` : { intitulé : valeur } imposés. `keep` : masque des colonnes source à copier (null = toutes).
 * `opts.addMissingColumns` : crée dans `target` les colonnes de la source qui n'y existent pas
 *   (sauf celles de `opts.skipColumns`), à droite du tableau, et y copie leur contenu.
 * Ne fait rien si le matricule figure déjà dans `target`.
 */
function copyRowTo_(source, target, extra, keep, opts) {
  opts = opts || {};
  const table = tableInfo_(target);
  const matIdx = colIndex_(table.headers, CONFIG.MATRICULE_HEADER);
  const srcMat = source.values[colIndex_(source.headers, CONFIG.MATRICULE_HEADER)];

  if (matIdx >= 0 && srcMat && target.getLastRow() > table.headerRow) {
    const existing = target.getRange(table.headerRow + 1, matIdx + 1, target.getLastRow() - table.headerRow, 1)
      .getValues().map(function (r) { return String(r[0]).trim(); });
    if (existing.indexOf(String(srcMat).trim()) !== -1) return; // déjà transmis
  }

  if (opts.addMissingColumns) ajouterColonnesManquantes_(source, target, table, keep, opts.skipColumns || []);

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

/**
 * Crée dans `target` (à droite du tableau) les colonnes de la source sans équivalent, et met à jour `table`.
 * Ignorées : colonnes vides, non retenues par `keep`, déjà utilisées (même nom ou alias), ou listées dans `skip`.
 */
function ajouterColonnesManquantes_(source, target, table, keep, skip) {
  const used = {};
  table.headers.forEach(function (h) {
    const s = sourceIndex_(source.headers, h);
    if (s >= 0) used[s] = true;
  });
  const skipped = skip.map(fullTitle_);
  const missing = [];
  source.headers.forEach(function (h, i) {
    if (!String(h).trim() || used[i] || (keep && !keep[i]) || skipped.indexOf(fullTitle_(h)) !== -1) return;
    if (colIndex_(table.headers, h) >= 0) return;
    missing.push(h);
  });
  missing.forEach(function (h) {
    const last = table.headers.length;
    target.insertColumnAfter(last); // à droite de la dernière colonne : le tableau s'agrandit
    const cell = target.getRange(table.headerRow, last + 1);
    target.getRange(table.headerRow, last).copyTo(cell, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    cell.setValue(h);
    table.headers.push(String(h));
  });
  if (missing.length) {
    console.log('Colonnes ajoutées dans « ' + target.getName() + ' » : ' + missing.map(firstLine_).join(' | '));
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

/* ---------- Contrôle (journal d'installer et de diagnostiquer) ---------- */

/** Fichiers de cellules surveillés par le déclencheur « à la modification ». */
function watchedFiles_() {
  const files = [];
  allRules_().forEach(function (r) { if (files.indexOf(r.on.file) === -1) files.push(r.on.file); });
  return files;
}

/** Vérifie feuilles, colonnes et correspondances de chaque circuit, et l'écrit dans le journal. */
function verifierCircuits_() {
  const label = function (t) { return t.sheet + ' (' + t.file + ')'; };
  const sheetOrLog = function (t) {
    if (!fileIdOrNull_(t.file)) { Logger.log('  ⚠ identifiant « ' + t.file + ' » vide dans Identifiants'); return null; }
    try { return targetSheet_(t); } catch (err) { Logger.log('  ⚠ ' + err.message); return null; }
  };
  const report = function (from, fromName, renames, t, dateHeader) {
    const to = sheetOrLog(t);
    if (!to) return;
    const src = tableInfo_(from).headers.map(function (h) {
      const k = Object.keys(renames || {}).find(function (x) { return fullTitle_(x) === fullTitle_(h); });
      return k ? renames[k] : h;
    });
    const auto = [dateHeader].concat(Object.keys(t.defaults || {})).filter(Boolean);
    const toHeaders = tableInfo_(to).headers;
    const missing = toHeaders.filter(function (h) {
      return String(h).trim() && sourceIndex_(src, h) < 0 && auto.map(fullTitle_).indexOf(fullTitle_(h)) < 0;
    });
    let line = '  ' + fromName + ' → ' + label(t) + ' : ' + (missing.length
      ? missing.length + ' colonne(s) remplie(s) à la main : ' + missing.map(firstLine_).join(' | ')
      : 'toutes les colonnes correspondent');
    [CONFIG.MATRICULE_HEADER].concat(Object.keys(t.defaults || {})).forEach(function (h) {
      if (colIndex_(toHeaders, h) < 0) line += '  ⚠ colonne « ' + h + ' » absente';
    });
    if (dateHeader && colIndex_(toHeaders, dateHeader) < 0) line += '  (« ' + dateHeader + ' » absente : date non notée)';
    Logger.log(line);
  };

  const all = circuits_();
  Object.keys(all).forEach(function (k) {
    const circuit = all[k];
    Logger.log('— Circuit « ' + k + ' » (colonnes « remplies à la main » : normal pour celles propres à chaque cellule) :');
    const formId = fileIdOrNull_(CONFIG.TYPES[circuit.type].responseSheetKey);
    if (formId) report(responseSheet_(SpreadsheetApp.openById(formId)), 'Formulaire', null, circuit.entry.target, null);

    circuit.rules.forEach(function (rule) {
      const from = sheetOrLog(rule.on);
      if (!from) return;
      const headers = tableInfo_(from).headers;
      [rule.column].concat([].concat.apply([], rule.cases.map(function (c) {
        return (c.requires || []).map(function (q) { return q.column; });
      }))).forEach(function (h) {
        if (colIndex_(headers, h) < 0) Logger.log('  ⚠ ' + label(rule.on) + ' : colonne « ' + h + ' » absente');
      });
      rule.cases.forEach(function (c) {
        c.targets.forEach(function (t) {
          report(from, label(rule.on) + ' [' + rule.column + ' = ' + c.values[0] + ']', rule.renameColumns, t, c.dateHeader);
        });
      });
    });
  });

  Logger.log('— Dossiers d\'archives des documents :');
  Object.keys(all).forEach(function (k) {
    try {
      Logger.log('  ✅ ' + k + ' : « ' + documentsFolder_(all[k].documents).getName() + ' »');
    } catch (err) {
      Logger.log('  ⚠ ' + k + ' : ' + err.message);
    }
  });
}
