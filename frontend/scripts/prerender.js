/**
 * Prerendu des pages publiques apres `craco build`.
 *
 * Pourquoi : l'application est une SPA React. Sans prerendu, le HTML servi ne
 * contient qu'une <div id="root"> vide. Googlebot execute le JavaScript (avec
 * un delai), mais les robots des assistants IA (GPTBot, ClaudeBot,
 * PerplexityBot) et les generateurs d'apercu (WhatsApp, Facebook) ne
 * l'executent pas : pour eux le site est une page blanche.
 *
 * Ce script ecrit, pour chaque route publique, un fichier HTML statique
 * contenant les vraies balises <head> de la page et son contenu textuel.
 * React se monte ensuite par-dessus et remplace le contenu : les visiteurs
 * gardent l'application interactive, les robots recoivent du contenu des le
 * premier passage.
 *
 * Le texte provient des memes sources que les composants React
 * (src/data/faq.json), il n'y a donc pas de divergence de contenu.
 */
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const SITE_URL = 'https://www.silkroute.africa';
const faqItems = require('../src/data/faq.json');

// --- Utilitaires -----------------------------------------------------------

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const p = (text) => `<p>${escapeHtml(text)}</p>`;
const li = (text) => `<li>${escapeHtml(text)}</li>`;

// Navigation et pied de page : presents sur toutes les pages prerendues, ils
// donnent aux robots le maillage interne du site des le premier passage.
const NAV_HTML = `
<nav aria-label="Navigation principale">
  <a href="/">SilkRoute</a>
  <a href="/groupages">Groupages</a>
  <a href="/faq">FAQ</a>
  <a href="/login">Connexion</a>
  <a href="/register">Inscription</a>
</nav>`;

const FOOTER_HTML = `
<footer>
  <a href="/faq">FAQ</a>
  <a href="/terms">Conditions générales d'utilisation</a>
  <a href="/privacy">Politique de confidentialité</a>
  <a href="/contact">Contact</a>
  <p>© ${new Date().getFullYear()} SilkRoute — achats groupés Chine-Afrique.</p>
</footer>`;

// --- Contenu de chaque route ----------------------------------------------

const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SilkRoute',
  url: SITE_URL,
  description:
    "Plateforme d'achats groupés permettant aux commerçants africains d'importer depuis la Chine au prix de gros.",
  areaServed: { '@type': 'Country', name: 'Cameroun' },
  knowsLanguage: ['fr', 'en']
};

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a }
  }))
};

