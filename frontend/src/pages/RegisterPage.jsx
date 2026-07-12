import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Mail, Lock, Eye, EyeOff, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    language: i18n.language
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error(i18n.language === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error(i18n.language === 'fr' ? 'Le mot de passe doit contenir au moins 8 caractères' : 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    
    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        language: formData.language
      });
      toast.success(i18n.language === 'fr'
        ? 'Compte créé! Un email de vérification vous a été envoyé.'
        : 'Account created! A verification email has been sent to you.');
      navigate('/onboarding');
    } catch (error) {
      console.error('Register error:', error);
      toast.error(error.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-['Bebas_Neue'] text-4xl mb-2">{t('auth.register')}</h1>
            <p className="text-[#A1A1AA]">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-[#D4AF37] hover:underline">
                {t('auth.login')}
              </Link>
            </p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{t('auth.name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                  placeholder="John Doe"
                  required
                  data-testid="name-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                  placeholder="email@exemple.com"
                  required
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input-dark w-full pl-10 pr-12 py-3 rounded-md"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  data-testid="password-input"
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
              <label className="block text-sm text-[#A1A1AA] mb-2">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                  placeholder="••••••••"
                  required
                  data-testid="confirm-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="register-submit-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('auth.register')
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default RegisterPage;
