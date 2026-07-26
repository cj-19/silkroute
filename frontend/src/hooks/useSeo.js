import { useEffect } from 'react';

const SITE_URL = 'https://www.silkroute.africa';
const SITE_NAME = 'SilkRoute';

// Cree ou met a jour une balise <meta> / <link> dans le <head>.
const upsert = (selector, create, attrs) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

/**
 * Definit le titre, la description, l'URL canonique et les balises Open Graph
 * de la page courante. Indispensable sur une SPA : sans cela, toutes les routes
 * partagent le titre et la canonique de index.html, ce qui empeche Google
 * d'indexer les pages autres que l'accueil.
 *
 * @param {object} opts
 * @param {string} opts.title       Titre complet de l'onglet et du resultat Google
 * @param {string} opts.description Meta description (~155 caracteres)
 * @param {string} opts.path        Chemin de la page, ex: '/faq'
 * @param {boolean} opts.noindex    true pour les pages privees (dashboard, admin...)
 * @param {string} opts.lang        Code langue du contenu ('fr' par defaut)
 */
export const useSeo = ({ title, description, path = '/', noindex = false, lang = 'fr' }) => {
  useEffect(() => {
    const url = `${SITE_URL}${path === '/' ? '/' : path}`;

    if (title) document.title = title;
    document.documentElement.lang = lang;

    if (description) {
      upsert('meta[name="description"]', () => document.createElement('meta'), {
        name: 'description',
        content: description
      });
    }

    upsert('link[rel="canonical"]', () => document.createElement('link'), {
      rel: 'canonical',
      href: url
    });

    // Open Graph : previsualisation lors des partages WhatsApp / Facebook
    const og = {
      'og:title': title || SITE_NAME,
      'og:description': description || '',
      'og:url': url,
      'og:site_name': SITE_NAME,
      'og:type': 'website'
    };
    Object.entries(og).forEach(([property, content]) => {
      if (!content) return;
      upsert(`meta[property="${property}"]`, () => document.createElement('meta'), {
        property,
        content
      });
    });

    // Les pages privees ne doivent jamais apparaitre dans les resultats
    const robotsEl = document.head.querySelector('meta[name="robots"]');
    if (noindex) {
      upsert('meta[name="robots"]', () => document.createElement('meta'), {
        name: 'robots',
        content: 'noindex, nofollow'
      });
    } else if (robotsEl) {
      robotsEl.remove();
    }
  }, [title, description, path, noindex, lang]);
};

/**
 * Injecte un bloc de donnees structurees schema.org (JSON-LD) et le retire au
 * demontage de la page, pour eviter que le balisage d'une page ne fuite sur une autre.
 */
export const useJsonLd = (data, id = 'page-jsonld') => {
  // On depend du CONTENU serialise et non de l'identite de l'objet : un objet
  // litteral passe en argument est recree a chaque rendu, ce qui reexecuterait
  // l'effet (et donc supprimerait/recreerait la balise) en boucle.
  const serialized = data ? JSON.stringify(data) : null;

  useEffect(() => {
    if (!serialized) return undefined;
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = serialized;
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [serialized, id]);
};

export default useSeo;
