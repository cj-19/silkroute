import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Mail, Phone, MessageCircle, MapPin } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';

// Coordonnees publiques de contact - a ajuster si elles changent.
const CONTACT_EMAIL = 'contact@silkroute.africa';

const Page = ({ title, description, path, children }) => {
  useSeo({ title: `${title} | SilkRoute`, description, path });
  return (
    <Layout>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-['Bebas_Neue'] text-4xl mb-8">{title}</h1>
          <div className="space-y-6 text-[#A1A1AA] text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </Layout>
  );
};

const Section = ({ heading, children }) => (
  <section>
    <h2 className="text-white font-medium mb-2 normal-case" style={{ fontFamily: 'DM Sans, sans-serif', textTransform: 'none', letterSpacing: 'normal' }}>
      {heading}
    </h2>
    <div className="space-y-2">{children}</div>
  </section>
);

// ============ Conditions générales d'utilisation ============
export const TermsPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';

  return (
    <Page
      title={fr ? "Conditions générales d'utilisation" : 'Terms of Service'}
      description="Conditions générales d'utilisation de la plateforme d'achats groupés SilkRoute : rôle de la plateforme, commandes groupées, paiements, livraison et responsabilités."
      path="/terms"
    >
      <p className="text-[#71717A]">
        {fr ? 'Dernière mise à jour : juillet 2026' : 'Last updated: July 2026'}
      </p>

      <Section heading={fr ? '1. Objet et rôle de SilkRoute' : '1. Purpose and role of SilkRoute'}>
        <p>
          {fr
            ? "SilkRoute est une plateforme de mise en relation qui permet à plusieurs acheteurs de regrouper leurs commandes auprès de fournisseurs situés en Chine, et d'organiser leur acheminement via des transitaires partenaires. SilkRoute intervient comme intermédiaire organisateur : elle sélectionne et vérifie les fournisseurs, agrège les commandes, coordonne le transport et informe les membres du suivi."
            : 'SilkRoute is a platform enabling several buyers to pool their orders with suppliers located in China and to organise shipping through partner freight forwarders.'}
        </p>
      </Section>

      <Section heading={fr ? '2. Inscription et vérification d\'identité' : '2. Registration and identity verification'}>
        <p>
          {fr
            ? "L'accès aux commandes groupées nécessite la création d'un compte et la vérification de votre identité (KYC). Vous vous engagez à fournir des informations exactes et des documents authentiques. SilkRoute se réserve le droit de refuser ou suspendre un compte en cas d'informations inexactes ou frauduleuses."
            : 'Access to group orders requires an account and identity verification (KYC). You undertake to provide accurate information and authentic documents.'}
        </p>
      </Section>

      <Section heading={fr ? '3. Commandes groupées et engagement' : '3. Group orders and commitment'}>
        <p>
          {fr
            ? "En rejoignant un groupage, vous réservez une quantité déterminée et vous engagez à en régler le montant. Le prix affiché comprend votre part de la commande, du transport et des frais de service. Une caution est demandée à l'adhésion ; le solde est réglé selon les modalités indiquées sur la page du groupage."
            : 'By joining a groupage you reserve a set quantity and commit to paying for it. The displayed price includes your share of the order, shipping and service fees.'}
        </p>
        <p>
          {fr
            ? "Le choix de la ville de retrait est définitif : il détermine la répartition de la commande convenue avec le transitaire et ne peut être modifié après l'adhésion."
            : 'The pickup city choice is final: it determines how the order is split with the forwarder and cannot be changed after joining.'}
        </p>
      </Section>

      <Section heading={fr ? '4. Prix, délais et aléas' : '4. Prices, lead times and contingencies'}>
        <p>
          {fr
            ? "Les prix sont exprimés en francs CFA et calculés à partir des tarifs fournisseurs et transitaires en vigueur. Les délais annoncés sont estimatifs : ils dépendent de la production, du transport international et des opérations de dédouanement, qui peuvent subir des retards indépendants de la volonté de SilkRoute."
            : 'Prices are in CFA francs. Announced lead times are estimates and depend on production, international shipping and customs clearance.'}
        </p>
      </Section>

      <Section heading={fr ? '5. Livraison et retrait' : '5. Delivery and pickup'}>
        <p>
          {fr
            ? "La marchandise est mise à disposition dans la ville de retrait choisie. Il vous appartient de venir la récupérer dans les délais communiqués. Les frais de gardiennage éventuels au-delà de ce délai restent à votre charge."
            : 'Goods are made available in the chosen pickup city. You are responsible for collecting them within the communicated timeframe.'}
        </p>
      </Section>

      <Section heading={fr ? '6. Responsabilités' : '6. Liabilities'}>
        <p>
          {fr
            ? "SilkRoute vérifie les documents des fournisseurs et sélectionne des transitaires licenciés, mais n'est pas le fabricant des produits. En cas de non-conformité constatée à la réception, signalez-la sans délai via la plateforme : SilkRoute vous assistera dans les démarches auprès du fournisseur ou du transitaire, dans la limite des recours disponibles."
            : 'SilkRoute verifies supplier documents and selects licensed forwarders but is not the manufacturer. Report any non-conformity without delay via the platform.'}
        </p>
      </Section>

      <Section heading={fr ? '7. Usage de la plateforme' : '7. Platform usage'}>
        <p>
          {fr
            ? "Les espaces de discussion sont réservés à la coordination des commandes. Tout contenu illicite, frauduleux ou tentative de contourner la plateforme pour traiter directement avec les fournisseurs ou transitaires partenaires peut entraîner la suspension du compte."
            : 'Discussion spaces are reserved for order coordination. Unlawful content or attempts to bypass the platform may lead to account suspension.'}
        </p>
      </Section>

      <Section heading={fr ? '8. Contact' : '8. Contact'}>
        <p>
          {fr ? 'Pour toute question : ' : 'For any question: '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#D4AF37] hover:underline">{CONTACT_EMAIL}</a>
          {' — '}
          <Link to="/contact" className="text-[#D4AF37] hover:underline">
            {fr ? 'page contact' : 'contact page'}
          </Link>
        </p>
      </Section>
    </Page>
  );
};

