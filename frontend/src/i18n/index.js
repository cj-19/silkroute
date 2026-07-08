import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  fr: {
    translation: {
      // Navigation
      "nav.home": "Accueil",
      "nav.groupages": "Groupages",
      "nav.dashboard": "Tableau de bord",
      "nav.admin": "Administration",
      "nav.login": "Connexion",
      "nav.register": "Inscription",
      "nav.logout": "Déconnexion",
      "nav.profile": "Profil",
      
      // Landing Page
      "hero.title": "Importez depuis la Chine.",
      "hero.title2": "Ensemble.",
      "hero.subtitle": "Groupez vos achats, partagez les frais logistiques, économisez jusqu'à 40% sur vos importations.",
      "hero.cta": "Rejoindre un groupage",
      "hero.cta2": "Comment ça marche",
      
      // How it works
      "howItWorks.title": "Comment ça marche",
      "howItWorks.step1.title": "1. Choisissez un groupage",
      "howItWorks.step1.desc": "Parcourez les groupages actifs et trouvez les produits qui vous intéressent.",
      "howItWorks.step2.title": "2. Rejoignez le groupe",
      "howItWorks.step2.desc": "Versez votre caution de 5 000 FCFA et rejoignez le groupe d'acheteurs.",
      "howItWorks.step3.title": "3. On s'occupe du reste",
      "howItWorks.step3.desc": "Commande, transit, dédouanement, livraison - on gère tout pour vous.",
      "howItWorks.step4.title": "4. Recevez vos marchandises",
      "howItWorks.step4.desc": "Payez le solde à l'arrivée et récupérez vos produits au point de distribution.",
      
      // Savings
      "savings.title": "Comparez vos économies",
      "savings.local": "Grossiste local",
      "savings.alibaba": "Alibaba seul",
      "savings.silkroute": "SilkRoute",
      "savings.savings": "Vous économisez",
      "savings.perUnit": "par unité",
      
      // Groupages
      "groupages.title": "Groupages actifs",
      "groupages.deadline": "Date limite",
      "groupages.members": "membres",
      "groupages.minMembers": "min. requis",
      "groupages.spotsLeft": "places restantes",
      "groupages.viewDetails": "Voir les détails",
      "groupages.join": "Rejoindre",
      "groupages.status.open": "Ouvert",
      "groupages.status.closed": "Fermé",
      "groupages.status.completed": "Terminé",
      "groupages.empty": "Aucun groupage actif pour le moment.",
      
      // Groupage Detail
      "groupage.supplier": "Fournisseur",
      "groupage.transitaire": "Transitaire",
      "groupage.product": "Produit",
      "groupage.timeline": "Suivi logistique",
      "groupage.chat": "Discussion",
      "groupage.documents": "Documents",
      "groupage.members": "Membres",
      "groupage.goldSupplier": "Gold Supplier",
      "groupage.tradeAssurance": "Trade Assurance",
      "groupage.rating": "Note",
      "groupage.location": "Localisation",
      "groupage.license": "Licence",
      
      // Timeline
      "timeline.order": "Commande passée",
      "timeline.production": "Production",
      "timeline.shipping": "Expédition",
      "timeline.transit": "En transit",
      "timeline.customs": "Dédouanement",
      "timeline.delivery": "Livraison",
      
      // Auth
      "auth.login": "Connexion",
      "auth.register": "Inscription",
      "auth.email": "Email",
      "auth.password": "Mot de passe",
      "auth.confirmPassword": "Confirmer le mot de passe",
      "auth.name": "Nom complet",
      "auth.phone": "Téléphone",
      "auth.forgotPassword": "Mot de passe oublié ?",
      "auth.noAccount": "Pas encore de compte ?",
      "auth.hasAccount": "Déjà un compte ?",
      "auth.googleLogin": "Continuer avec Google",
      "auth.or": "ou",
      
      // Onboarding
      "onboarding.step1": "Créer votre compte",
      "onboarding.step2": "Compléter votre profil",
      "onboarding.step3": "Mobile Money",
      "onboarding.step4": "Vérification d'identité",
      "onboarding.step5": "Conditions d'utilisation",
      "onboarding.next": "Continuer",
      "onboarding.back": "Retour",
      "onboarding.finish": "Terminer",
      "onboarding.location": "Ville / Pays",
      "onboarding.mobileProvider": "Opérateur",
      "onboarding.mobileNumber": "Numéro Mobile Money",
      "onboarding.idFront": "Pièce d'identité (recto)",
      "onboarding.idBack": "Pièce d'identité (verso)",
      "onboarding.selfie": "Selfie avec pièce d'identité",
      "onboarding.cguTitle": "Conditions Générales d'Utilisation",
      "onboarding.cguAccept": "J'accepte les CGU et je reconnais avoir pris connaissance des risques liés aux importations via des tiers.",
      
      // KYC
      "kyc.pending": "En attente",
      "kyc.submitted": "Soumis",
      "kyc.validated": "Validé",
      "kyc.rejected": "Rejeté",
      "kyc.required": "Vérification KYC requise pour rejoindre un groupage",
      
      // Payments
      "payment.caution": "Caution",
      "payment.solde": "Solde",
      "payment.pay": "Payer",
      "payment.success": "Paiement réussi !",
      "payment.processing": "Traitement en cours...",
      "payment.failed": "Paiement échoué",
      
      // Dashboard
      "dashboard.title": "Mon tableau de bord",
      "dashboard.myGroupages": "Mes groupages",
      "dashboard.history": "Historique",
      "dashboard.documents": "Documents",
      "dashboard.noGroupages": "Vous n'avez rejoint aucun groupage.",
      "dashboard.exploreGroupages": "Explorer les groupages",
      
      // Admin
      "admin.title": "Administration",
      "admin.overview": "Vue d'ensemble",
      "admin.warnings": "Alertes",
      "admin.groupages": "Groupages",
      "admin.kyc": "Vérifications KYC",
      "admin.transitaires": "Transitaires",
      "admin.users": "Utilisateurs",
      "admin.totalUsers": "Utilisateurs",
      "admin.pendingKyc": "KYC en attente",
      "admin.activeGroupages": "Groupages actifs",
      "admin.totalRevenue": "Revenus",
      "admin.createGroupage": "Créer un groupage",
      "admin.approve": "Approuver",
      "admin.reject": "Rejeter",
      
      // Common
      "common.loading": "Chargement...",
      "common.error": "Une erreur est survenue",
      "common.save": "Enregistrer",
      "common.cancel": "Annuler",
      "common.delete": "Supprimer",
      "common.edit": "Modifier",
      "common.search": "Rechercher",
      "common.filter": "Filtrer",
      "common.all": "Tous",
      "common.viewAll": "Voir tout",
      "common.close": "Fermer",
      "common.send": "Envoyer",
      "common.upload": "Télécharger",
      "common.download": "Télécharger",
      
      // Footer
      "footer.rights": "Tous droits réservés",
      "footer.terms": "CGU",
      "footer.privacy": "Confidentialité",
      "footer.contact": "Contact"
    }
  },
  en: {
    translation: {
      // Navigation
      "nav.home": "Home",
      "nav.groupages": "Groupages",
      "nav.dashboard": "Dashboard",
      "nav.admin": "Admin",
      "nav.login": "Login",
      "nav.register": "Sign up",
      "nav.logout": "Logout",
      "nav.profile": "Profile",
      
      // Landing Page
      "hero.title": "Import from China.",
      "hero.title2": "Together.",
      "hero.subtitle": "Group your purchases, share logistics costs, save up to 40% on your imports.",
      "hero.cta": "Join a groupage",
      "hero.cta2": "How it works",
      
      // How it works
      "howItWorks.title": "How it works",
      "howItWorks.step1.title": "1. Choose a groupage",
      "howItWorks.step1.desc": "Browse active groupages and find products that interest you.",
      "howItWorks.step2.title": "2. Join the group",
      "howItWorks.step2.desc": "Pay your 5,000 FCFA deposit and join the buyer group.",
      "howItWorks.step3.title": "3. We handle the rest",
      "howItWorks.step3.desc": "Order, transit, customs, delivery - we manage everything for you.",
      "howItWorks.step4.title": "4. Receive your goods",
      "howItWorks.step4.desc": "Pay the balance on arrival and pick up your products at the distribution point.",
      
      // Savings
      "savings.title": "Compare your savings",
      "savings.local": "Local wholesaler",
      "savings.alibaba": "Alibaba alone",
      "savings.silkroute": "SilkRoute",
      "savings.savings": "You save",
      "savings.perUnit": "per unit",
      
      // Groupages
      "groupages.title": "Active groupages",
      "groupages.deadline": "Deadline",
      "groupages.members": "members",
      "groupages.minMembers": "min. required",
      "groupages.spotsLeft": "spots left",
      "groupages.viewDetails": "View details",
      "groupages.join": "Join",
      "groupages.status.open": "Open",
      "groupages.status.closed": "Closed",
      "groupages.status.completed": "Completed",
      "groupages.empty": "No active groupages at the moment.",
      
      // Groupage Detail
      "groupage.supplier": "Supplier",
      "groupage.transitaire": "Freight Forwarder",
      "groupage.product": "Product",
      "groupage.timeline": "Logistics Tracking",
      "groupage.chat": "Chat",
      "groupage.documents": "Documents",
      "groupage.members": "Members",
      "groupage.goldSupplier": "Gold Supplier",
      "groupage.tradeAssurance": "Trade Assurance",
      "groupage.rating": "Rating",
      "groupage.location": "Location",
      "groupage.license": "License",
      
      // Timeline
      "timeline.order": "Order placed",
      "timeline.production": "Production",
      "timeline.shipping": "Shipping",
      "timeline.transit": "In transit",
      "timeline.customs": "Customs clearance",
      "timeline.delivery": "Delivery",
      
      // Auth
      "auth.login": "Login",
      "auth.register": "Sign up",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.confirmPassword": "Confirm password",
      "auth.name": "Full name",
      "auth.phone": "Phone",
      "auth.forgotPassword": "Forgot password?",
      "auth.noAccount": "Don't have an account?",
      "auth.hasAccount": "Already have an account?",
      "auth.googleLogin": "Continue with Google",
      "auth.or": "or",
      
      // Onboarding
      "onboarding.step1": "Create your account",
      "onboarding.step2": "Complete your profile",
      "onboarding.step3": "Mobile Money",
      "onboarding.step4": "Identity verification",
      "onboarding.step5": "Terms of use",
      "onboarding.next": "Continue",
      "onboarding.back": "Back",
      "onboarding.finish": "Finish",
      "onboarding.location": "City / Country",
      "onboarding.mobileProvider": "Provider",
      "onboarding.mobileNumber": "Mobile Money Number",
      "onboarding.idFront": "ID card (front)",
      "onboarding.idBack": "ID card (back)",
      "onboarding.selfie": "Selfie with ID",
      "onboarding.cguTitle": "Terms and Conditions",
      "onboarding.cguAccept": "I accept the T&C and acknowledge the risks associated with imports through third parties.",
      
      // KYC
      "kyc.pending": "Pending",
      "kyc.submitted": "Submitted",
      "kyc.validated": "Validated",
      "kyc.rejected": "Rejected",
      "kyc.required": "KYC verification required to join a groupage",
      
      // Payments
      "payment.caution": "Deposit",
      "payment.solde": "Balance",
      "payment.pay": "Pay",
      "payment.success": "Payment successful!",
      "payment.processing": "Processing...",
      "payment.failed": "Payment failed",
      
      // Dashboard
      "dashboard.title": "My dashboard",
      "dashboard.myGroupages": "My groupages",
      "dashboard.history": "History",
      "dashboard.documents": "Documents",
      "dashboard.noGroupages": "You haven't joined any groupage.",
      "dashboard.exploreGroupages": "Explore groupages",
      
      // Admin
      "admin.title": "Administration",
      "admin.overview": "Overview",
      "admin.warnings": "Alerts",
      "admin.groupages": "Groupages",
      "admin.kyc": "KYC Verifications",
      "admin.transitaires": "Freight Forwarders",
      "admin.users": "Users",
      "admin.totalUsers": "Users",
      "admin.pendingKyc": "Pending KYC",
      "admin.activeGroupages": "Active Groupages",
      "admin.totalRevenue": "Revenue",
      "admin.createGroupage": "Create groupage",
      "admin.approve": "Approve",
      "admin.reject": "Reject",
      
      // Common
      "common.loading": "Loading...",
      "common.error": "An error occurred",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.delete": "Delete",
      "common.edit": "Edit",
      "common.search": "Search",
      "common.filter": "Filter",
      "common.all": "All",
      "common.viewAll": "View all",
      "common.close": "Close",
      "common.send": "Send",
      "common.upload": "Upload",
      "common.download": "Download",
      
      // Footer
      "footer.rights": "All rights reserved",
      "footer.terms": "Terms",
      "footer.privacy": "Privacy",
      "footer.contact": "Contact"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    load: 'languageOnly',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng'
    }
  });

export default i18n;
