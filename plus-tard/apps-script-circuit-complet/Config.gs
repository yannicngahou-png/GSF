/**
 * GSF — Configuration générale du circuit de traitement des dossiers.
 *
 * Modifiez ce fichier pour adapter les cellules, les statuts et les formulaires.
 * Après toute modification des cellules, relancez la fonction `setup()`.
 */
const CONFIG = {
  ORG_NAME: 'GSF',

  // Dossier racine (registre + feuilles des cellules), créé dans le Drive du compte qui déploie le script.
  ROOT_FOLDER_NAME: 'GSF - Gestion des financements',

  // Adresses qui reçoivent le récapitulatif quotidien des remboursements.
  NOTIFY_EMAILS: [],

  // Envoyer aussi des rappels aux demandeurs (email saisi sur la landing page).
  REMIND_APPLICANTS: false,

  // Rappel envoyé N jours avant une échéance.
  REMINDER_DAYS_BEFORE: 7,

  // Relances envoyées au demandeur après N jours de retard.
  OVERDUE_REMINDER_DAYS: [1, 7, 15, 30],

  // Remise à zéro du compteur du matricule : 'never' (numérotation continue), 'yearly' ou 'daily'.
  COUNTER_RESET: 'never',

  // En-tête de la colonne où le script inscrit le matricule dans chaque feuille de réponses
  // (créée automatiquement si elle n'existe pas).
  MATRICULE_HEADER: 'Matricule du dossier',

  // Envoi au demandeur d'un email avec son matricule. Désactivé : le demandeur retrouve
  // son matricule sur la landing page (email + n° WhatsApp). Les emails partent de
  // l'adresse du compte qui installe le script (100 par jour pour un compte gratuit).
  SEND_EMAILS: false,

  // Adresse de la landing page (Vercel), pour le lien de l'email. Ex. : 'https://gsf.vercel.app'
  UPLOAD_PAGE_URL: '',

  // Adresse qui reçoit les réponses des demandeurs à l'email (facultatif).
  REPLY_TO: '',

  // Limites de téléversement (doivent correspondre à web/src/config.js).
  MAX_FILE_MB: 10,
  MAX_FILES: 15,
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'],

  /**
   * Types de demande.
   *  - prefix : début du matricule → PREFIX_AAAAMMJJ_00001
   *  - folderId : dossier Drive qui reçoit un sous-dossier par demandeur
   *  - responseSheetId : ID de la feuille de réponses liée au Google Form
   *    (la partie entre /d/ et /edit dans l'URL)
   *  - formFields : début de l'intitulé des questions nom, prénom, téléphone, email
   *  - formColumns : réponses reprises dans la cellule Réception (étape suivante)
   *    { colonne de la cellule : début de l'intitulé de la question }
   */
  TYPES: {
    assistance: {
      label: 'Aide',
      prefix: 'GSF',
      folderId: '1x_f9iSeLb4i9poJJvGpRm3HVbYliI6Pa',
      responseSheetId: '',
      formFields: {
        nom: 'Nom(s)',
        prenom: 'Prénom(s)',
        telephone: 'Tel (WhatsApp)',
        email: 'Email',
      },
      formColumns: {
        'Pays de résidence': 'Pays de résidence',
        "Type d'évènement": "Type d'évènement",
        'Objet de la demande': 'Objet précis de la demande',
      },
    },
    pret: {
      label: 'Prêt',
      prefix: 'PAFIS',
      folderId: '19_njNkG5XTA5SkfeuzIfP6hlaoMzgDTl',
      responseSheetId: '',
      formFields: {
        nom: 'Nom(s)',
        prenom: 'Prénom(s)',
        telephone: 'Votre numéro WhatsApp',
        email: 'Adresse email',
      },
      formColumns: {
        'Pays de résidence': 'Pays de résidence',
        'Devise': 'Devise de votre demande',
        'Montant demandé': 'Montant demandé',
        'Durée souhaitée (mois)': 'Durée de remboursement souhaitée',
      },
    },
  },

  // Statuts par défaut (colonne « Statut » de chaque cellule).
  STATUSES: ['Nouveau', 'En cours', 'Incomplet', 'Favorable', 'Défavorable', 'Ajourné'],
  STATUS_NEW: 'Nouveau',
  STATUS_FAVORABLE: 'Favorable',
  DECISION_STATUSES: ['Favorable', 'Défavorable', 'Ajourné'],

  /**
   * Cellules, dans l'ordre du circuit. Un dossier « Favorable » passe à la
   * cellule suivante qui traite son type.
   *  - types : types de demande traités par la cellule
   *  - extraColumns : colonnes propres à la cellule (les colonnes portant le
   *    même nom dans la cellule suivante sont recopiées automatiquement)
   *  - requiredForFavorable : colonnes à remplir avant de passer « Favorable »,
   *    par type de demande
   *  - onFavorable : action spéciale ('createSchedule' = générer l'échéancier)
   *  - statuses : remplace la liste de statuts par défaut
   *  - emails : adresses prévenues quand un dossier arrive dans la cellule
   */
  CELLS: [
    {
      key: 'reception',
      name: '01 - Cellule Réception',
      types: ['pret', 'assistance'],
      extraColumns: ['Nb documents', 'Pièces complètes ?', 'Pays de résidence', 'Devise', 'Montant demandé',
        'Durée souhaitée (mois)', "Type d'évènement", 'Objet de la demande'],
      emails: [],
    },
    {
      key: 'analyse',
      name: '02 - Cellule Analyse',
      types: ['pret', 'assistance'],
      extraColumns: ['Pays de résidence', 'Devise', 'Montant demandé', 'Durée souhaitée (mois)',
        "Type d'évènement", 'Objet de la demande', 'Note / Score', 'Recommandation'],
      emails: [],
    },
    {
      key: 'comite',
      name: '03 - Comité de Décision',
      types: ['pret', 'assistance'],
      extraColumns: ['Devise', 'Montant demandé', 'Montant accordé', 'Taux annuel (%)', 'Durée (mois)',
        'Différé (mois)', 'Date du comité'],
      emails: [],
    },
    {
      key: 'decaissement',
      name: '04 - Cellule Décaissement',
      types: ['pret', 'assistance'],
      extraColumns: ['Devise', 'Montant accordé', 'Taux annuel (%)', 'Durée (mois)', 'Différé (mois)',
        'Date de décaissement', 'Mode de décaissement', 'Référence'],
      requiredForFavorable: {
        pret: ['Montant accordé', 'Durée (mois)', 'Date de décaissement'],
        assistance: ['Montant accordé', 'Date de décaissement'],
      },
      onFavorable: 'createSchedule',
      emails: [],
    },
    {
      key: 'suivi',
      name: '05 - Cellule Suivi & Recouvrement',
      types: ['pret'],
      extraColumns: ['Devise', 'Montant accordé', 'Date de décaissement', 'Montant total dû', 'Total payé',
        'Reste dû', 'Prochaine échéance', 'Échéances en retard'],
      statuses: ['Nouveau', 'À jour', 'En retard', 'Soldé', 'Contentieux'],
      emails: [],
    },
  ],
};