const routes = [
  {
    path: '/',
    title: 'SilkRoute — Achats groupés Chine-Afrique, importez au prix de gros',
    description:
      "Importez depuis la Chine sans voyager : achats groupés entre commerçants, fournisseurs vérifiés, transitaires licenciés, retrait à Douala et Yaoundé.",
    jsonLd: ORGANIZATION_JSONLD,
    body: `
<h1>Importez depuis la Chine. Ensemble.</h1>
${p("Groupez vos achats, partagez les frais logistiques et obtenez le prix de gros chinois sans voyager ni immobiliser un gros capital.")}
<h2>Pourquoi acheter en groupage plutôt que seul ?</h2>
${p("Seul, vous payez le tarif « petite quantité » du fournisseur, supportez l'intégralité du transport, du dédouanement et des frais d'agent, et vous vous exposez aux arnaques classiques d'Alibaba ou 1688. En rejoignant une commande groupée, le prix de gros est atteint collectivement et les frais logistiques sont répartis entre les membres.")}
<h2>Comment ça marche</h2>
<ol>
  ${li("Choisissez un groupage ouvert : produit, prix groupé comparé au prix seul, transitaire et délais sont affichés.")}
  ${li("Réservez votre quantité, choisissez votre ville de retrait et confirmez.")}
  ${li("Suivez l'expédition en 6 étapes, mises à jour par le transitaire.")}
  ${li("Récupérez votre marchandise dans votre ville, au prix de gros.")}
</ol>
<h2>Nos garanties</h2>
<ul>
  ${li("Fournisseurs vérifiés : licence commerciale contrôlée et conservée, statut Gold Supplier et Trade Assurance.")}
  ${li("Transitaires licenciés : tarifs transparents au kilo pour l'aérien ou au mètre cube (CBM) pour le maritime.")}
  ${li("Comparateur intégré : prix groupé, prix d'une commande seule et prix chez un grossiste local, avant tout engagement.")}
  ${li("Paiement local en Mobile Money (Orange Money, MTN MoMo) ou par carte : aucun virement international à gérer.")}
</ul>
${p("Zone desservie : Cameroun — retrait à Douala et Yaoundé. Consultez la FAQ pour les tarifs de fret, les délais et la vérification des fournisseurs.")}`
  },
  {
    path: '/faq',
    title: "Importer de Chine vers l'Afrique : questions fréquentes | SilkRoute",
    description:
      "Prix du fret Chine-Cameroun au kg ou au CBM, délais, éviter les arnaques Alibaba, payer un fournisseur chinois depuis l'Afrique : nos réponses.",
    jsonLd: FAQ_JSONLD,
    body: `
<h1>Questions fréquentes</h1>
${p("Tout ce qu'il faut savoir pour importer de Chine vers l'Afrique en achat groupé.")}
${faqItems.map((item) => `<section><h2>${escapeHtml(item.q)}</h2>${p(item.a)}</section>`).join('\n')}
<h2>Prêt à importer malin ?</h2>
${p("Rejoignez un groupage ouvert ou proposez votre produit.")}
<a href="/groupages">Voir les groupages</a>
<a href="/register">Créer un compte gratuit</a>`
  },
  {
    path: '/groupages',
    title: 'Groupages ouverts : commandes groupées Chine-Afrique | SilkRoute',
    description:
      "Rejoignez une commande groupée en cours : électronique, textiles, beauté, ménager. Prix de gros, transitaire licencié, retrait dans votre ville.",
    body: `
<h1>Groupages actifs</h1>
${p("Rejoignez un groupe d'acheteurs et économisez sur vos importations depuis la Chine.")}
<h2>Catégories disponibles</h2>
<ul>
  ${li('Électronique : téléphones, accessoires, petits appareils')}
  ${li('Textiles : vêtements, tissus, chaussures')}
  ${li('Beauté : cosmétiques, perruques, soins')}
  ${li('Ménager : ustensiles, petit électroménager, décoration')}
</ul>
${p("Chaque groupage affiche le produit, le prix de gros obtenu, la quantité déjà réservée, la date limite pour rejoindre, le transitaire recommandé, le mode de transport et les villes de retrait disponibles.")}
${p("Aucun groupage ne correspond à votre besoin ? Créez un compte pour proposer un produit : dès que suffisamment de membres sont intéressés, nous ouvrons la commande groupée.")}`
  },
  {
    path: '/terms',
    title: "Conditions générales d'utilisation | SilkRoute",
    description:
      "Conditions générales d'utilisation de la plateforme d'achats groupés SilkRoute : rôle de la plateforme, commandes groupées, paiements, livraison et responsabilités.",
    body: `
<h1>Conditions générales d'utilisation</h1>
<h2>1. Objet et rôle de SilkRoute</h2>
${p("SilkRoute est une plateforme de mise en relation qui permet à plusieurs acheteurs de regrouper leurs commandes auprès de fournisseurs situés en Chine, et d'organiser leur acheminement via des transitaires partenaires.")}
<h2>2. Inscription et vérification d'identité</h2>
${p("L'accès aux commandes groupées nécessite la création d'un compte et la vérification de votre identité (KYC). Vous vous engagez à fournir des informations exactes et des documents authentiques.")}
<h2>3. Commandes groupées et engagement</h2>
${p("En rejoignant un groupage, vous réservez une quantité déterminée et vous engagez à en régler le montant. Le choix de la ville de retrait est définitif.")}
<h2>4. Prix, délais et aléas</h2>
${p("Les prix sont exprimés en francs CFA. Les délais annoncés sont estimatifs : ils dépendent de la production, du transport international et du dédouanement.")}
<h2>5. Livraison et retrait</h2>
${p("La marchandise est mise à disposition dans la ville de retrait choisie. Il vous appartient de venir la récupérer dans les délais communiqués.")}
<h2>6. Responsabilités</h2>
${p("SilkRoute vérifie les documents des fournisseurs et sélectionne des transitaires licenciés, mais n'est pas le fabricant des produits. Signalez toute non-conformité sans délai via la plateforme.")}
<h2>7. Usage de la plateforme</h2>
${p("Les espaces de discussion sont réservés à la coordination des commandes. Tout contenu illicite ou toute tentative de contourner la plateforme peut entraîner la suspension du compte.")}`
  },
  {
    path: '/privacy',
    title: 'Politique de confidentialité | SilkRoute',
    description:
      "Comment SilkRoute collecte, utilise et protège vos données personnelles : compte, vérification d'identité, commandes et paiements.",
    body: `
<h1>Politique de confidentialité</h1>
<h2>1. Données que nous collectons</h2>
${p("Compte (nom, email, mot de passe chiffré, téléphone, ville), vérification d'identité (pièce d'identité et photo), commandes (quantités, ville de retrait, paiements) et messages échangés dans les groupages.")}
<h2>2. Utilisation des données</h2>
${p("Vos données servent exclusivement à gérer votre compte, vérifier votre identité, organiser et suivre les commandes groupées, communiquer avec vous et respecter nos obligations légales. Nous ne vendons aucune donnée.")}
<h2>3. Partage avec des tiers</h2>
${p("Seules les informations nécessaires à l'exécution de votre commande sont transmises : au transitaire (nom, téléphone, ville de retrait, quantité) et au prestataire de paiement. Les documents d'identité ne sont jamais transmis aux fournisseurs, transitaires ou autres membres.")}
<h2>4. Sécurité</h2>
${p("Les échanges avec le site sont chiffrés (HTTPS). Les mots de passe sont hachés. Les documents d'identité sont stockés sur un espace à accès restreint.")}
<h2>5. Conservation et vos droits</h2>
${p("Vous pouvez consulter et modifier vos informations depuis « Mon compte », ou demander la suppression de votre compte en nous écrivant.")}
<h2>6. Cookies et mesure d'audience</h2>
${p("Nous utilisons un cookie strictement nécessaire pour maintenir votre session. Aucun cookie publicitaire. Aucun outil d'enregistrement de session n'est actif.")}`
  },
  {
    path: '/contact',
    title: 'Contact | SilkRoute',
    description:
      "Contactez l'équipe SilkRoute : questions sur les commandes groupées Chine-Afrique, partenariats fournisseurs et transitaires.",
    body: `
<h1>Contact</h1>
${p("Une question sur une commande, un partenariat, ou envie de proposer un produit ? Écrivez-nous, nous répondons sous 48 heures ouvrées.")}
<h2>Email</h2>
${p('contact@silkroute.africa')}
<h2>Zone desservie</h2>
${p('Cameroun — Douala, Yaoundé')}
<h2>Partenariats</h2>
${p("Transitaires et fournisseurs : écrivez-nous par email pour devenir partenaire.")}
${p('Consultez aussi notre FAQ : la réponse à votre question s\'y trouve peut-être déjà.')}`
  },
  {
    path: '/register',
    title: 'Créer un compte gratuit | SilkRoute',
    description:
      "Créez votre compte SilkRoute gratuitement et rejoignez des commandes groupées Chine-Afrique au prix de gros.",
    body: `
<h1>Créer un compte</h1>
${p("L'inscription est gratuite. Après vérification de votre identité, vous pouvez rejoindre les commandes groupées ouvertes et proposer vos propres produits.")}
<a href="/login">J'ai déjà un compte : se connecter</a>`
  },
  {
    path: '/login',
    title: 'Connexion à votre compte | SilkRoute',
    description:
      "Connectez-vous à votre compte SilkRoute pour suivre vos commandes groupées depuis la Chine.",
    body: `
<h1>Connexion</h1>
${p("Connectez-vous pour suivre vos commandes groupées et discuter avec les autres membres.")}
<a href="/register">Pas encore de compte : inscription gratuite</a>
<a href="/forgot-password">Mot de passe oublié</a>`
  }
];

