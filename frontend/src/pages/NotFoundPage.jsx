import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Compass } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';

// Page 404. Marquee noindex : une URL inexistante ne doit jamais etre indexee.
const NotFoundPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';

  useSeo({
    title: fr ? 'Page introuvable | SilkRoute' : 'Page not found | SilkRoute',
    path: '/404',
    noindex: true
  });

  return (
    <Layout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md">
          <Compass className="w-14 h-14 text-[#D4AF37] mx-auto mb-5" />
          <h1 className="font-['Bebas_Neue'] text-5xl mb-3">404</h1>
          <p className="text-[#A1A1AA] mb-8">
            {fr
              ? "Cette page n'existe pas ou a été déplacée."
              : 'This page does not exist or has been moved.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/groupages" className="btn-gold px-6 py-3 rounded-md font-semibold">
              {fr ? 'Voir les groupages' : 'Browse groupages'}
            </Link>
            <Link to="/faq" className="btn-outline px-6 py-3 rounded-md">
              FAQ
            </Link>
            <Link to="/" className="btn-outline px-6 py-3 rounded-md">
              {fr ? 'Accueil' : 'Home'}
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFoundPage;
