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

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
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

  if (adminOnly && !isAdmin) {
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
      
      <Route path="/admin/*" element={
        <ProtectedRoute adminOnly>
          <AdminPage />
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <div className="App dark">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: '#141414',
              color: '#fff',
              border: '1px solid #2A2A2A'
            }
          }}
        />
      </AuthProvider>
    </div>
  );
}

export default App;
