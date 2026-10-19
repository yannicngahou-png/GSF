/**
 * ✏️ PERSONNALISATION DE LA PAGE
 * Textes, couleurs et logo : tout se modifie ici.
 * En local (`npm run dev`), la page se met à jour dès que vous enregistrez.
 */

// Couleurs de la charte Global Social Funds (codes hexadécimaux)
export const THEME = {
  primary: '#04533D',      // vert du bandeau : boutons, bandeaux
  primaryDark: '#02422A',  // vert foncé du logo : titres, pied de page
  green: '#0D7E52',        // vert vif : icônes, survols
  gold: '#F4C127',         // jaune doré : accents, soulignés, bouton de dépôt
  background: '#FAF6ED',   // fond crème
  text: '#1F2D27',         // texte principal
  muted: '#5E6B63',        // texte secondaire
};

export const CONTENT = {
  orgName: 'Global Social Funds',
  // Logo : web/public/logo.png (mettez null pour n'afficher que le nom).
  logo: '/logo.png',
  tagline: 'Ensemble pour un impact durable',
  // Devise affichée en écriture manuscrite.
  motto: ['Solidarité', 'Soutien', 'Progrès'],

  hero: {
    kicker: 'Dépôt de dossiers',
    title: 'Déposez votre demande',
    highlight: "d'aide ou de prêt",
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
    text: "Indiquez le type de demande, puis l'email et le numéro WhatsApp saisis dans votre formulaire.",
    // Aide affichée sous le choix du type de demande.
    hints: {
      assistance:
        "Si vous avez rempli le formulaire pour un membre (ayant droit), indiquez l'email et le numéro " +
        'saisis dans la rubrique « Formulaire rempli par une tierce personne ».',
      pret: '',
    },
  },

  done: {
    title: 'Documents reçus',
    text: 'Vos documents ont bien été ajoutés à votre dossier.',
    note: 'Vous pouvez revenir à tout moment ajouter des documents avec votre matricule.',
  },

  consent: "Je certifie l'exactitude des documents transmis.",
  footer: 'Global Social Funds — Tontard / Akiba Invest',
};
