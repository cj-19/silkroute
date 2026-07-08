import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { 
  User, MapPin, Phone, CreditCard, Camera, FileText, 
  Check, ChevronRight, ChevronLeft, Upload, Loader2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OnboardingPage = () => {
  const { t, i18n } = useTranslation();
  const { user, token, updateUser } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [profileData, setProfileData] = useState({
    phone: user?.phone || '',
    location: user?.location || ''
  });
  
  const [mobileMoneyData, setMobileMoneyData] = useState({
    provider: '',
    number: ''
  });
  
  const [kycData, setKycData] = useState({
    idFront: null,
    idBack: null,
    selfie: null
  });
  
  const [cguAccepted, setCguAccepted] = useState(false);

  const steps = [
    { id: 1, key: 'step1', icon: User },
    { id: 2, key: 'step2', icon: MapPin },
    { id: 3, key: 'step3', icon: CreditCard },
    { id: 4, key: 'step4', icon: Camera },
    { id: 5, key: 'step5', icon: FileText }
  ];

  // Check initial state - skip already-completed steps
  useEffect(() => {
    if (!user) return;
    if (user.cgu_accepted && user.kyc_status !== 'pending') {
      navigate('/dashboard');
      return;
    }
    // Resume to the right step
    if (user.kyc_status === 'submitted' || user.kyc_status === 'validated') {
      setStep(5);
    } else if (user.mobile_money?.number) {
      setStep(4);
    } else if (user.phone && user.location) {
      setStep(3);
    }
    // else stay on step 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: build auth config supporting both JWT (email/password) and cookie session (Google OAuth)
  const authConfig = () => ({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    withCredentials: true
  });

  const extractErrMsg = (error, fallback) => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    return fallback || t('common.error');
  };

  const handleProfileSubmit = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/users/profile`, profileData, authConfig());
      updateUser(profileData);
      setStep(3);
    } catch (error) {
      toast.error(extractErrMsg(error));
    } finally {
      setLoading(false);
    }
  };

  const handleMobileMoneySubmit = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/users/profile`, { mobile_money: mobileMoneyData }, authConfig());
      setStep(4);
    } catch (error) {
      toast.error(extractErrMsg(error));
    } finally {
      setLoading(false);
    }
  };

  const uploadToCloudinary = async (file, folder) => {
    // Get signature from backend
    const sigResponse = await axios.get(`${API}/cloudinary/signature?folder=${folder}`, authConfig());
    const sig = sigResponse.data;

    // Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sig.api_key);
    formData.append('timestamp', sig.timestamp);
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);

    const uploadResponse = await axios.post(
      `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
      formData
    );

    return uploadResponse.data.secure_url;
  };

  const handleFileSelect = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error(i18n.language === 'fr' ? 'Veuillez sélectionner une image' : 'Please select an image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(i18n.language === 'fr' ? 'Fichier trop volumineux (max 5MB)' : 'File too large (max 5MB)');
      return;
    }

    setKycData(prev => ({ ...prev, [field]: file }));
  };

  const handleKycSubmit = async () => {
    if (!kycData.idFront || !kycData.idBack || !kycData.selfie) {
      toast.error(i18n.language === 'fr' ? 'Veuillez télécharger tous les documents' : 'Please upload all documents');
      return;
    }

    setLoading(true);
    try {
      // Upload all files to Cloudinary
      const [idFrontUrl, idBackUrl, selfieUrl] = await Promise.all([
        uploadToCloudinary(kycData.idFront, `kyc/${user.user_id}`),
        uploadToCloudinary(kycData.idBack, `kyc/${user.user_id}`),
        uploadToCloudinary(kycData.selfie, `kyc/${user.user_id}`)
      ]);

      // Update KYC in backend
      await axios.put(`${API}/users/kyc`, {
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        selfie_url: selfieUrl
      }, authConfig());

      updateUser({ kyc_status: 'submitted' });
      setStep(5);
    } catch (error) {
      console.error('KYC upload error:', error);
      toast.error(extractErrMsg(error, i18n.language === 'fr' ? "Échec du téléversement des documents" : "Document upload failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCguSubmit = async () => {
    if (!cguAccepted) {
      toast.error(i18n.language === 'fr' ? 'Veuillez accepter les CGU' : 'Please accept the terms');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${API}/users/cgu`, {}, authConfig());
      updateUser({ cgu_accepted: true });
      toast.success(i18n.language === 'fr' ? 'Inscription terminée!' : 'Registration complete!');
      navigate('/dashboard');
    } catch (error) {
      console.error('CGU acceptance error:', error);
      toast.error(extractErrMsg(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-4" data-testid="onboarding-steps">
          {steps.map((s, index) => (
            <React.Fragment key={s.id}>
              <div 
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                  step === s.id 
                    ? 'bg-[#D4AF37] text-[#0A0A0A]' 
                    : step > s.id 
                    ? 'bg-[#22C55E] text-white'
                    : 'bg-[#1A1A1A] text-[#71717A]'
                }`}
              >
                {step > s.id ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
                <span className="text-sm font-medium hidden sm:block">{t(`onboarding.${s.key}`)}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${step > s.id ? 'bg-[#22C55E]' : 'bg-[#2A2A2A]'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="w-full max-w-md bg-[#141414] border border-[#2A2A2A] rounded-lg p-8">
          {/* Step 1: Welcome (already registered) */}
          {step === 1 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <User className="w-10 h-10 text-[#D4AF37]" />
              </div>
              <h2 className="font-['Bebas_Neue'] text-3xl mb-4">
                {i18n.language === 'fr' ? `Bienvenue, ${user?.name}!` : `Welcome, ${user?.name}!`}
              </h2>
              <p className="text-[#A1A1AA] mb-8">
                {i18n.language === 'fr' 
                  ? 'Complétez votre profil pour commencer à utiliser SilkRoute.'
                  : 'Complete your profile to start using SilkRoute.'
                }
              </p>
              <button
                onClick={() => setStep(2)}
                className="btn-gold px-8 py-3 rounded-md font-semibold flex items-center justify-center gap-2 mx-auto"
                data-testid="start-onboarding-btn"
              >
                {t('onboarding.next')}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Profile */}
          {step === 2 && (
            <div>
              <h2 className="font-['Bebas_Neue'] text-2xl mb-6">{t('onboarding.step2')}</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#A1A1AA] mb-2">{t('auth.phone')}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                      placeholder="+237 6XX XXX XXX"
                      data-testid="phone-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-[#A1A1AA] mb-2">{t('onboarding.location')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                    <input
                      type="text"
                      value={profileData.location}
                      onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                      className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                      placeholder="Douala, Cameroun"
                      data-testid="location-input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="btn-outline px-6 py-3 rounded-md flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {t('onboarding.back')}
                </button>
                <button
                  onClick={handleProfileSubmit}
                  disabled={loading}
                  className="flex-1 btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2"
                  data-testid="profile-submit-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.next')}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Mobile Money */}
          {step === 3 && (
            <div>
              <h2 className="font-['Bebas_Neue'] text-2xl mb-6">{t('onboarding.step3')}</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#A1A1AA] mb-2">{t('onboarding.mobileProvider')}</label>
                  <select
                    value={mobileMoneyData.provider}
                    onChange={(e) => setMobileMoneyData({ ...mobileMoneyData, provider: e.target.value })}
                    className="input-dark w-full px-4 py-3 rounded-md"
                    data-testid="provider-select"
                  >
                    <option value="">-- {i18n.language === 'fr' ? 'Sélectionner' : 'Select'} --</option>
                    <option value="orange">Orange Money</option>
                    <option value="mtn">MTN MoMo</option>
                    <option value="wave">Wave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#A1A1AA] mb-2">{t('onboarding.mobileNumber')}</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
                    <input
                      type="tel"
                      value={mobileMoneyData.number}
                      onChange={(e) => setMobileMoneyData({ ...mobileMoneyData, number: e.target.value })}
                      className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                      placeholder="+237 6XX XXX XXX"
                      data-testid="mobile-money-input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setStep(2)}
                  className="btn-outline px-6 py-3 rounded-md flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {t('onboarding.back')}
                </button>
                <button
                  onClick={handleMobileMoneySubmit}
                  disabled={loading}
                  className="flex-1 btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2"
                  data-testid="mobile-money-submit-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.next')}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: KYC */}
          {step === 4 && (
            <div>
              <h2 className="font-['Bebas_Neue'] text-2xl mb-2">{t('onboarding.step4')}</h2>
              <p className="text-[#A1A1AA] text-sm mb-6">
                {i18n.language === 'fr' 
                  ? 'Téléchargez vos documents pour vérifier votre identité.'
                  : 'Upload your documents to verify your identity.'
                }
              </p>
              
              <div className="space-y-4">
                {/* ID Front */}
                <FileUploadBox
                  label={t('onboarding.idFront')}
                  file={kycData.idFront}
                  onSelect={(e) => handleFileSelect(e, 'idFront')}
                  testId="id-front-upload"
                />

                {/* ID Back */}
                <FileUploadBox
                  label={t('onboarding.idBack')}
                  file={kycData.idBack}
                  onSelect={(e) => handleFileSelect(e, 'idBack')}
                  testId="id-back-upload"
                />

                {/* Selfie */}
                <FileUploadBox
                  label={t('onboarding.selfie')}
                  file={kycData.selfie}
                  onSelect={(e) => handleFileSelect(e, 'selfie')}
                  testId="selfie-upload"
                />
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setStep(3)}
                  className="btn-outline px-6 py-3 rounded-md flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {t('onboarding.back')}
                </button>
                <button
                  onClick={handleKycSubmit}
                  disabled={loading || !kycData.idFront || !kycData.idBack || !kycData.selfie}
                  className="flex-1 btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  data-testid="kyc-submit-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.next')}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: CGU */}
          {step === 5 && (
            <div>
              <h2 className="font-['Bebas_Neue'] text-2xl mb-6">{t('onboarding.cguTitle')}</h2>
              
              {/* CGU Content */}
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-md p-4 h-64 overflow-y-auto text-sm text-[#A1A1AA] mb-6">
                <h3 className="font-semibold text-white mb-2">Article 1 - Définitions</h3>
                <p className="mb-4">
                  SilkRoute : désigne la plateforme web accessible permettant de faciliter le groupage d'achats...
                </p>
                <h3 className="font-semibold text-white mb-2">Article 2 - Nature juridique</h3>
                <p className="mb-4">
                  SilkRoute agit exclusivement en qualité de commissionnaire non-garant conformément aux articles 338 à 352 de l'Acte Uniforme OHADA...
                </p>
                <h3 className="font-semibold text-white mb-2">Article 3 - Obligations</h3>
                <p className="mb-4">
                  SilkRoute s'engage à exercer une diligence professionnelle raisonnable dans la sélection des fournisseurs et transitaires...
                </p>
                <div className="bg-[#F97316]/10 border border-[#F97316]/20 rounded p-3 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                    <p className="text-[#F97316] text-xs">
                      {i18n.language === 'fr'
                        ? "Important: SilkRoute ne garantit pas la qualité ou la livraison des marchandises. Le committant accepte les risques inhérents aux tiers."
                        : "Important: SilkRoute does not guarantee the quality or delivery of goods. The client accepts the inherent risks of third parties."
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Accept Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mb-8">
                <input
                  type="checkbox"
                  checked={cguAccepted}
                  onChange={(e) => setCguAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-[#2A2A2A] bg-[#0A0A0A] text-[#D4AF37] focus:ring-[#D4AF37]"
                  data-testid="cgu-checkbox"
                />
                <span className="text-sm text-[#A1A1AA]">
                  {t('onboarding.cguAccept')}
                </span>
              </label>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(4)}
                  className="btn-outline px-6 py-3 rounded-md flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {t('onboarding.back')}
                </button>
                <button
                  onClick={handleCguSubmit}
                  disabled={loading || !cguAccepted}
                  className="flex-1 btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  data-testid="finish-onboarding-btn"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.finish')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

// File Upload Component
const FileUploadBox = ({ label, file, onSelect, testId }) => {
  return (
    <div>
      <label className="block text-sm text-[#A1A1AA] mb-2">{label}</label>
      <label 
        className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
          file 
            ? 'border-[#22C55E] bg-[#22C55E]/5' 
            : 'border-[#2A2A2A] hover:border-[#D4AF37] bg-[#0A0A0A]'
        }`}
        data-testid={testId}
      >
        {file ? (
          <div className="flex items-center gap-2 text-[#22C55E]">
            <Check className="w-5 h-5" />
            <span className="text-sm">{file.name}</span>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-[#71717A] mb-2" />
            <span className="text-sm text-[#71717A]">
              {file ? file.name : 'Cliquez pour sélectionner'}
            </span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={onSelect}
          className="hidden"
        />
      </label>
    </div>
  );
};

export default OnboardingPage;