// --- Generation ------------------------------------------------------------

const templatePath = path.join(BUILD_DIR, 'index.html');
if (!fs.existsSync(templatePath)) {
  console.error('[prerender] build/index.html introuvable — lancez le build avant ce script.');
  process.exit(1);
}
const template = fs.readFileSync(templatePath, 'utf8');

const buildHead = ({ title, description, path: routePath, jsonLd }) => {
  const url = `${SITE_URL}${routePath}`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}"/>`,
    `<link rel="canonical" href="${url}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:site_name" content="SilkRoute"/>`,
    `<meta property="og:title" content="${escapeHtml(title)}"/>`,
    `<meta property="og:description" content="${escapeHtml(description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<meta name="twitter:card" content="summary"/>`
  ];
  if (jsonLd) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
  }
  return tags.join('');
};

const renderRoute = (route) => {
  let html = template;

  // Retire les balises head par defaut pour eviter les doublons (titre,
  // description, canonical, open graph) avant d'injecter celles de la page.
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, '');

  // Les remplacements passent par une fonction : sinon les sequences `$&`, `$'`
  // ou `$1` presentes dans le texte injecte seraient interpretees par
  // String.replace comme des references de capture et corrompraient le HTML.
  const head = buildHead(route);
  html = html.replace('</head>', () => `${head}</head>`);

  // Contenu statique dans #root : remplace par React au montage.
  const content = `${NAV_HTML}<main>${route.body}</main>${FOOTER_HTML}`;
  html = html.replace('<div id="root"></div>', () => `<div id="root">${content}</div>`);

  return html;
};

