import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Page atteinte via le lien envoye par email : /reset-password?token=...
const ResetPasswordPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(fr ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error(fr ? 'Le mot de passe doit contenir au moins 8 caractères' : 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: newPassword });
      toast.success(fr ? 'Mot de passe réinitialisé! Connectez-vous.' : 'Password reset! Please log in.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Lien invalide ou expiré' : 'Invalid or expired link'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Layout showFooter={false}>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto mb-4" />
            <h1 className="font-['Bebas_Neue'] text-3xl mb-3">
              {fr ? 'Lien invalide' : 'Invalid link'}
            </h1>
            <p className="text-[#A1A1AA] mb-6">
              {fr
                ? 'Ce lien de réinitialisation est incomplet. Refaites une demande depuis la page "Mot de passe oublié".'
                : 'This reset link is incomplete. Please request a new one from the "Forgot password" page.'}
            </p>
            <Link to="/forgot-password" className="btn-gold px-6 py-3 rounded-md inline-block">
              {fr ? 'Refaire une demande' : 'Request a new link'}
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-['Bebas_Neue'] text-4xl mb-2">
              {fr ? 'Nouveau mot de passe' : 'New password'}
            </h1>
            <p className="text-[#A1A1AA]">
              {fr ? 'Choisissez votre nouveau mot de passe (8 caractères minimum).' : 'Choose your new password (8 characters minimum).'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Nouveau mot de passe' : 'New password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-dark w-full pl-10 pr-12 py-3 rounded-md"
                  required
                  minLength={8}
                  data-testid="reset-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Confirmer le mot de passe' : 'Confirm password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                  required
                  data-testid="reset-confirm-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="reset-submit-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (fr ? 'Réinitialiser' : 'Reset password')}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPasswordPage;
