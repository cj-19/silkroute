import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import RichText from '@/components/RichText';
import { Loader2, ArrowLeft, Compass } from 'lucide-react';
import { useSeo, useJsonLd } from '@/hooks/useSeo';
import { api } from '@/lib/api';

// Page d'un guide edite depuis l'espace admin : /guides/<slug>
const GuidePage = () => {
  const { slug } = useParams();
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    api.get(`/content/${slug}`)
      .then((res) => { if (active) setEntry(res.data); })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useSeo({
    title: entry ? `${entry.title} | SilkRoute` : 'Guide | SilkRoute',
    description: entry?.meta_description || undefined,
    path: `/guides/${slug}`,
    noindex: notFound,
    lang: fr ? 'fr' : 'en'
  });

  useJsonLd(
    entry
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: entry.title,
          description: entry.meta_description || '',
          inLanguage: 'fr',
          datePublished: entry.created_at,
          dateModified: entry.updated_at || entry.created_at,
          author: { '@type': 'Organization', name: 'SilkRoute' },
          publisher: { '@type': 'Organization', name: 'SilkRoute' },
          mainEntityOfPage: `https://www.silkroute.africa/guides/${slug}`
        }
      : null,
    'guide-jsonld'
  );

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        </div>
      </Layout>
    );
  }

  if (notFound || !entry) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <Compass className="w-12 h-12 text-[#D4AF37] mx-auto mb-5" />
            <h1 className="font-['Bebas_Neue'] text-3xl mb-3">
              {fr ? 'Guide introuvable' : 'Guide not found'}
            </h1>
            <p className="text-[#A1A1AA] mb-8">
              {fr
                ? "Ce guide n'existe pas ou n'est pas encore publié."
                : 'This guide does not exist or is not published yet.'}
            </p>
            <Link to="/guides" className="btn-gold px-6 py-3 rounded-md inline-block">
              {fr ? 'Voir tous les guides' : 'All guides'}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-20" data-testid="guide-page">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/guides" className="text-sm text-[#71717A] hover:text-[#D4AF37] inline-flex items-center gap-1.5 mb-6 py-2">
            <ArrowLeft className="w-4 h-4" />
            {fr ? 'Tous les guides' : 'All guides'}
          </Link>

          {entry.cluster && (
            <p className="text-xs text-[#D4AF37] uppercase tracking-wider mb-3">{entry.cluster}</p>
          )}

          <h1 className="font-['Bebas_Neue'] text-4xl sm:text-5xl leading-tight mb-4">
            {entry.title}
          </h1>

          {entry.meta_description && (
            <p className="text-lg text-[#A1A1AA] leading-relaxed mb-2">{entry.meta_description}</p>
          )}

          {entry.updated_at && (
            <p className="text-xs text-[#71717A] mb-8 pb-8 border-b border-[#2A2A2A]">
              {fr ? 'Mis à jour le ' : 'Updated '}
              {new Date(entry.updated_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          )}

          <RichText body={entry.body} />

          <div className="mt-14 bg-[#141414] border border-[#2A2A2A] rounded-lg p-7 text-center">
            <h2 className="font-['Bebas_Neue'] text-2xl mb-2">
              {fr ? 'Envie de le faire sans les risques ?' : 'Want to do it without the risk?'}
            </h2>
            <p className="text-[#A1A1AA] text-sm mb-6 max-w-lg mx-auto">
              {fr
                ? "Rejoignez une commande groupée : fournisseur vérifié, transitaire licencié, paiement en Mobile Money et retrait dans votre ville."
                : 'Join a group order: verified supplier, licensed forwarder, Mobile Money payment and pickup in your city.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/groupages" className="btn-gold px-6 py-3 rounded-md font-semibold">
                {fr ? 'Voir les groupages ouverts' : 'See open groupages'}
              </Link>
              <Link to="/faq" className="btn-outline px-6 py-3 rounded-md">
                FAQ
              </Link>
            </div>
          </div>
        </article>
      </div>
    </Layout>
  );
};

export default GuidePage;