// Noms d'onglets et colonnes communes (ne pas modifier sans adapter le code).
const SHEET_DOSSIERS = 'Dossiers';
const SHEET_REGISTRY = 'Registre';
const SHEET_SCHEDULE = 'Échéancier';

const BASE_COLUMNS = [
  'Matricule', 'Type', 'Nom / Raison sociale', 'Email', 'Téléphone',
  'Dossier (Drive)', 'Formulaire (réponse)', "Date d'entrée", 'Statut',
  'Responsable', 'Observations', 'Avis cellule précédente',
  'Date décision', 'Transmis à', 'Date transmission',
];

// Colonnes propres au circuit, jamais recopiées d'une cellule à l'autre.
const WORKFLOW_COLUMNS = [
  "Date d'entrée", 'Statut', 'Responsable', 'Observations',
  'Avis cellule précédente', 'Date décision', 'Transmis à', 'Date transmission',
];

const REGISTRY_COLUMNS = [
  'Matricule', 'Type', 'Nom / Raison sociale', 'Email', 'Téléphone',
  'Date de souscription', 'Dossier (Drive)', 'Nb documents', 'Dernier dépôt',
  'Formulaire (réponse)', 'Observations',
];

const SCHEDULE_COLUMNS = [
  'Matricule', 'Nom / Raison sociale', 'Devise', 'N° échéance', 'Date échéance',
  'Montant dû', 'Montant payé', 'Date paiement', 'État', 'Jours de retard', 'Commentaire',
];

const STATUS_COLORS = {
  'Nouveau': '#e8f0fe',
  'En cours': '#fff4d6',
  'Incomplet': '#fde2cf',
  'Favorable': '#d6f2df',
  'Défavorable': '#f8d7da',
  'Ajourné': '#e9e2f5',
  'À jour': '#d6f2df',
  'En retard': '#f8d7da',
  'Soldé': '#cfe8ff',
  'Contentieux': '#f2c4c4',
};
