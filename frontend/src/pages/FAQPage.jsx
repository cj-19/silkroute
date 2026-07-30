import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useSeo, useJsonLd } from '@/hooks/useSeo';
import { api } from '@/lib/api';

// Questions de base : src/data/faq.json est la source unique partagee entre cette
// page React et le script de prerendu (scripts/prerender.js), afin que les robots
// recoivent exactement le meme contenu que les visiteurs.
import BASE_FAQ from '@/data/faq.json';

const FAQPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [openIdx, setOpenIdx] = useState(0);

  // Questions ajoutees depuis l'espace admin, concatenees aux questions de base.
  const [extraFaq, setExtraFaq] = useState([]);
  useEffect(() => {
    api.get('/content?type=faq')
      .then((res) => setExtraFaq(
        res.data.map((e) => ({
          q: e.question || e.title,
          q_en: e.question || e.title,
          a: e.answer || '',
          a_en: e.answer || ''
        }))
      ))
      .catch(() => setExtraFaq([]));
  }, []);

  const FAQ_ITEMS = useMemo(() => [...BASE_FAQ, ...extraFaq], [extraFaq]);

  useSeo({
    title: fr
      ? 'Importer de Chine vers l\'Afrique : questions fréquentes | SilkRoute'
      : 'Importing from China to Africa: FAQ | SilkRoute',
    description: fr
      ? "Prix du fret Chine-Cameroun au kg ou au CBM, délais, éviter les arnaques Alibaba, payer un fournisseur chinois depuis l'Afrique : nos réponses."
      : 'China-Cameroon freight prices per kg or CBM, lead times, avoiding Alibaba scams, paying Chinese suppliers from Africa: our answers.',
    path: '/faq',
    lang: fr ? 'fr' : 'en'
  });

  // Donnees structurees schema.org pour les resultats enrichis Google et les
  // reponses des assistants IA. Toujours en francais (marche principal).
  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  }), [FAQ_ITEMS]);
  useJsonLd(jsonLd, 'faq-jsonld');

  return (
    <Layout>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16" data-testid="faq-page">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <h1 className="font-['Bebas_Neue'] text-5xl mb-3">
              {fr ? 'Questions fréquentes' : 'Frequently asked questions'}
            </h1>
            <p className="text-[#A1A1AA]">
              {fr
                ? "Tout ce qu'il faut savoir pour importer de Chine vers l'Afrique en achat groupé."
                : 'Everything you need to know about importing from China to Africa with group buying.'}
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenIdx(openIdx === idx ? -1 : idx)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#1A1A1A] transition-colors"
                  data-testid={`faq-question-${idx}`}
                >
                  <h2 className="font-medium text-base normal-case font-sans" style={{ fontFamily: 'DM Sans, sans-serif', textTransform: 'none', letterSpacing: 'normal' }}>
                    {fr ? item.q : item.q_en}
                  </h2>
                  {openIdx === idx
                    ? <ChevronUp className="w-5 h-5 text-[#D4AF37] shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-[#71717A] shrink-0" />}
                </button>
                {/* La reponse est TOUJOURS presente dans le DOM (repliee via CSS
                    et non par rendu conditionnel) : sinon les moteurs de recherche
                    ne voient que la reponse ouverte et ignorent les 11 autres. */}
                <div
                  className={`px-5 text-[#A1A1AA] text-sm leading-relaxed border-t border-[#2A2A2A] ${
                    openIdx === idx ? 'pb-5 pt-4' : 'sr-only'
                  }`}
                  aria-hidden={openIdx !== idx}
                >
                  {fr ? item.a : item.a_en}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 bg-[#141414] border border-[#2A2A2A] rounded-lg p-8">
            <h2 className="font-['Bebas_Neue'] text-2xl mb-2">
              {fr ? 'Prêt à importer malin ?' : 'Ready to import smart?'}
            </h2>
            <p className="text-[#A1A1AA] text-sm mb-6">
              {fr
                ? 'Rejoignez un groupage ouvert ou proposez votre produit.'
                : 'Join an open groupage or propose your own product.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/groupages" className="btn-gold px-6 py-3 rounded-md font-semibold">
                {fr ? 'Voir les groupages' : 'Browse groupages'}
              </Link>
              <Link to="/register" className="btn-outline px-6 py-3 rounded-md">
                {fr ? 'Créer un compte gratuit' : 'Create a free account'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FAQPage;
