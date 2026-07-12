import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import {
  User, Phone, MapPin, Globe, Wallet, Lock, Loader2,
  MailCheck, MailWarning, Send, Eye, EyeOff, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Page "Mon compte" : modifier ses informations, verifier son email,
// changer son mot de passe.
const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const { user, updateUser } = useAuth();

  return (
    <Layout showFooter={false}>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16" data-testid="settings-page">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-['Bebas_Neue'] text-4xl mb-2">
            {fr ? 'Mon compte' : 'My account'}
          </h1>
          <p className="text-[#A1A1AA] mb-8">{user?.email}</p>

          <div className="space-y-6">
            <EmailVerificationCard user={user} fr={fr} />
            <ProfileCard user={user} updateUser={updateUser} fr={fr} i18n={i18n} />
            <PasswordCard fr={fr} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

// --- Statut de verification de l'email ---
const EmailVerificationCard = ({ user, fr }) => {
  const [sending, setSending] = useState(false);

  // null/undefined = compte anterieur a la verification : on n'affiche rien
  if (user?.email_verified !== false && user?.email_verified !== true) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success(fr ? 'Email de vérification envoyé — vérifiez votre boîte mail (et les spams).' : 'Verification email sent — check your inbox (and spam).');
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? "L'envoi a échoué" : 'Sending failed'));
    } finally {
      setSending(false);
    }
  };

  return user.email_verified ? (
    <div className="bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-lg p-4 flex items-center gap-3" data-testid="email-verified-card">
      <MailCheck className="w-5 h-5 text-[#22C55E] shrink-0" />
      <p className="text-sm text-[#22C55E]">{fr ? 'Adresse email vérifiée' : 'Email address verified'}</p>
    </div>
  ) : (
    <div className="bg-[#F97316]/5 border border-[#F97316]/20 rounded-lg p-4" data-testid="email-unverified-card">
      <div className="flex items-center gap-3 mb-3">
        <MailWarning className="w-5 h-5 text-[#F97316] shrink-0" />
        <p className="text-sm text-[#F97316]">
          {fr ? "Votre adresse email n'est pas encore vérifiée." : 'Your email address is not verified yet.'}
        </p>
      </div>
      <button
        onClick={handleResend}
        disabled={sending}
        className="btn-outline px-4 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
        data-testid="resend-verification-btn"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {fr ? "Renvoyer l'email de vérification" : 'Resend verification email'}
      </button>
    </div>
  );
};

// --- Informations du profil ---
const ProfileCard = ({ user, updateUser, fr, i18n }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    location: user?.location || '',
    language: user?.language || 'fr',
    mm_provider: user?.mobile_money?.provider || 'orange',
    mm_number: user?.mobile_money?.number || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || null,
        location: form.location || null,
        language: form.language,
        mobile_money: form.mm_number
          ? { provider: form.mm_provider, number: form.mm_number }
          : (user?.mobile_money || {})
      };
      const response = await api.put('/users/profile', payload);
      updateUser(response.data);
      if (form.language !== i18n.language) {
        i18n.changeLanguage(form.language);
      }
      toast.success(fr ? 'Informations mises à jour!' : 'Information updated!');
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6" data-testid="profile-card">
      <h2 className="font-medium mb-4 flex items-center gap-2">
        <User className="w-5 h-5 text-[#D4AF37]" />
        {fr ? 'Mes informations' : 'My information'}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Nom complet' : 'Full name'}</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-dark w-full pl-10 pr-4 py-2.5 rounded-md"
              required
              data-testid="settings-name-input"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Téléphone' : 'Phone'}</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-dark w-full pl-10 pr-4 py-2.5 rounded-md"
                placeholder="+237 ..."
                data-testid="settings-phone-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Ville' : 'City'}</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input-dark w-full pl-10 pr-4 py-2.5 rounded-md"
                placeholder={fr ? 'Douala' : 'Douala'}
                data-testid="settings-location-input"
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Langue' : 'Language'}</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="input-dark w-full pl-10 pr-4 py-2.5 rounded-md"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">Mobile Money</label>
            <div className="flex gap-2">
              <select
                value={form.mm_provider}
                onChange={(e) => setForm({ ...form, mm_provider: e.target.value })}
                className="input-dark px-3 py-2.5 rounded-md w-32"
              >
                <option value="orange">Orange</option>
                <option value="mtn">MTN</option>
              </select>
              <div className="relative flex-1">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type="tel"
                  value={form.mm_number}
                  onChange={(e) => setForm({ ...form, mm_number: e.target.value })}
                  className="input-dark w-full pl-10 pr-4 py-2.5 rounded-md"
                  placeholder={fr ? 'Numéro' : 'Number'}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="btn-gold px-6 py-2.5 rounded-md mt-5 flex items-center gap-2 disabled:opacity-50"
        data-testid="save-profile-btn"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {fr ? 'Enregistrer' : 'Save'}
      </button>
    </form>
  );
};

// --- Changement de mot de passe ---
const PasswordCard = ({ fr }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

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

    setSaving(true);
    try {
      await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      toast.success(fr ? 'Mot de passe changé!' : 'Password changed!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6" data-testid="password-card">
      <h2 className="font-medium mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
        {fr ? 'Changer mon mot de passe' : 'Change my password'}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Mot de passe actuel' : 'Current password'}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-dark w-full pl-10 pr-12 py-2.5 rounded-md"
              required
              data-testid="settings-current-password"
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

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Nouveau mot de passe' : 'New password'}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-dark w-full pl-10 pr-4 py-2.5 rounded-md"
                required
                minLength={8}
                data-testid="settings-new-password"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Confirmer' : 'Confirm'}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-dark w-full pl-10 pr-4 py-2.5 rounded-md"
                required
                data-testid="settings-confirm-password"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="btn-gold px-6 py-2.5 rounded-md mt-5 flex items-center gap-2 disabled:opacity-50"
        data-testid="save-password-btn"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {fr ? 'Changer le mot de passe' : 'Change password'}
      </button>
    </form>
  );
};

export default SettingsPage;
