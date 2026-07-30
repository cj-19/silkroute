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
const https = require('https');
const http = require('http');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const SITE_URL = 'https://www.silkroute.africa';
const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://api.silkroute.africa').replace(/\/$/, '');
const faqItems = require('../src/data/faq.json');

// Recupere le contenu publie depuis l'API. En cas d'indisponibilite, le build
// continue avec le contenu statique seul : une API momentanement injoignable ne
// doit jamais empecher un deploiement.
const fetchJson = (url) =>
  new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`[prerender] ${url} a repondu ${res.statusCode} — contenu distant ignore.`);
        res.resume();
        return resolve(null);
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          console.warn(`[prerender] reponse illisible depuis ${url} : ${err.message}`);
          resolve(null);
        }
      });
    });
    req.on('timeout', () => { req.destroy(); console.warn(`[prerender] delai depasse sur ${url}`); resolve(null); });
    req.on('error', (err) => { console.warn(`[prerender] ${url} injoignable : ${err.message}`); resolve(null); });
  });

// --- Utilitaires -----------------------------------------------------------

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const p = (text) => `<p>${escapeHtml(text)}</p>`;
const li = (text) => `<li>${escapeHtml(text)}</li>`;

// Conversion du markdown simplifie des guides en HTML statique. Doit rester
// alignee sur src/components/RichText.jsx (meme syntaxe supportee) pour que les
// robots et les visiteurs voient le meme contenu.
const inline = (text) =>
  escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const markdownToHtml = (body) => {
  if (!body) return '';
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const isBlockStart = (line) => /^(#{2,3} |[-*] |\d+\.\s|\||> )/.test(line.trim());

  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i += 1; continue; }

    if (t.startsWith('### ')) { out.push(`<h3>${inline(t.slice(4))}</h3>`); i += 1; continue; }
    if (t.startsWith('## ')) { out.push(`<h2>${inline(t.slice(3))}</h2>`); i += 1; continue; }

    if (t.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const [head, ...rest] = rows;
        out.push(
          '<table><thead><tr>' +
          head.map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rest.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>'
        );
      }
      continue;
    }

    if (t.startsWith('> ')) {
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) { q.push(lines[i].trim().slice(2)); i += 1; }
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`);
      continue;
    }

    if (/^[-*] /.test(t)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) { items.push(lines[i].trim().slice(2)); i += 1; }
      out.push('<ul>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>');
      continue;
    }

    if (/^\d+\.\s/.test(t)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i += 1;
      }
      out.push('<ol>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ol>');
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { para.push(lines[i].trim()); i += 1; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
};

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

const staticRoutes = [
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

// Construit les routes des guides publies depuis l'admin, plus leur index.
const buildRemoteRoutes = (guides, remoteFaq) => {
  const routes = [];

  if (guides.length) {
    const byCluster = {};
    guides.forEach((g) => {
      const key = g.cluster || 'Guides';
      if (!byCluster[key]) byCluster[key] = [];
      byCluster[key].push(g);
    });

    routes.push({
      path: '/guides',
      title: "Guides : importer de Chine vers l'Afrique | SilkRoute",
      description:
        "Fret aérien et maritime, foire de Canton, vérification des fournisseurs, dédouanement, marges : nos guides pratiques avec des chiffres réels.",
      body: `
<h1>Guides pratiques</h1>
${p("Tarifs de fret réels, démarches, calculs de marge : ce qu'il faut savoir pour importer depuis la Chine.")}
${Object.entries(byCluster).map(([cluster, items]) => `
<section>
  <h2>${escapeHtml(cluster)}</h2>
  <ul>
    ${items.map((g) => `<li><a href="/guides/${escapeHtml(g.slug)}">${escapeHtml(g.title)}</a>${g.meta_description ? ` — ${escapeHtml(g.meta_description)}` : ''}</li>`).join('\n    ')}
  </ul>
</section>`).join('\n')}`
    });
  }

  guides.forEach((g) => {
    routes.push({
      path: `/guides/${g.slug}`,
      title: `${g.title} | SilkRoute`,
      description: g.meta_description || '',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: g.title,
        description: g.meta_description || '',
        inLanguage: 'fr',
        datePublished: g.created_at,
        dateModified: g.updated_at || g.created_at,
        author: { '@type': 'Organization', name: 'SilkRoute' },
        publisher: { '@type': 'Organization', name: 'SilkRoute' },
        mainEntityOfPage: `${SITE_URL}/guides/${g.slug}`
      },
      body: `
