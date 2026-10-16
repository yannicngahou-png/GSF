/**
 * ✏️ PERSONNALISATION DE LA PAGE
 * Textes, couleurs et logo : tout se modifie ici.
 * En local (`npm run dev`), la page se met à jour dès que vous enregistrez.
 */

// Couleurs (codes hexadécimaux, ex. choisis sur https://htmlcolorcodes.com/fr/)
export const THEME = {
  primary: '#1f3a5f',     // bandeau du haut, titres
  accent: '#1f8a5b',      // boutons, icônes, liens
  accentSoft: '#e7f4ed',  // fond des icônes et zones survolées
  background: '#f5f7fa',  // fond de page
  text: '#14233a',        // texte principal
  muted: '#5b6b80',       // texte secondaire
};

export const CONTENT = {
  orgName: 'GSF',
  // Remplacez web/public/logo.svg par votre logo (ou déposez logo.png et écrivez '/logo.png').
  // Mettez null pour n'afficher que le nom.
  logo: '/logo.svg',
  tagline: 'Dépôt de dossiers de financement',

  hero: {
    title: 'Déposez votre demande',
    text:
      'Choisissez le type de demande et remplissez le formulaire. Revenez ensuite sur cette page, rubrique ' +
      '« Déposer mes documents » : votre matricule de dossier s\'affichera et vous pourrez déposer vos pièces.',
  },

  types: {
    assistance: {
      title: "Demande d'assistance",
      text: "Aide de solidarité suite à un évènement touchant un membre (Tontard / Akiba Invest).",
      cta: 'Remplir le formulaire',
      // Liste indicative affichée dans l'espace de dépôt.
      documents: [
        "Pièce d'identité du membre",
        "Justificatif de l'évènement (acte, certificat, facture…)",
        "Relevé d'identité bancaire (si vous avez un compte)",
      ],
    },
    pret: {
      title: 'Demande de prêt',
      text: 'Financement de votre activité, remboursable de 3 à 12 mois (programme PAFIS).',
      cta: 'Remplir le formulaire',
      documents: [
        "Pièce d'identité",
        "Justificatifs de l'activité (photos, factures, registre de ventes…)",
        "Documents de l'entreprise ou du groupement, le cas échéant",
        "Relevé d'identité bancaire (si vous avez un compte)",
      ],
    },
  },

  steps: ['Remplissez le formulaire', 'Identifiez-vous ici : votre matricule s\'affiche', 'Déposez vos documents'],

  uploadCard: {
    title: 'Déposer mes documents',
    text: 'Vous avez envoyé le formulaire ? Retrouvez votre matricule et déposez vos pièces justificatives.',
    cta: 'Accéder au dépôt',
  },

  upload: {
    title: 'Dépôt des documents',
    text: "Indiquez l'email et le numéro WhatsApp saisis dans votre formulaire pour retrouver votre dossier.",
  },

  done: {
    title: 'Documents reçus',
    text: 'Vos documents ont bien été ajoutés à votre dossier.',
    note: 'Vous pouvez revenir à tout moment ajouter des documents avec votre matricule.',
  },

  consent: "Je certifie l'exactitude des documents transmis.",
  footer: 'GSF — Tontard / Akiba Invest',
};
