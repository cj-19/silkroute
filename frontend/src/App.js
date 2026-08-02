import React from "react";
import "@/App.css";
import "@/i18n";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "sonner";

// Pages
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OnboardingPage from "@/pages/OnboardingPage";
import GroupagesPage from "@/pages/GroupagesPage";
import GroupageDetailPage from "@/pages/GroupageDetailPage";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import PartnerPage from "@/pages/PartnerPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import SettingsPage from "@/pages/SettingsPage";
import FAQPage from "@/pages/FAQPage";
import GuidesIndexPage from "@/pages/GuidesIndexPage";
import GuidePage from "@/pages/GuidePage";
import { TermsPage, PrivacyPage, ContactPage } from "@/pages/LegalPages";
import NotFoundPage from "@/pages/NotFoundPage";

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, roles = null }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Mot de passe provisoire : on force le changement avant tout acces
  if (user?.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/guides" element={<GuidesIndexPage />} />
      <Route path="/guides/:slug" element={<GuidePage />} />

      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      <Route path="/groupages" element={<GroupagesPage />} />
      <Route path="/groupages/:id" element={<GroupageDetailPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      } />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />

      <Route path="/change-password" element={
        <ProtectedRoute>
          <ChangePasswordPage />
        </ProtectedRoute>
      } />

      <Route path="/partenaire" element={
        <ProtectedRoute roles={['transitaire', 'supplier']}>
          <PartnerPage />
        </ProtectedRoute>
      } />

      <Route path="/admin/*" element={
        <ProtectedRoute adminOnly>
          <AdminPage />
        </ProtectedRoute>
      } />
      
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* Une URL inconnue affiche une vraie page 404 (en noindex) au lieu de
          rediriger silencieusement vers l'accueil, ce que Google traite en
          "soft 404" et qui masque les liens casses. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

function App() {
  // La classe de theme est posee sur <html> par la Navbar (voir Layout.jsx),
  // pas ici : le theme doit survivre aux pages sans Layout.
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }
          }}
        />
      </AuthProvider>
    </div>
  );
}

export default App;
