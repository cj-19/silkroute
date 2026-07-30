import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Loader2, BookOpen, ArrowRight } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { api } from '@/lib/api';

// Index des guides publies, regroupes par grappe thematique.
const GuidesIndexPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: fr
      ? "Guides : importer de Chine vers l'Afrique | SilkRoute"
      : 'Guides: importing from China to Africa | SilkRoute',
    description: fr
      ? "Fret aérien et maritime, foire de Canton, vérification des fournisseurs, dédouanement, marges : nos guides pratiques avec des chiffres réels."
      : 'Air and sea freight, Canton Fair, supplier verification, customs, margins: practical guides with real numbers.',
    path: '/guides',
    lang: fr ? 'fr' : 'en'
  });

  useEffect(() => {
    api.get('/content?type=guide')
      .then((res) => setGuides(res.data))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  // Regroupement par grappe, en conservant l'ordre d'apparition
  const byCluster = guides.reduce((acc, g) => {
    const key = g.cluster || (fr ? 'Guides' : 'Guides');
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16" data-testid="guides-index">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <h1 className="font-['Bebas_Neue'] text-5xl mb-3">
              {fr ? 'Guides pratiques' : 'Practical guides'}
            </h1>
            <p className="text-[#A1A1AA] max-w-xl mx-auto">
              {fr
                ? "Tarifs de fret réels, démarches, calculs de marge : ce qu'il faut savoir pour importer depuis la Chine, sans langue de bois."
                : 'Real freight rates, procedures, margin calculations: what you need to know to import from China.'}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" />
            </div>
          ) : guides.length === 0 ? (
            <div className="text-center py-16 bg-[#141414] border border-[#2A2A2A] rounded-lg">
              <p className="text-[#A1A1AA]">
                {fr ? 'Les premiers guides arrivent très bientôt.' : 'First guides coming soon.'}
              </p>
              <Link to="/faq" className="btn-outline px-5 py-2.5 rounded-md inline-block mt-5">
                {fr ? 'Consulter la FAQ' : 'Read the FAQ'}
              </Link>
            </div>
          ) : (
            <div className="space-y-9">
              {Object.entries(byCluster).map(([cluster, items]) => (
                <section key={cluster}>
                  <h2 className="text-xs text-[#D4AF37] uppercase tracking-wider mb-3 pb-2 border-b border-[#2A2A2A]">
                    {cluster}
                  </h2>
                  <div className="space-y-2">
                    {items.map((g) => (
                      <Link
                        key={g.slug}
                        to={`/guides/${g.slug}`}
                        className="block bg-[#141414] border border-[#2A2A2A] rounded-lg p-5 hover:border-[#D4AF37] transition-colors group"
                        data-testid={`guide-link-${g.slug}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium mb-1.5 normal-case"
                                style={{ fontFamily: 'DM Sans, sans-serif', textTransform: 'none', letterSpacing: 'normal' }}>
                              {g.title}
                            </h3>
                            {g.meta_description && (
                              <p className="text-sm text-[#A1A1AA] leading-relaxed">{g.meta_description}</p>
                            )}
                          </div>
                          <ArrowRight className="w-5 h-5 text-[#71717A] group-hover:text-[#D4AF37] shrink-0 mt-1" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default GuidesIndexPage;
