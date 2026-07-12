import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Mail, Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const ForgotPasswordPage = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (error) {
      // 429 = trop de demandes ; toute autre erreur reste generique volontairement
      if (error.response?.status === 429) {
        toast.error(fr ? 'Trop de demandes. Réessayez dans une heure.' : 'Too many requests. Try again in an hour.');
      } else {
        setSent(true); // reponse identique pour ne pas revele l'existence d'un compte
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {sent ? (
            <div className="text-center" data-testid="forgot-password-sent">
              <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-8 h-8 text-[#22C55E]" />
              </div>
              <h1 className="font-['Bebas_Neue'] text-3xl mb-3">
                {fr ? 'Vérifiez votre boîte mail' : 'Check your inbox'}
              </h1>
              <p className="text-[#A1A1AA] mb-8">
                {fr
                  ? `Si un compte existe avec ${email}, un lien de réinitialisation vient d'être envoyé. Le lien expire dans 60 minutes (pensez à vérifier les spams).`
                  : `If an account exists with ${email}, a reset link has been sent. It expires in 60 minutes (check your spam folder).`}
              </p>
              <Link to="/login" className="btn-outline px-6 py-3 rounded-md inline-block">
                {fr ? 'Retour à la connexion' : 'Back to login'}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="font-['Bebas_Neue'] text-4xl mb-2">
                  {fr ? 'Mot de passe oublié' : 'Forgot password'}
                </h1>
                <p className="text-[#A1A1AA]">
                  {fr
                    ? 'Entrez votre email, nous vous enverrons un lien pour choisir un nouveau mot de passe.'
                    : "Enter your email and we'll send you a link to choose a new password."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-[#A1A1AA] mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                      placeholder="email@exemple.com"
                      required
                      data-testid="forgot-email-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  data-testid="forgot-submit-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (fr ? 'Envoyer le lien' : 'Send link')}
                </button>

                <p className="text-center text-sm text-[#71717A]">
                  <Link to="/login" className="text-[#D4AF37] hover:underline">
                    {fr ? 'Retour à la connexion' : 'Back to login'}
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPasswordPage;