<article>
  ${g.cluster ? `<p>${escapeHtml(g.cluster)}</p>` : ''}
  <h1>${escapeHtml(g.title)}</h1>
  ${g.meta_description ? p(g.meta_description) : ''}
  ${markdownToHtml(g.body)}
</article>
<p><a href="/groupages">Voir les groupages ouverts</a> — <a href="/faq">FAQ</a></p>`
    });
  });

  // Les questions ajoutees depuis l'admin enrichissent la page /faq deja prerendue.
  if (remoteFaq.length) {
    const faqRoute = staticRoutes.find((r) => r.path === '/faq');
    if (faqRoute) {
      const extra = remoteFaq.map((e) => ({
        q: e.question || e.title,
        a: e.answer || ''
      }));
      faqRoute.body += '\n' + extra
        .map((it) => `<section><h2>${escapeHtml(it.q)}</h2>${p(it.a)}</section>`)
        .join('\n');
      faqRoute.jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.concat(extra).map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a }
        }))
      };
    }
  }

  return routes;
};

const writeRoute = (route) => {
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
  console.log(`[prerender] ${route.path.padEnd(34)} ${String(words).padStart(5)} mots`);
};

const writeSitemap = (routes) => {
  // Les pages de connexion et d'inscription n'ont pas d'interet dans un sitemap :
  // elles ne repondent a aucune requete de recherche.
  const EXCLUDED = ['/login', '/register'];

  const priority = (p) => {
    if (p === '/') return '1.0';
    if (p === '/faq' || p === '/groupages') return '0.9';
    if (p.startsWith('/guides')) return '0.8';
    if (p === '/terms' || p === '/privacy') return '0.3';
    return '0.5';
  };
  const freq = (p) => {
    if (p === '/groupages') return 'daily';
    if (p === '/') return 'weekly';
    if (p === '/terms' || p === '/privacy') return 'yearly';
    return 'monthly';
  };

  const paths = [];
  routes.forEach((r) => {
    if (!EXCLUDED.includes(r.path) && paths.indexOf(r.path) === -1) paths.push(r.path);
  });

  const urls = paths.map((p) => `  <url>
    <loc>${SITE_URL}${p}</loc>
    <changefreq>${freq(p)}</changefreq>
    <priority>${priority(p)}</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  fs.writeFileSync(path.join(BUILD_DIR, 'sitemap.xml'), xml, 'utf8');
  console.log(`[prerender] sitemap.xml regenere (${paths.length} URLs)`);
};

const main = async () => {
  console.log(`[prerender] contenu distant depuis ${API_URL}`);
  const [guidesRaw, faqRaw] = await Promise.all([
    fetchJson(`${API_URL}/api/content?type=guide`),
    fetchJson(`${API_URL}/api/content?type=faq`)
  ]);

  const guides = Array.isArray(guidesRaw) ? guidesRaw.filter((g) => g.slug && g.body) : [];
  const remoteFaq = Array.isArray(faqRaw) ? faqRaw.filter((f) => f.question && f.answer) : [];
  console.log(`[prerender] ${guides.length} guide(s) et ${remoteFaq.length} question(s) recuperes`);

  const remoteRoutes = buildRemoteRoutes(guides, remoteFaq);
  const allRoutes = staticRoutes.concat(remoteRoutes);

  let count = 0;
  let failures = 0;
  const written = [];

  allRoutes.forEach((route) => {
    // Une erreur sur une route est signalee mais n'interrompt pas les autres :
    // le build reste exploitable (la route concernee est servie en SPA).
    try {
      writeRoute(route);
      written.push(route);
      count += 1;
    } catch (err) {
      failures += 1;
      console.error(`[prerender] ECHEC sur ${route.path} : ${err.message}`);
    }
  });

  if (count === 0) {
    console.error('[prerender] Aucune page generee — build interrompu.');
    process.exit(1);
  }

  writeSitemap(written);
  console.log(`[prerender] ${count}/${allRoutes.length} pages prerendues${failures ? ` (${failures} echec(s))` : ''}.`);
};

main().catch((err) => {
  console.error(`[prerender] erreur inattendue : ${err.message}`);
  process.exit(1);
});
