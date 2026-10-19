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
      // Documents demandés dans l'espace de dépôt, chacun avec sa zone de téléversement.
      //  label : intitulé · hint : consigne (en italique) · required : obligatoire ou non
      //  prefix : début du nom du fichier enregistré dans Drive
      //  template : { label, url } modèle à télécharger (facultatif)
      documents: [
        { prefix: 'Identite', label: "Document d'identité", required: true },
        {
          prefix: 'Preuve evenement', label: "Document de preuve de l'évènement", required: true,
          hint: 'Acte de naissance, de décès, de mariage…',
        },
        {
          prefix: 'Autre', label: 'Autres documents', required: false,
          hint: 'Tout autre document utile à votre demande, qui ne figure pas dans la liste ci-dessus.',
        },
      ],
    },
    pret: {
      title: 'Demande de prêt',
      text: 'Financement de votre activité, remboursable de 3 à 12 mois (programme PAFIS).',
      cta: 'Remplir le formulaire',
      documents: [
        {
          prefix: 'Photo identite', label: "Photo d'identité", required: true,
          hint: 'Visage entier, de face, bien éclairé, sans lunettes de soleil ni casquette.',
        },
        {
          prefix: 'Piece identite', label: "Pièce d'identité", required: true,
          hint: 'Version PDF de la pièce entière, toutes les mentions lisibles. Une copie légalisée n’est pas nécessaire.',
        },
        {
          prefix: 'Fiche projet', label: 'Fiche sommaire de projet', required: true,
          hint: 'Veuillez téléverser la fiche sommaire de projet dont le canevas a été mis à votre disposition.',
          // Modèle à télécharger, remplir puis déposer : fichier placé dans web/public/modeles/
          // (téléchargeable sans compte Google). Pour le mettre à jour, remplacez ce fichier.
          template: {
            label: 'Télécharger le modèle (Word)',
            url: '/modeles/Fiche-sommaire-de-projet-GSF.docx',
          },
        },
        {
          prefix: 'Preuves ventes', label: 'Preuves de ventes', required: true,
          hint: 'Carnet de ventes, factures, reçus, captures de paiements Mobile Money… couvrant les 3 à 6 derniers mois.',
        },
        {
          prefix: 'Releve 3 mois', label: 'Relevé Mobile Money ou bancaire des 3 derniers mois', required: false,
          hint: 'Recommandé si vous encaissez par Mobile Money ou par la banque : il prouve vos entrées d’argent.',
        },
        {
          prefix: 'Anciennete activite', label: 'Preuve que votre activité existe depuis au moins 1 an', required: true,
          hint: 'Carte de commerçant, RCCM ou IFU, attestation du marché ou de la mairie, ancienne facture ou ancien reçu daté, publication datée…',
        },
        {
          prefix: 'Photos activite', label: 'Photos de votre activité', required: true,
          hint: '2 ou 3 photos : lieu de vente ou atelier, stock, équipements.',
        },
        {
          prefix: 'Devis', label: 'Devis ou facture pro forma des achats prévus', required: false,
          hint: 'Si vous prévoyez d’acheter un équipement ou un gros stock.',
        },
        {
          prefix: 'Bilan annuel',
          label: 'Bilan annuel certifié de vos activités (pour les deux dernières années ou à défaut pour la dernière année)',
          required: false,
          hint: 'Le bilan des activités.',
        },
        {
          prefix: 'Autre', label: 'Autres documents', required: false,
          hint: 'Tout autre document utile à votre demande, qui ne figure pas dans la liste ci-dessus.',
        },
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
  footer: 'Global Social Funds — Tontard',
};
