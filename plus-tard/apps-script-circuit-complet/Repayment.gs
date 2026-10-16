/**
 * Suivi après financement : échéancier, état des remboursements, relances.
 */

/** Génère l'échéancier (mensualités constantes) dans la cellule de suivi. */
function createSchedule_(data) {
  const suiviCell = CONFIG.CELLS.find(function (c) { return c.key === 'suivi'; });
  if (!suiviCell) return;
  const sched = cellSpreadsheet_(suiviCell.key).getSheetByName(SHEET_SCHEDULE);
  if (findRow_(sched, headerMap_(sched)['Matricule'], data['Matricule']) > 0) return;

  const principal = Number(data['Montant accordé']);
  const n = Math.round(Number(data['Durée (mois)']));
  const annualRate = Number(data['Taux annuel (%)'] || 0);
  const deferral = Math.round(Number(data['Différé (mois)'] || 0));
  const start = new Date(data['Date de décaissement']);
  if (!(principal > 0) || !(n > 0) || isNaN(start.getTime())) {
    throw new Error('Montant, durée ou date de décaissement invalide pour ' + data['Matricule']);
  }

  const r = annualRate / 100 / 12;
  const installment = r > 0 ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n;
  const dec = decimalsFor_(data['Devise']);
  const rounded = round_(installment, dec);
  const total = round_(installment * n, dec);

  const map = headerMap_(sched);
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const amount = i < n ? rounded : round_(total - rounded * (n - 1), dec);
    const row = new Array(sched.getLastColumn()).fill('');
    row[map['Matricule'] - 1] = data['Matricule'];
    row[map['Nom / Raison sociale'] - 1] = data['Nom / Raison sociale'];
    row[map['Devise'] - 1] = data['Devise'] || '';
    row[map['N° échéance'] - 1] = i;
    row[map['Date échéance'] - 1] = addMonths_(start, deferral + i);
    row[map['Montant dû'] - 1] = amount;
    row[map['État'] - 1] = 'À venir';
    rows.push(row);
  }
  sched.getRange(sched.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  refreshRepayments_({ notify: false });
}

/** Déclencheur quotidien : met à jour les états et envoie les relances. */
function dailyRepaymentCheck() {
  refreshRepayments_({ notify: true });
}

function refreshRepayments_(options) {
  const suiviCell = CONFIG.CELLS.find(function (c) { return c.key === 'suivi'; });
  if (!suiviCell) return;
  const ss = cellSpreadsheet_(suiviCell.key);
  const sched = ss.getSheetByName(SHEET_SCHEDULE);
  const dossiers = ss.getSheetByName(SHEET_DOSSIERS);
  if (!sched || sched.getLastRow() < 2) return;

  const today = startOfDay_(new Date());
  const sm = headerMap_(sched);
  const values = sched.getRange(2, 1, sched.getLastRow() - 1, sched.getLastColumn()).getValues();
  const states = [];
  const lateDays = [];
  const agg = {};
  const upcoming = [];
  const overdue = [];

  values.forEach(function (row) {
    const m = row[sm['Matricule'] - 1];
    if (!m) { states.push(['']); lateDays.push(['']); return; }
    const due = Number(row[sm['Montant dû'] - 1]) || 0;
    const paid = Number(row[sm['Montant payé'] - 1]) || 0;
    const date = startOfDay_(row[sm['Date échéance'] - 1]);
    const days = Math.round((today - date) / 86400000);

    let state;
    let late = '';
    if (paid >= due) state = 'Payée';
    else if (days > 0) { state = paid > 0 ? 'Partielle - en retard' : 'En retard'; late = days; }
    else if (-days <= CONFIG.REMINDER_DAYS_BEFORE) state = 'Bientôt due';
    else state = paid > 0 ? 'Partielle' : 'À venir';
    states.push([state]);
    lateDays.push([late]);

    const a = agg[m] || (agg[m] = { due: 0, paid: 0, next: null, late: 0 });
    a.due += due;
    a.paid += paid;
    if (paid < due) {
      if (days > 0) a.late += 1;
      else if (!a.next || date < a.next) a.next = date;
    }

    const item = { matricule: m, nom: row[sm['Nom / Raison sociale'] - 1], n: row[sm['N° échéance'] - 1], date: date, rest: round_(due - paid), days: days };
    if (paid < due && days > 0) overdue.push(item);
    if (paid < due && -days === CONFIG.REMINDER_DAYS_BEFORE) upcoming.push(item);
  });

  sched.getRange(2, sm['État'], states.length, 1).setValues(states);
  sched.getRange(2, sm['Jours de retard'], lateDays.length, 1).setValues(lateDays);

  updateDossierTotals_(dossiers, agg);

  if (options && options.notify) sendRepaymentNotifications_(dossiers, upcoming, overdue);
}