let count = 0;
let failures = 0;

routes.forEach((route) => {
  // Une erreur sur une route est signalee mais n'interrompt pas les autres :
  // le build reste exploitable (la route non prerendue reste servie en SPA).
  try {
    const html = renderRoute(route);

    if (html.indexOf('<div id="root">') === -1) {
      throw new Error('le conteneur #root n\'a pas ete trouve dans le gabarit');
    }
    if ((html.match(/<title>/g) || []).length !== 1) {
      throw new Error('nombre de balises <title> inattendu');
    }

    const outDir = route.path === '/' ? BUILD_DIR : path.join(BUILD_DIR, route.path);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'index.html');
    fs.writeFileSync(outFile, html, 'utf8');

    const words = route.body.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(
      `[prerender] ${route.path.padEnd(12)} -> ${path.relative(BUILD_DIR, outFile)} (${words} mots)`
    );
    count += 1;
  } catch (err) {
    failures += 1;
    console.error(`[prerender] ECHEC sur ${route.path} : ${err.message}`);
  }
});

console.log(`[prerender] ${count}/${routes.length} pages prerendues${failures ? ` (${failures} echec(s))` : ''}.`);

// Si aucune page n'a pu etre generee, quelque chose de structurel a change dans
// le gabarit : on fait echouer le build pour que le probleme soit visible
// (Vercel conserve alors le deploiement precedent, le site reste en ligne).
if (count === 0) {
  console.error('[prerender] Aucune page generee — build interrompu.');
  process.exit(1);
}
