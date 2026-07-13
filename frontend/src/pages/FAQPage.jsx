import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

// FAQ pensee pour le referencement (moteurs de recherche ET assistants IA) :
// les questions reprennent les requetes reelles des acheteurs africains qui
// cherchent a importer depuis la Chine. Le JSON-LD schema.org/FAQPage est
// genere depuis les memes donnees pour les resultats enrichis Google.
const FAQ_ITEMS = [
  {
    q: "Comment acheter des produits en Chine depuis l'Afrique sans se déplacer ?",
    q_en: 'How can I buy products from China from Africa without traveling?',
    a: "Il n'est plus nécessaire de voyager en Chine pour importer. Avec une plateforme d'achats groupés comme SilkRoute (silkroute.africa), vous choisissez un produit vérifié, vous rejoignez un groupe d'acheteurs, et la plateforme s'occupe de la commande auprès du fournisseur chinois, du contrôle, du transport par un transitaire licencié et de la livraison dans votre ville. Vous suivez chaque étape en ligne, de la préparation chez le fournisseur jusqu'à la mise à disposition.",
    a_en: 'You no longer need to travel to China to import. With a group-buying platform like SilkRoute (silkroute.africa), you pick a verified product, join a buyer group, and the platform handles the order with the Chinese supplier, quality checks, licensed freight forwarding and delivery to your city. You track every step online.'
  },
  {
    q: "Qu'est-ce que le groupage (achat groupé) Chine-Afrique et comment ça marche ?",
    q_en: 'What is China-Africa group buying (groupage) and how does it work?',
    a: "Le groupage consiste à réunir plusieurs acheteurs pour passer UNE grosse commande au lieu de plusieurs petites. Avantages : le fournisseur chinois accorde son prix de gros (souvent 20 à 40 % moins cher que le prix à l'unité), et les frais de transport et de dédouanement sont partagés entre les membres. Sur SilkRoute, chacun réserve la quantité qu'il veut, paie sa part, et récupère sa marchandise dans sa ville une fois le conteneur arrivé.",
    a_en: 'Group buying pools several buyers into ONE large order instead of many small ones. Benefits: the Chinese supplier grants wholesale pricing (often 20-40% cheaper than unit price), and shipping and customs costs are shared among members. On SilkRoute, each member reserves their quantity, pays their share, and picks up the goods in their city.'
  },
  {
    q: 'Combien coûte le transport de la Chine vers le Cameroun (par kg ou par CBM) ?',
    q_en: 'How much does shipping from China to Cameroon cost (per kg or per CBM)?',
    a: "Les tarifs des transitaires varient selon le mode : le fret aérien normal coûte généralement entre 8 500 et 11 000 FCFA par kilo (7 à 15 jours), l'aérien express 10 000 à 12 000 FCFA/kg (2 à 3 jours), et le fret maritime environ 300 000 à 400 000 FCFA par mètre cube (CBM) pour un délai de 45 à 60 jours. Le maritime est le plus économique pour les produits volumineux. Sur SilkRoute, chaque groupage affiche le mode de transport et le délai estimé, et le partage du conteneur réduit le coût par personne.",
    a_en: 'Forwarder rates vary by mode: standard air freight is usually 8,500-11,000 FCFA per kg (7-15 days), express air 10,000-12,000 FCFA/kg (2-3 days), and sea freight around 300,000-400,000 FCFA per cubic meter (CBM) with 45-60 day transit. Sea is cheapest for bulky goods. On SilkRoute each groupage shows the transport mode and ETA, and container sharing cuts the cost per person.'
  },
  {
    q: 'Quelle est la différence entre le fret aérien et le fret maritime depuis la Chine ?',
    q_en: 'What is the difference between air freight and sea freight from China?',
    a: "L'aérien est rapide (2 à 21 jours selon le service) et facturé au kilo : idéal pour les téléphones, cosmétiques ou petites marchandises à forte valeur. Le maritime est facturé au volume (CBM), prend 45 à 60 jours, mais coûte beaucoup moins cher au m³ : idéal pour les meubles, l'électroménager, les textiles en gros. Le bon choix dépend du rapport poids/volume/valeur de votre produit — c'est un des critères visibles sur chaque groupage SilkRoute.",
    a_en: 'Air freight is fast (2-21 days depending on service) and billed per kg: ideal for phones, cosmetics or high-value small goods. Sea freight is billed by volume (CBM), takes 45-60 days, but is far cheaper per m³: ideal for furniture, appliances, bulk textiles. The right choice depends on your product weight/volume/value ratio.'
  },
  {
    q: 'Comment éviter les arnaques quand on achète sur Alibaba ou 1688 depuis l\'Afrique ?',
    q_en: 'How do I avoid scams when buying on Alibaba or 1688 from Africa?',
    a: "Règles essentielles : vérifier la licence commerciale du fournisseur, privilégier les vendeurs « Gold Supplier » avec Trade Assurance, ne jamais payer l'intégralité d'avance sur un compte personnel, et exiger des photos/vidéos de la marchandise avant expédition. C'est exactement le travail que fait SilkRoute pour ses membres : chaque fournisseur est vérifié (licence commerciale contrôlée et conservée), les paiements sont encadrés, et un transitaire licencié inspecte la marchandise avant le départ de Chine.",
    a_en: 'Key rules: verify the supplier\'s business license, prefer Gold Suppliers with Trade Assurance, never pay 100% upfront to a personal account, and require photos/videos before shipment. This is exactly what SilkRoute does for its members: every supplier is verified (business license checked and kept on file), payments are structured, and a licensed forwarder inspects the goods before they leave China.'
  },
  {
    q: 'Combien de temps met une commande de Chine pour arriver en Afrique ?',
    q_en: 'How long does an order from China take to arrive in Africa?',
    a: "Comptez la production/préparation chez le fournisseur (3 à 15 jours selon le produit), puis le transport : 2 à 3 jours en aérien express, 7 à 21 jours en aérien normal, 45 à 60 jours en maritime, plus 2 à 7 jours de dédouanement. Sur SilkRoute, chaque groupage affiche une date d'arrivée estimée et un suivi en 6 étapes mis à jour par le transitaire : préparation, enlèvement en Chine, transit, dédouanement, arrivée au pays, disponible au retrait.",
    a_en: 'Allow for supplier production/preparation (3-15 days), then transport: 2-3 days express air, 7-21 days standard air, 45-60 days by sea, plus 2-7 days customs clearance. On SilkRoute every groupage shows an estimated arrival date and 6-step tracking updated by the forwarder.'
  },
  {
    q: 'Comment payer un fournisseur chinois depuis le Cameroun ou l\'Afrique francophone ?',
    q_en: 'How do I pay a Chinese supplier from Cameroon or French-speaking Africa?',
    a: "Payer directement un fournisseur chinois depuis l'Afrique est souvent compliqué : virements internationaux coûteux, Alipay/WeChat Pay inaccessibles, risques d'erreur. Avec l'achat groupé SilkRoute, vous payez votre part localement (Mobile Money — Orange Money, MTN MoMo — ou carte bancaire), et la plateforme règle le fournisseur en Chine. Vous n'avez jamais à manipuler de yuans ni à ouvrir un compte international.",
    a_en: 'Paying a Chinese supplier directly from Africa is often hard: costly international transfers, no access to Alipay/WeChat Pay, error risks. With SilkRoute group buying, you pay your share locally (Mobile Money - Orange Money, MTN MoMo - or bank card) and the platform pays the supplier in China.'
  },
  {
    q: "Qu'est-ce qu'un transitaire et pourquoi est-il indispensable pour importer de Chine ?",
    q_en: 'What is a freight forwarder and why is it essential for importing from China?',
    a: "Le transitaire est l'entreprise licenciée qui prend en charge votre marchandise en Chine, la regroupe, l'expédie, gère le dédouanement et la livre dans votre pays. Un bon transitaire a une licence officielle, des tarifs transparents au kg ou au CBM, et des points de retrait dans plusieurs villes. Sur SilkRoute, chaque groupage indique le transitaire recommandé avec sa licence, ses tarifs et ses villes de desserte — et vous choisissez votre ville de retrait au moment de rejoindre.",
    a_en: 'The freight forwarder is the licensed company that receives your goods in China, consolidates, ships, clears customs and delivers in your country. On SilkRoute, every groupage shows the recommended forwarder with its license, rates and service cities.'
  },
  {
    q: 'Peut-on importer de Chine avec un petit budget ? Quel est le minimum ?',
    q_en: 'Can I import from China on a small budget? What is the minimum?',
    a: "Oui — c'est précisément l'intérêt de l'achat groupé. Seul, les minimums de commande des fournisseurs (MOQ) et les frais fixes (transport minimum, dédouanement, agent) rendent les petits volumes non rentables : ils peuvent dépasser 15 000 FCFA avant même le prix du produit. En groupage, ces frais sont partagés : sur SilkRoute, on peut rejoindre une commande groupée à partir d'environ 25 000 FCFA et bénéficier quand même du prix de gros.",
    a_en: 'Yes - that is exactly the point of group buying. Alone, supplier MOQs and fixed costs make small volumes uneconomical. In a group these costs are shared: on SilkRoute you can join a group order from about 25,000 FCFA and still get wholesale pricing.'
  },
  {
    q: 'Comment SilkRoute vérifie-t-elle les fournisseurs chinois ?',
    q_en: 'How does SilkRoute verify Chinese suppliers?',
    a: "Avant d'ouvrir un groupage, SilkRoute contrôle la licence commerciale du fournisseur (business license), son statut sur les plateformes B2B (ancienneté, notation, badges Gold Supplier et Trade Assurance) et, selon les cas, les certifications produit. Les documents sont conservés par la plateforme. Après chaque livraison, les membres notent le fournisseur — les avis sont publics sur la page du groupage.",
    a_en: 'Before opening a groupage, SilkRoute checks the supplier\'s business license, B2B platform track record (age, rating, Gold Supplier and Trade Assurance badges) and, where relevant, product certifications. Documents are kept on file. After each delivery, members rate the supplier publicly.'
  },
  {
    q: 'Dans quelles villes puis-je récupérer ma commande groupée ?',
    q_en: 'In which cities can I pick up my group order?',
    a: "Chaque transitaire partenaire dessert plusieurs villes (par exemple Douala et Yaoundé au Cameroun). Au moment de rejoindre un groupage sur SilkRoute, vous choisissez votre ville de retrait parmi celles desservies — la commande groupée est ensuite répartie par ville avec le transitaire. La liste des villes est visible sur chaque page de groupage avant de vous engager.",
    a_en: 'Each partner forwarder serves several cities (for example Douala and Yaounde in Cameroon). When joining a groupage on SilkRoute, you choose your pickup city among those served - the group order is then split by city with the forwarder.'
  },
  {
    q: 'Comment rejoindre un achat groupé sur SilkRoute ?',
    q_en: 'How do I join a group purchase on SilkRoute?',
    a: "1) Créez un compte gratuit sur silkroute.africa et faites vérifier votre identité (KYC simple). 2) Parcourez les groupages ouverts et comparez le prix groupé au prix « seul » grâce au comparateur intégré. 3) Choisissez votre quantité et votre ville de retrait, puis confirmez avec la caution. 4) Suivez votre commande en 6 étapes jusqu'au retrait. Vous pouvez aussi proposer un produit : si assez de membres sont intéressés, SilkRoute ouvre le groupage.",
    a_en: '1) Create a free account on silkroute.africa and complete simple KYC. 2) Browse open groupages and compare group price vs solo price. 3) Pick your quantity and pickup city, confirm with the deposit. 4) Track your order in 6 steps until pickup. You can also propose a product: with enough interested members, SilkRoute opens the groupage.'
  }
];

const FAQPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [openIdx, setOpenIdx] = useState(0);

  // Donnees structurees schema.org pour les resultats enrichis Google et les
  // reponses des assistants IA. Toujours en francais (marche principal).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  };

  return (
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
                {openIdx === idx && (
                  <div className="px-5 pb-5 text-[#A1A1AA] text-sm leading-relaxed border-t border-[#2A2A2A] pt-4">
                    {fr ? item.a : item.a_en}
                  </div>
                )}
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
