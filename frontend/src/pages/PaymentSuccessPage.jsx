import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

const PaymentSuccessPage = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [paymentData, setPaymentData] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    const pollPaymentStatus = async (attempts = 0) => {
      const maxAttempts = 5;
      const pollInterval = 2000;

      if (attempts >= maxAttempts) {
        setStatus('timeout');
        return;
      }

      try {
        const response = await api.get(`/payments/status/${sessionId}`);

        setPaymentData(response.data);

        if (response.data.payment_status === 'paid') {
          setStatus('success');
          return;
        } else if (response.data.status === 'expired') {
          setStatus('expired');
          return;
        }

        // Continue polling
        setTimeout(() => pollPaymentStatus(attempts + 1), pollInterval);
      } catch (error) {
        console.error('Error checking payment status:', error);
        setStatus('error');
      }
    };

    pollPaymentStatus();
  }, [sessionId]);

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4" data-testid="payment-success-page">
        <div className="w-full max-w-md text-center">
          {status === 'loading' && (
            <div>
              <Loader2 className="w-16 h-16 animate-spin text-[#D4AF37] mx-auto mb-6" />
              <h1 className="font-['Bebas_Neue'] text-3xl mb-2">{t('payment.processing')}</h1>
              <p className="text-[#A1A1AA]">
                {i18n.language === 'fr' 
                  ? 'Vérification de votre paiement en cours...'
                  : 'Verifying your payment...'
                }
              </p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="w-20 h-20 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-[#22C55E]" />
              </div>
              <h1 className="font-['Bebas_Neue'] text-3xl mb-2">{t('payment.success')}</h1>
              <p className="text-[#A1A1AA] mb-8">
                {i18n.language === 'fr' 
                  ? 'Votre paiement a été confirmé. Vous êtes maintenant membre du groupage.'
                  : 'Your payment has been confirmed. You are now a member of the groupage.'
                }
              </p>
              {paymentData && (
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 mb-6 text-left">
                  <div className="flex justify-between mb-2">
                    <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Montant' : 'Amount'}</span>
                    <span className="text-white font-medium">
                      €{(paymentData.amount_total / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Statut' : 'Status'}</span>
                    <span className="text-[#22C55E] font-medium">
                      {i18n.language === 'fr' ? 'Payé' : 'Paid'}
                    </span>
                  </div>
                </div>
              )}
              <Link
                to="/dashboard"
                className="btn-gold px-8 py-3 rounded-md inline-block"
                data-testid="go-to-dashboard-btn"
              >
                {t('nav.dashboard')}
              </Link>
            </div>
          )}

          {(status === 'error' || status === 'expired' || status === 'timeout') && (
            <div>
              <div className="w-20 h-20 bg-[#EF4444]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-[#EF4444]" />
              </div>
              <h1 className="font-['Bebas_Neue'] text-3xl mb-2">{t('payment.failed')}</h1>
              <p className="text-[#A1A1AA] mb-8">
                {i18n.language === 'fr' 
                  ? 'Une erreur est survenue lors de la vérification de votre paiement.'
                  : 'An error occurred while verifying your payment.'
                }
              </p>
              <Link
                to="/groupages"
                className="btn-outline px-8 py-3 rounded-md inline-block"
              >
                {t('nav.groupages')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentSuccessPage;
