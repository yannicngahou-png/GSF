/** Configuration technique (formulaires, limites, connexion à Apps Script). */

// URL de l'application web Apps Script. Vide = mode démo.
export const APPS_SCRIPT_URL = (import.meta.env.VITE_APPS_SCRIPT_URL || '').trim();
export const DEMO_MODE = !APPS_SCRIPT_URL || /VOTRE_ID/.test(APPS_SCRIPT_URL);

// Liens des Google Forms (le matricule est attribué par le script après l'envoi).
export const FORMS = {
  assistance: 'https://forms.gle/5C6dZRQUtFYTycpL6',
  pret: 'https://forms.gle/GMKnbbQUW4i4vsY16',
};

// Format du matricule et type de demande correspondant.
export const MATRICULE_PATTERN = /^(GSF|PAFIS)_\d{8}_\d{5}$/;
export const TYPE_BY_PREFIX = { GSF: 'assistance', PAFIS: 'pret' };

// Doivent correspondre à CONFIG dans apps-script/Config.gs.
export const MAX_FILE_MB = 10;
export const MAX_FILES = 15;
export const MIN_FILES = 1;
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'];
