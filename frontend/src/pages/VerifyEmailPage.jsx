import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Loader2, MailCheck, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Page atteinte via le lien envoye a l'inscription : /verify-email?token=...
const VerifyEmailPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, updateUser, isAuthenticated } = useAuth();

  const [status, setStatus] = useState(token ? 'verifying' : 'error'); // verifying | success | error
  const [errorDetail, setErrorDetail] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    api.post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        if (isAuthenticated) {
          updateUser({ email_verified: true });
        }
      })
      .catch((error) => {
        setErrorDetail(error.response?.data?.detail || null);
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
        <div className="text-center max-w-md" data-testid="verify-email-page">
          {status === 'verifying' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-[#D4AF37] mx-auto mb-4" />
              <h1 className="font-['Bebas_Neue'] text-3xl">
                {fr ? 'Vérification en cours...' : 'Verifying...'}
              </h1>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-8 h-8 text-[#22C55E]" />
              </div>
              <h1 className="font-['Bebas_Neue'] text-3xl mb-3">
                {fr ? 'Email vérifié !' : 'Email verified!'}
              </h1>
              <p className="text-[#A1A1AA] mb-8">
                {fr ? 'Merci, votre adresse email est confirmée.' : 'Thanks, your email address is confirmed.'}
              </p>
              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className="btn-gold px-6 py-3 rounded-md inline-block"
                data-testid="verify-continue-btn"
              >
                {isAuthenticated
                  ? (fr ? 'Aller au tableau de bord' : 'Go to dashboard')
                  : (fr ? 'Se connecter' : 'Log in')}
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto mb-4" />
              <h1 className="font-['Bebas_Neue'] text-3xl mb-3">
                {fr ? 'Lien invalide ou expiré' : 'Invalid or expired link'}
              </h1>
              <p className="text-[#A1A1AA] mb-8">
                {errorDetail || (fr
                  ? 'Vous pouvez redemander un email de vérification depuis votre profil (Mon compte).'
                  : 'You can request a new verification email from your profile (My account).')}
              </p>
              <Link
                to={isAuthenticated ? '/settings' : '/login'}
                className="btn-outline px-6 py-3 rounded-md inline-block"
              >
                {isAuthenticated
                  ? (fr ? 'Aller à mon profil' : 'Go to my profile')
                  : (fr ? 'Se connecter' : 'Log in')}
              </Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default VerifyEmailPage;
