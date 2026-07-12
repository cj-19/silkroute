import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { 
  Package, Clock, Users, MapPin, Star, Shield, FileText, 
  MessageCircle, Send, Loader2, CheckCircle, AlertCircle,
  CreditCard, ExternalLink, Calculator, TrendingDown, Scale,
  Download, Link as LinkIcon, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import { api } from '@/lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SOCKET_PATH = '/api/socket.io';

const GroupageDetailPage = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user, wsToken, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [groupage, setGroupage] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('comparator');
  const [newMessage, setNewMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupageRes = await api.get(`/groupages/${id}`);
        setGroupage(groupageRes.data);

        if (isAuthenticated) {
          // Le detail de prix (comparateur) est reserve aux utilisateurs connectes,
          // pour eviter que notre modele de pricing soit consultable librement par des tiers.
          try {
            const pricingRes = await api.get(`/groupages/${id}/pricing?quantity=1`);
            setPricing(pricingRes.data);
          } catch (e) {
            console.error('Error fetching pricing:', e);
          }

          const [membersRes, messagesRes] = await Promise.all([
            api.get(`/groupages/${id}/members`),
            api.get(`/groupages/${id}/messages`)
          ]);
          setMembers(membersRes.data);
          setMessages(messagesRes.data);

          // Fetch documents if member
          try {
            const docsRes = await api.get(`/groupages/${id}/documents`);
            setDocuments(docsRes.data);
          } catch (e) {
            // User is not a member, documents not accessible
          }
        }
      } catch (error) {
        console.error('Error fetching groupage:', error);
        toast.error(t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isAuthenticated, t]);

  // Update pricing when quantity changes (utilisateurs connectes uniquement)
  useEffect(() => {
    if (quantity > 0 && id && isAuthenticated) {
      api.get(`/groupages/${id}/pricing?quantity=${quantity}`)
        .then(res => setPricing(res.data))
        .catch(console.error);
    }
  }, [quantity, id, isAuthenticated]);

  // WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !id || !wsToken) return;

    socketRef.current = io(BACKEND_URL, { path: SOCKET_PATH, auth: { token: wsToken } });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_room', { room_id: id });
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socketRef.current.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
    };
  }, [isAuthenticated, id, wsToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getLocalizedText = (item, field) => {
    if (!item) return '';
    return i18n.language === 'en' ? item[`${field}_en`] || item[field] : item[field];
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socketRef.current?.connected) return;

    socketRef.current.emit('send_message', {
      room_id: id,
      content: newMessage
    });
    
    setNewMessage('');
  };

  const handleJoinGroupage = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user.kyc_status !== 'validated') {
      toast.error(t('kyc.required'));
      return;
    }

    setJoining(true);
    try {
      await api.post(`/groupages/${id}/join`, { quantity });
      toast.success(i18n.language === 'fr' ? 'Groupage rejoint!' : 'Joined groupage!');

      const origin = window.location.origin;
      const paymentRes = await api.post('/payments/checkout', {
        groupage_id: id,
        payment_type: 'caution',
        origin_url: origin
      });

      window.location.href = paymentRes.data.url;
    } catch (error) {
      console.error('Join error:', error);
      toast.error(error.response?.data?.detail || t('common.error'));
    } finally {
      setJoining(false);
    }
  };

  const handleInviteAssociates = () => {
    const productName = i18n.language === 'fr' ? groupage.title : (groupage.title_en || groupage.title);
    const buyPrice = pricing?.groupage_price?.price_per_unit_fcfa;
    const resalePrice = groupage.suggested_resale_price_fcfa;
    const arrival = groupage.estimated_arrival
      ? new Date(groupage.estimated_arrival).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')
      : null;
    const link = window.location.href;

    const lines = i18n.language === 'fr'
      ? [
          `Rejoins mon groupage sur SilkRoute !`,
          `Produit : ${productName}`,
          buyPrice ? `Prix d'achat : ${formatPrice(buyPrice)} FCFA/unité` : null,
          resalePrice ? `Prix de vente conseillé : ${formatPrice(resalePrice)} FCFA/unité` : null,
          arrival ? `Arrivée estimée : ${arrival}` : null,
          `Rejoins le groupage ici : ${link}`
        ]
      : [
          `Join my groupage on SilkRoute!`,
          `Product: ${productName}`,
          buyPrice ? `Buying price: ${formatPrice(buyPrice)} FCFA/unit` : null,
          resalePrice ? `Suggested resale price: ${formatPrice(resalePrice)} FCFA/unit` : null,
          arrival ? `Estimated arrival: ${arrival}` : null,
          `Join the groupage here: ${link}`
        ];
    const message = lines.filter(Boolean).join('\n');

    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {});
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      navigator.clipboard?.writeText(message).catch(() => {});
      window.open(waUrl, '_blank');
      toast.success(i18n.language === 'fr' ? 'Message copié et WhatsApp ouvert' : 'Message copied and WhatsApp opened');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(price));
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        </div>
      </Layout>
    );
  }

  if (!groupage) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <p className="text-[#A1A1AA]">{t('common.error')}</p>
        </div>
      </Layout>
    );
  }

  const deadline = new Date(groupage.deadline);
  const daysLeft = Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)));
  const progress = (groupage.current_members / groupage.min_members) * 100;
  const isMember = members.some(m => m.user_id === user?.user_id);
  const remainingQuantity = groupage.total_quantity - (groupage.current_quantity_reserved || 0);

  return (
    <Layout>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16" data-testid="groupage-detail-page">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            {/* Product Image */}
            <div className="lg:col-span-2">
              <div className="h-80 bg-[#141414] rounded-lg overflow-hidden relative">
                {groupage.product_image_url ? (
                  <img 
                    src={groupage.product_image_url}
                    alt={getLocalizedText(groupage, 'title')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-24 h-24 text-[#2A2A2A]" />
                  </div>
                )}
                
                {/* Product URL Link */}
                {groupage.product_url && (
                  <a 
                    href={groupage.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 left-4 bg-[#0A0A0A]/90 backdrop-blur-sm px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-[#1A1A1A] transition-colors"
                    data-testid="product-url-link"
                  >
                    <LinkIcon className="w-4 h-4 text-[#D4AF37]" />
                    <span>{i18n.language === 'fr' ? 'Voir sur Alibaba' : 'View on Alibaba'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Info Card */}
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6">
              <span className="badge-success px-3 py-1 rounded-full text-xs font-medium inline-block mb-4">
                {t(`groupages.status.${groupage.status}`)}
              </span>
              
              <h1 className="font-['Bebas_Neue'] text-3xl mb-2">
                {getLocalizedText(groupage, 'title')}
              </h1>
              
              <p className="text-[#A1A1AA] text-sm mb-6">
                {getLocalizedText(groupage, 'description')}
              </p>

              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#A1A1AA]">
                    {groupage.current_members}/{groupage.min_members} {t('groupages.minMembers')}
                  </span>
                  <span className="text-[#D4AF37]">{Math.round(progress)}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#0A0A0A] rounded-lg p-4 text-center">
                  <Clock className="w-5 h-5 text-[#F97316] mx-auto mb-2" />
                  <p className="font-['Bebas_Neue'] text-2xl">{daysLeft}</p>
                  <p className="text-xs text-[#71717A]">{i18n.language === 'fr' ? 'jours restants' : 'days left'}</p>
                </div>
                <div className="bg-[#0A0A0A] rounded-lg p-4 text-center">
                  <Package className="w-5 h-5 text-[#22C55E] mx-auto mb-2" />
                  <p className="font-['Bebas_Neue'] text-2xl">{remainingQuantity}</p>
                  <p className="text-xs text-[#71717A]">{i18n.language === 'fr' ? 'unités dispo' : 'units left'}</p>
                </div>
              </div>

              {/* Quantity & Join */}
              {!isMember && groupage.status === 'open' && (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm text-[#A1A1AA] mb-2">
                      {i18n.language === 'fr' ? 'Quantité souhaitée' : 'Desired quantity'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={remainingQuantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(remainingQuantity, parseInt(e.target.value) || 1)))}
                      className="input-dark w-full px-4 py-2 rounded-md"
                      data-testid="quantity-input"
                    />
                  </div>
                  
                  {pricing && (
                    <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-lg p-3 mb-4">
                      <p className="text-sm text-[#A1A1AA] mb-1">
                        {i18n.language === 'fr' ? 'Votre prix groupage:' : 'Your groupage price:'}
                      </p>
                      <p className="font-['Bebas_Neue'] text-2xl text-[#D4AF37]">
                        {formatPrice(pricing.groupage_price?.total_fcfa || 0)} FCFA
                      </p>
                      <p className="text-xs text-[#22C55E]">
                        {i18n.language === 'fr' ? 'Économie' : 'Savings'}: {formatPrice(pricing.savings?.vs_solo_fcfa || 0)} FCFA ({pricing.savings?.vs_solo_percentage || 0}%)
                      </p>
                    </div>
                  )}

                  {pricing && pricing.groupage_price?.meets_minimum === false && (
                    <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-3 mb-4" data-testid="min-total-warning">
                      <p className="text-sm text-[#EF4444]">
                        {i18n.language === 'fr'
                          ? `Total minimum de ${pricing.groupage_price?.min_total_required_fcfa} FCFA non atteint (frais de service inclus). Quantité minimale requise : ${pricing.groupage_price?.min_quantity_needed}.`
                          : `Minimum total of ${pricing.groupage_price?.min_total_required_fcfa} FCFA not reached (service fee included). Minimum quantity required: ${pricing.groupage_price?.min_quantity_needed}.`}
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={handleJoinGroupage}
                    disabled={joining || (pricing && pricing.groupage_price?.meets_minimum === false)}
                    className="w-full btn-gold py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="join-groupage-btn"
                  >
                    {joining ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        {t('groupages.join')} - 5,000 FCFA
                      </>
                    )}
                  </button>
                </div>
              )}

              {isMember && (
                <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg p-4 text-center">
                  <CheckCircle className="w-6 h-6 text-[#22C55E] mx-auto mb-2" />
                  <p className="text-[#22C55E] font-medium mb-3">
                    {i18n.language === 'fr' ? 'Vous êtes membre' : 'You are a member'}
                  </p>
                  <button
                    onClick={handleInviteAssociates}
                    className="w-full btn-outline py-2 rounded-md font-medium flex items-center justify-center gap-2"
                    data-testid="invite-associates-btn"
                  >
                    <Share2 className="w-4 h-4" />
                    {i18n.language === 'fr' ? 'Inviter des associés' : 'Invite associates'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Supplier & Transitaire Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Supplier Card */}
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6" data-testid="supplier-card">
              <h3 className="font-['Bebas_Neue'] text-xl mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#D4AF37]" />
                {t('groupage.supplier')}
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Nom' : 'Name'}</span>
                  <span className="text-white font-medium">{groupage.supplier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">{t('groupage.location')}</span>
                  <span className="text-white">{groupage.supplier_location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">{t('groupage.rating')}</span>
                  <span className="text-white flex items-center gap-1">
                    <Star className="w-4 h-4 text-[#D4AF37] fill-[#D4AF37]" />
                    {groupage.supplier_rating}/5
                  </span>
                </div>
                <div className="flex gap-2 pt-2">
                  {groupage.supplier_gold_status && (
                    <span className="badge-gold px-2 py-1 rounded text-xs">{t('groupage.goldSupplier')}</span>
                  )}
                  {groupage.supplier_trade_assurance && (
                    <span className="badge-success px-2 py-1 rounded text-xs">{t('groupage.tradeAssurance')}</span>
                  )}
                  {groupage.supplier_documents_validated && (
                    <span className="badge-success px-2 py-1 rounded text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {i18n.language === 'fr' ? 'Docs vérifiés' : 'Docs verified'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Transitaire Card */}
            <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6" data-testid="transitaire-card">
              <h3 className="font-['Bebas_Neue'] text-xl mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#D4AF37]" />
                {t('groupage.transitaire')}
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Nom' : 'Name'}</span>
                  <span className="text-white font-medium">{groupage.transitaire_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">{t('groupage.location')}</span>
                  <span className="text-white">{groupage.transitaire_location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">{t('groupage.license')}</span>
                  <span className="text-white">{groupage.transitaire_license}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden" data-testid="tabs-section">
            {/* Tab Headers */}
            <div className="flex border-b border-[#2A2A2A] overflow-x-auto">
              {['comparator', 'chat', 'documents', 'members'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 min-w-[120px] px-4 py-4 text-center transition-colors whitespace-nowrap ${
                    activeTab === tab 
                      ? 'bg-[#1A1A1A] text-[#D4AF37] border-b-2 border-[#D4AF37]' 
                      : 'text-[#A1A1AA] hover:bg-[#1A1A1A]'
                  }`}
                  data-testid={`tab-${tab}`}
                >
                  {tab === 'comparator' && <Calculator className="w-4 h-4 inline mr-2" />}
                  {tab === 'chat' && <MessageCircle className="w-4 h-4 inline mr-2" />}
                  {tab === 'documents' && <FileText className="w-4 h-4 inline mr-2" />}
                  {tab === 'members' && <Users className="w-4 h-4 inline mr-2" />}
                  {tab === 'comparator' && (i18n.language === 'fr' ? 'Comparateur' : 'Comparator')}
                  {tab === 'chat' && t('groupage.chat')}
                  {tab === 'documents' && t('groupage.documents')}
                  {tab === 'members' && t('groupage.members')}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Comparator Tab */}
              {activeTab === 'comparator' && pricing && (
                <div data-testid="price-comparator">
                  {/* Quantity Selector */}
                  <div className="mb-6">
                    <label className="block text-sm text-[#A1A1AA] mb-2">
                      <Scale className="w-4 h-4 inline mr-2" />
                      {i18n.language === 'fr' ? 'Simuler pour une quantité de:' : 'Simulate for quantity:'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={groupage.total_quantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="input-dark w-32 px-4 py-2 rounded-md"
                    />
                    <span className="ml-2 text-[#71717A]">
                      {i18n.language === 'fr' ? 'unités' : 'units'}
                    </span>
                  </div>

                  {/* Price Comparison Cards */}
                  <div className="grid md:grid-cols-3 gap-6 mb-8">
                    {/* Solo Price */}
                    <div className="bg-[#0A0A0A] border border-[#EF4444]/30 rounded-lg p-6">
                      <h4 className="text-[#EF4444] font-medium mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        {i18n.language === 'fr' ? 'Commande SEUL' : 'Order ALONE'}
                      </h4>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Prix unitaire' : 'Unit price'}</span>
                          <span>{formatPrice(pricing.solo_price?.unit_price_fcfa)} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Sous-total' : 'Subtotal'} (×{quantity})</span>
                          <span>{formatPrice(pricing.solo_price?.subtotal_fcfa)} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Frais fixes' : 'Fixed fee'} (5 USD)</span>
                          <span>{formatPrice(pricing.solo_price?.solo_fee_fcfa)} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Transport' : 'Shipping'}</span>
                          <span>{formatPrice(pricing.solo_price?.transport_cost_fcfa)} FCFA</span>
                        </div>
                      </div>
                      <div className="border-t border-[#2A2A2A] pt-4">
                        <p className="font-['Bebas_Neue'] text-3xl text-[#EF4444]">
                          {formatPrice(pricing.solo_price?.total_fcfa)} FCFA
                        </p>
                        <p className="text-xs text-[#71717A]">
                          {formatPrice(pricing.solo_price?.price_per_unit_fcfa)} FCFA/{i18n.language === 'fr' ? 'unité' : 'unit'}
                        </p>
                      </div>
                    </div>

                    {/* Groupage Price (Highlighted) */}
                    <div className="bg-[#0A0A0A] border-2 border-[#D4AF37] rounded-lg p-6 gold-glow relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-[#0A0A0A] px-3 py-1 rounded-full text-xs font-semibold">
                        SilkRoute
                      </div>
                      <h4 className="text-[#D4AF37] font-medium mb-4 flex items-center gap-2 mt-2">
                        <Users className="w-5 h-5" />
                        GROUPAGE
                      </h4>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Votre part' : 'Your share'}</span>
                          <span>{pricing.groupage_price?.share_percentage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Part du prix total' : 'Share of total'}</span>
                          <span>{formatPrice(pricing.groupage_price?.member_share_fcfa)} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Frais SilkRoute' : 'SilkRoute fee'}</span>
                          <span>{formatPrice(pricing.groupage_price?.silkroute_fee_fcfa)} FCFA</span>
                        </div>
                      </div>
                      <div className="border-t border-[#D4AF37]/30 pt-4">
                        <p className="font-['Bebas_Neue'] text-4xl text-[#D4AF37]">
                          {formatPrice(pricing.groupage_price?.total_fcfa)} FCFA
                        </p>
                        <p className="text-xs text-[#71717A]">
                          {formatPrice(pricing.groupage_price?.price_per_unit_fcfa)} FCFA/{i18n.language === 'fr' ? 'unité' : 'unit'}
                        </p>
                      </div>
                    </div>

                    {/* Local Price */}
                    <div className="bg-[#0A0A0A] border border-[#F97316]/30 rounded-lg p-6">
                      <h4 className="text-[#F97316] font-medium mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        {i18n.language === 'fr' ? 'Grossiste LOCAL' : 'LOCAL Wholesaler'}
                      </h4>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Prix unitaire' : 'Unit price'}</span>
                          <span>{formatPrice(pricing.local_price?.unit_price_fcfa)} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#71717A]">{i18n.language === 'fr' ? 'Quantité' : 'Quantity'}</span>
                          <span>×{quantity}</span>
                        </div>
                      </div>
                      <div className="border-t border-[#2A2A2A] pt-4">
                        <p className="font-['Bebas_Neue'] text-3xl text-[#F97316]">
                          {formatPrice(pricing.local_price?.total_fcfa)} FCFA
                        </p>
                        <p className="text-xs text-[#71717A]">
                          {formatPrice(pricing.local_price?.unit_price_fcfa)} FCFA/{i18n.language === 'fr' ? 'unité' : 'unit'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Savings Summary */}
                  <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg p-6">
                    <h4 className="font-['Bebas_Neue'] text-xl text-[#22C55E] mb-4 flex items-center gap-2">
                      <TrendingDown className="w-5 h-5" />
                      {i18n.language === 'fr' ? 'VOS ÉCONOMIES AVEC SILKROUTE' : 'YOUR SAVINGS WITH SILKROUTE'}
                    </h4>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-[#A1A1AA] text-sm mb-1">
                          {i18n.language === 'fr' ? 'vs Commande seul' : 'vs Order alone'}
                        </p>
                        <p className="font-['Bebas_Neue'] text-3xl text-[#22C55E]">
                          {formatPrice(pricing.savings?.vs_solo_fcfa)} FCFA
                        </p>
                        <p className="text-sm text-[#22C55E]">
                          -{pricing.savings?.vs_solo_percentage}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[#A1A1AA] text-sm mb-1">
                          {i18n.language === 'fr' ? 'vs Grossiste local' : 'vs Local wholesaler'}
                        </p>
                        <p className="font-['Bebas_Neue'] text-3xl text-[#22C55E]">
                          {formatPrice(pricing.savings?.vs_local_fcfa)} FCFA
                        </p>
                        <p className="text-sm text-[#22C55E]">
                          -{pricing.savings?.vs_local_percentage}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'comparator' && !pricing && (
                <div className="text-center py-12" data-testid="price-comparator-locked">
                  <Calculator className="w-10 h-10 text-[#71717A] mx-auto mb-4" />
                  <p className="text-[#A1A1AA] mb-4">
                    {i18n.language === 'fr'
                      ? 'Connectez-vous pour voir le comparateur de prix detaille de ce groupage.'
                      : 'Sign in to see the detailed price comparator for this groupage.'}
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="btn-gold px-6 py-2 rounded-md"
                  >
                    {i18n.language === 'fr' ? 'Connexion' : 'Login'}
                  </button>
                </div>
              )}

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div>
                  {!isAuthenticated ? (
                    <div className="text-center py-8 text-[#71717A]">
                      {i18n.language === 'fr' ? 'Connectez-vous pour accéder au chat' : 'Login to access chat'}
                    </div>
                  ) : (
                    <>
                      <div className="h-80 overflow-y-auto mb-4 space-y-4">
                        {messages.length === 0 ? (
                          <div className="text-center text-[#71717A] py-8">
                            {i18n.language === 'fr' ? 'Aucun message' : 'No messages'}
                          </div>
                        ) : (
                          messages.map((msg, idx) => (
                            <div 
                              key={idx}
                              className={`chat-message ${msg.user_id === user?.user_id ? 'own' : 'other'}`}
                            >
                              <p className="text-xs text-[#71717A] mb-1">{msg.user_name}</p>
                              <p>{msg.content}</p>
                            </div>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder={i18n.language === 'fr' ? 'Votre message...' : 'Your message...'}
                          className="input-dark flex-1 px-4 py-3 rounded-md"
                          data-testid="chat-input"
                        />
                        <button
                          onClick={handleSendMessage}
                          className="btn-gold px-6 py-3 rounded-md"
                          data-testid="send-message-btn"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div>
                  {!isAuthenticated ? (
                    <div className="text-center py-8 text-[#71717A]">
                      {i18n.language === 'fr' ? 'Connectez-vous pour voir les documents' : 'Login to view documents'}
                    </div>
                  ) : !isMember && user?.role !== 'admin' ? (
                    <div className="text-center py-8 text-[#71717A]">
                      <FileText className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
                      {i18n.language === 'fr' 
                        ? 'Rejoignez le groupage pour accéder aux documents'
                        : 'Join the groupage to access documents'
                      }
                    </div>
                  ) : documents ? (
                    <div className="space-y-6">
                      {/* Supplier Documents */}
                      <div>
                        <h4 className="font-medium mb-4 flex items-center gap-2">
                          <Shield className="w-5 h-5 text-[#D4AF37]" />
                          {i18n.language === 'fr' ? 'Documents Fournisseur' : 'Supplier Documents'}
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4">
                          {documents.supplier_documents?.business_license_url && (
                            <DocumentLink
                              label={i18n.language === 'fr' ? 'Licence commerciale' : 'Business License'}
                              url={documents.supplier_documents.business_license_url}
                            />
                          )}
                          {documents.supplier_documents?.export_license_url && (
                            <DocumentLink
                              label={i18n.language === 'fr' ? "Licence d'export" : 'Export License'}
                              url={documents.supplier_documents.export_license_url}
                            />
                          )}
                          {documents.supplier_documents?.factory_audit_url && (
                            <DocumentLink
                              label={i18n.language === 'fr' ? 'Audit usine' : 'Factory Audit'}
                              url={documents.supplier_documents.factory_audit_url}
                            />
                          )}
                        </div>
                      </div>

                      {/* Logistics Documents */}
                      {documents.logistics_documents?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#D4AF37]" />
                            {i18n.language === 'fr' ? 'Documents Logistiques' : 'Logistics Documents'}
                          </h4>
                          <div className="grid md:grid-cols-2 gap-4">
                            {documents.logistics_documents.map((doc, idx) => (
                              <DocumentLink
                                key={idx}
                                label={doc.doc_type.toUpperCase()}
                                url={doc.url}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {!documents.logistics_documents?.length && (
                        <div className="text-center py-4 text-[#71717A] bg-[#0A0A0A] rounded-lg">
                          {i18n.language === 'fr' 
                            ? 'Documents logistiques disponibles après formation du groupe'
                            : 'Logistics documents available after group formation'
                          }
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-[#71717A]">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                    </div>
                  )}
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="space-y-3">
                  {members.length === 0 ? (
                    <div className="text-center py-8 text-[#71717A]">
                      {i18n.language === 'fr' ? 'Aucun membre encore' : 'No members yet'}
                    </div>
                  ) : (
                    members.map((member, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between bg-[#0A0A0A] rounded-lg p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#D4AF37]/10 rounded-full flex items-center justify-center">
                            <span className="text-[#D4AF37] font-medium">
                              {member.user_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{member.user_name}</p>
                            <p className="text-xs text-[#71717A]">
                              {member.quantity} {i18n.language === 'fr' ? 'unités' : 'units'} ({member.share_percentage}%)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.caution_paid && (
                            <span className="badge-success px-2 py-1 rounded text-xs">
                              {t('payment.caution')}
                            </span>
                          )}
                          {member.solde_paid && (
                            <span className="badge-gold px-2 py-1 rounded text-xs">
                              {t('payment.solde')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Document Link Component
const DocumentLink = ({ label, url }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-between bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-4 hover:border-[#D4AF37] transition-colors"
  >
    <div className="flex items-center gap-3">
      <FileText className="w-5 h-5 text-[#D4AF37]" />
      <span>{label}</span>
    </div>
    <Download className="w-4 h-4 text-[#71717A]" />
  </a>
);

export default GroupageDetailPage;