// ============ Politique de confidentialité ============
export const PrivacyPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';

  return (
    <Page
      title={fr ? 'Politique de confidentialité' : 'Privacy Policy'}
      description="Comment SilkRoute collecte, utilise et protège vos données personnelles : compte, vérification d'identité, commandes et paiements."
      path="/privacy"
    >
      <p className="text-[#71717A]">
        {fr ? 'Dernière mise à jour : juillet 2026' : 'Last updated: July 2026'}
      </p>

      <Section heading={fr ? '1. Données que nous collectons' : '1. Data we collect'}>
        <p>{fr ? 'Nous collectons uniquement ce qui est nécessaire au fonctionnement du service :' : 'We only collect what the service requires:'}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{fr ? 'Compte : nom, adresse email, mot de passe (stocké sous forme chiffrée, jamais en clair), téléphone, ville, langue.' : 'Account: name, email, encrypted password, phone, city, language.'}</li>
          <li>{fr ? "Vérification d'identité (KYC) : pièce d'identité et photo, exigées avant de rejoindre une commande groupée." : 'Identity verification (KYC): ID document and photo.'}</li>
          <li>{fr ? 'Commandes : quantités réservées, ville de retrait, historique de paiement.' : 'Orders: reserved quantities, pickup city, payment history.'}</li>
          <li>{fr ? 'Messages échangés dans les espaces de discussion des groupages.' : 'Messages exchanged in groupage chats.'}</li>
        </ul>
      </Section>

      <Section heading={fr ? '2. Utilisation des données' : '2. How we use data'}>
        <p>
          {fr
            ? "Vos données servent exclusivement à : gérer votre compte, vérifier votre identité, organiser et suivre les commandes groupées, communiquer avec vous (emails de service, notifications de suivi) et respecter nos obligations légales. Nous n'utilisons pas vos données à des fins publicitaires et ne les vendons à personne."
            : 'Your data is used only to operate your account, verify identity, organise and track group orders, communicate with you, and meet legal obligations. We never sell your data.'}
        </p>
      </Section>

      <Section heading={fr ? '3. Partage avec des tiers' : '3. Sharing with third parties'}>
        <p>
          {fr
            ? "Certaines informations sont transmises à nos partenaires uniquement dans la mesure nécessaire à l'exécution de votre commande : au transitaire (nom, téléphone, ville de retrait, quantité) et au prestataire de paiement. Les documents d'identité ne sont jamais transmis aux fournisseurs, transitaires ou autres membres."
            : 'Some information is shared with partners strictly as needed to fulfil your order. ID documents are never shared with suppliers, forwarders or other members.'}
        </p>
        <p>
          {fr
            ? "Nos prestataires techniques : hébergement du site et de l'API, base de données, stockage sécurisé des documents et service d'envoi d'emails."
            : 'Our technical providers: website and API hosting, database, secure document storage and email delivery.'}
        </p>
      </Section>

      <Section heading={fr ? '4. Sécurité' : '4. Security'}>
        <p>
          {fr
            ? "Les échanges avec le site sont chiffrés (HTTPS). Les mots de passe sont hachés et ne peuvent pas être lus, même par nous. Les documents d'identité sont stockés sur un espace à accès restreint et ne sont consultables que par l'équipe de vérification."
            : 'Traffic is encrypted (HTTPS). Passwords are hashed. ID documents are stored with restricted access.'}
        </p>
      </Section>

      <Section heading={fr ? '5. Conservation et vos droits' : '5. Retention and your rights'}>
        <p>
          {fr
            ? "Vos données sont conservées le temps de votre utilisation du service et des obligations légales qui en découlent. Vous pouvez à tout moment consulter et modifier vos informations depuis « Mon compte », ou demander la suppression de votre compte en nous écrivant."
            : 'You may review and edit your information from "My account", or request deletion by contacting us.'}
        </p>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#D4AF37] hover:underline">{CONTACT_EMAIL}</a>
        </p>
      </Section>

      <Section heading={fr ? '6. Cookies et mesure d\'audience' : '6. Cookies and analytics'}>
        <p>
          {fr
            ? "Nous utilisons un cookie strictement nécessaire pour maintenir votre session ouverte après connexion. Aucun cookie publicitaire n'est déposé. Aucun outil d'enregistrement de session n'est actif sur la plateforme."
            : 'We use a strictly necessary cookie to keep your session open. No advertising cookies. No session recording tool is active.'}
        </p>
      </Section>
    </Page>
  );
};

