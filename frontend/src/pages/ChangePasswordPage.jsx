import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Page de changement de mot de passe. Obligatoire pour les comptes partenaires
// crees par l'admin avec un mot de passe provisoire (must_change_password).
const ChangePasswordPage = () => {
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const fr = i18n.language === 'fr';
  const isForced = user?.must_change_password;

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
      await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      updateUser({ must_change_password: false });
      toast.success(fr ? 'Mot de passe changé!' : 'Password changed!');

      if (user?.role === 'transitaire' || user?.role === 'supplier') {
        navigate('/partenaire');
      } else if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <h1 className="font-['Bebas_Neue'] text-4xl mb-2">
              {fr ? 'Changer le mot de passe' : 'Change password'}
            </h1>
            {isForced && (
              <p className="text-[#A1A1AA]">
                {fr
                  ? 'Votre compte a été créé avec un mot de passe provisoire. Choisissez le vôtre pour continuer.'
                  : 'Your account was created with a temporary password. Choose your own to continue.'}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Mot de passe actuel (provisoire)' : 'Current (temporary) password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                  required
                  data-testid="current-password-input"
                />
              </div>
            </div>

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
                  data-testid="new-password-input"
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
                {fr ? 'Confirmer le nouveau mot de passe' : 'Confirm new password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                  required
                  data-testid="confirm-new-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="change-password-submit-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (fr ? 'Valider' : 'Confirm')}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ChangePasswordPage;