function updateDossierTotals_(sheet, agg) {
  if (sheet.getLastRow() < 2) return;
  const map = headerMap_(sheet);
  const n = sheet.getLastRow() - 1;
  const read = function (h) { return sheet.getRange(2, map[h], n, 1).getValues(); };
  const matricules = read('Matricule');
  const cols = {
    'Montant total dû': read('Montant total dû'),
    'Total payé': read('Total payé'),
    'Reste dû': read('Reste dû'),
    'Prochaine échéance': read('Prochaine échéance'),
    'Échéances en retard': read('Échéances en retard'),
    'Statut': read('Statut'),
  };

  matricules.forEach(function (m, i) {
    const a = agg[m[0]];
    if (!a) return;
    const rest = round_(a.due - a.paid);
    cols['Montant total dû'][i][0] = round_(a.due);
    cols['Total payé'][i][0] = round_(a.paid);
    cols['Reste dû'][i][0] = rest;
    cols['Prochaine échéance'][i][0] = a.next || '';
    cols['Échéances en retard'][i][0] = a.late;
    if (cols['Statut'][i][0] !== 'Contentieux') {
      cols['Statut'][i][0] = rest <= 0 ? 'Soldé' : (a.late > 0 ? 'En retard' : 'À jour');
    }
  });

  Object.keys(cols).forEach(function (h) {
    sheet.getRange(2, map[h], n, 1).setValues(cols[h]);
  });
}

function sendRepaymentNotifications_(dossiers, upcoming, overdue) {
  const line = function (x) {
    return x.matricule + ' — ' + x.nom + ' — échéance n°' + x.n + ' du ' + formatDate_(x.date) +
      ' — reste ' + x.rest + (x.days > 0 ? ' — ' + x.days + ' j de retard' : '');
  };

  if (CONFIG.NOTIFY_EMAILS.length && (overdue.length || upcoming.length)) {
    MailApp.sendEmail({
      to: CONFIG.NOTIFY_EMAILS.join(','),
      subject: '[' + CONFIG.ORG_NAME + '] Suivi des remboursements — ' + overdue.length + ' échéance(s) en retard',
      body: 'Échéances en retard :\n' + (overdue.map(line).join('\n') || 'Aucune') +
        '\n\nÉchéances dans ' + CONFIG.REMINDER_DAYS_BEFORE + ' jours :\n' + (upcoming.map(line).join('\n') || 'Aucune') +
        '\n\nFeuille de suivi : ' + dossiers.getParent().getUrl(),
    });
  }

  if (!CONFIG.REMIND_APPLICANTS) return;
  const map = headerMap_(dossiers);
  const emailOf = function (m) {
    const r = findRow_(dossiers, map['Matricule'], m);
    return r > 0 ? String(dossiers.getRange(r, map['Email']).getValue() || '') : '';
  };
  upcoming.forEach(function (x) {
    const to = emailOf(x.matricule);
    if (to) MailApp.sendEmail(to, '[' + CONFIG.ORG_NAME + '] Rappel d\'échéance',
      'Bonjour ' + x.nom + ',\n\nVotre échéance n°' + x.n + ' (dossier ' + x.matricule + ') d\'un montant de ' + x.rest +
      ' arrive à terme le ' + formatDate_(x.date) + '.\n\nCordialement,\n' + CONFIG.ORG_NAME);
  });
  overdue.filter(function (x) { return CONFIG.OVERDUE_REMINDER_DAYS.indexOf(x.days) !== -1; }).forEach(function (x) {
    const to = emailOf(x.matricule);
    if (to) MailApp.sendEmail(to, '[' + CONFIG.ORG_NAME + '] Échéance impayée',
      'Bonjour ' + x.nom + ',\n\nSauf erreur de notre part, votre échéance n°' + x.n + ' (dossier ' + x.matricule +
      ') du ' + formatDate_(x.date) + ' reste impayée (' + x.rest + '), soit ' + x.days +
      ' jour(s) de retard.\nMerci de régulariser votre situation.\n\nCordialement,\n' + CONFIG.ORG_NAME);
  });
}