// ============ Contact ============
export const ContactPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';

  return (
    <Page
      title="Contact"
      description="Contactez l'équipe SilkRoute : questions sur les commandes groupées Chine-Afrique, partenariats fournisseurs et transitaires."
      path="/contact"
    >
      <p>
        {fr
          ? "Une question sur une commande, un partenariat, ou envie de proposer un produit ? Écrivez-nous, nous répondons sous 48 heures ouvrées."
          : 'A question about an order, a partnership, or a product idea? Write to us, we reply within 2 business days.'}
      </p>

      <div className="grid sm:grid-cols-2 gap-4 pt-2">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-5 hover:border-[#D4AF37] transition-colors block"
        >
          <Mail className="w-6 h-6 text-[#D4AF37] mb-3" />
          <p className="text-white font-medium mb-1">Email</p>
          <p className="text-sm">{CONTACT_EMAIL}</p>
        </a>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-5">
          <MessageCircle className="w-6 h-6 text-[#D4AF37] mb-3" />
          <p className="text-white font-medium mb-1">WhatsApp</p>
          <p className="text-sm">
            {fr ? 'Numéro communiqué aux membres après inscription.' : 'Number shared with members after signup.'}
          </p>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-5">
          <MapPin className="w-6 h-6 text-[#D4AF37] mb-3" />
          <p className="text-white font-medium mb-1">{fr ? 'Zone desservie' : 'Service area'}</p>
          <p className="text-sm">{fr ? 'Cameroun — Douala, Yaoundé' : 'Cameroon — Douala, Yaounde'}</p>
        </div>

        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-5">
          <Phone className="w-6 h-6 text-[#D4AF37] mb-3" />
          <p className="text-white font-medium mb-1">{fr ? 'Partenariats' : 'Partnerships'}</p>
          <p className="text-sm">
            {fr ? 'Transitaires et fournisseurs : écrivez-nous par email.' : 'Forwarders and suppliers: email us.'}
          </p>
        </div>
      </div>

      <p className="pt-4">
        {fr ? 'Consultez aussi notre ' : 'See also our '}
        <Link to="/faq" className="text-[#D4AF37] hover:underline">FAQ</Link>
        {fr ? ' : la réponse à votre question s\'y trouve peut-être déjà.' : ': your answer may already be there.'}
      </p>
    </Page>
  );
};
