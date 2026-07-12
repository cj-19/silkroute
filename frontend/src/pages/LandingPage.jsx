import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { 
  ArrowRight, 
  Package, 
  Users, 
  Truck, 
  CheckCircle,
  Star,
  Shield,
  Clock,
  TrendingDown,
  Calculator,
  Loader2
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const [groupages, setGroupages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroupages = async () => {
      try {
        const response = await axios.get(`${API}/groupages?status=open&limit=3`);
        setGroupages(response.data);
      } catch (error) {
        console.error('Error fetching groupages:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroupages();
  }, []);

  const getLocalizedText = (item, field) => {
    return i18n.language === 'en' ? item[`${field}_en`] || item[field] : item[field];
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden"
        data-testid="hero-section"
        data-theme-fixed
      >
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/6462829/pexels-photo-6462829.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/90 via-[#0A0A0A]/70 to-[#0A0A0A]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-['Bebas_Neue'] text-6xl md:text-8xl lg:text-[10rem] leading-none tracking-tighter text-white mb-2">
              {t('hero.title')}
            </h1>
            <h1 className="font-['Bebas_Neue'] text-6xl md:text-8xl lg:text-[10rem] leading-none tracking-tighter text-[#D4AF37] mb-8">
              {t('hero.title2')}
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl md:text-2xl text-[#A1A1AA] max-w-3xl mx-auto mb-12"
          >
            {t('hero.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/groupages"
              className="btn-gold px-8 py-4 rounded-md text-lg font-semibold flex items-center justify-center gap-2 gold-glow-hover"
              data-testid="hero-cta"
            >
              {t('hero.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#how-it-works"
              className="btn-outline px-8 py-4 rounded-md text-lg font-semibold"
              data-testid="hero-cta-secondary"
            >
              {t('hero.cta2')}
            </a>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-[#A1A1AA] rounded-full flex justify-center pt-2">
            <div className="w-1 h-3 bg-[#D4AF37] rounded-full" />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-[#0A0A0A]" data-testid="how-it-works-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-['Bebas_Neue'] text-4xl md:text-5xl text-center mb-16">
            {t('howItWorks.title')}
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Package, step: 'step1', color: '#D4AF37' },
              { icon: Users, step: 'step2', color: '#22C55E' },
              { icon: Truck, step: 'step3', color: '#F97316' },
              { icon: CheckCircle, step: 'step4', color: '#D4AF37' }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 hover:-translate-y-1 transition-transform"
                data-testid={`step-${index + 1}`}
              >
                <div 
                  className="w-14 h-14 rounded-lg flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${item.color}20` }}
                >
                  <item.icon className="w-7 h-7" style={{ color: item.color }} />
                </div>
                <h3 className="font-['Bebas_Neue'] text-2xl mb-3">
                  {t(`howItWorks.${item.step}.title`)}
                </h3>
                <p className="text-[#A1A1AA] leading-relaxed">
                  {t(`howItWorks.${item.step}.desc`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Savings Comparator Section */}
      <section className="py-24 bg-[#141414]" data-testid="savings-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-['Bebas_Neue'] text-4xl md:text-5xl text-center mb-4">
            {t('savings.title')}
          </h2>
          <p className="text-[#A1A1AA] text-center mb-16 max-w-2xl mx-auto">
            {i18n.language === 'fr' 
              ? "Exemple: Lot de 100 smartphones Android"
              : "Example: Lot of 100 Android smartphones"
            }
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Local Wholesaler */}
            <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-8 text-center">
              <p className="text-[#A1A1AA] mb-2">{t('savings.local')}</p>
              <p className="font-['Bebas_Neue'] text-4xl text-[#EF4444] mb-4">85,000 FCFA</p>
              <p className="text-sm text-[#71717A]">{t('savings.perUnit')}</p>
            </div>

            {/* SilkRoute */}
            <div className="bg-[#0A0A0A] border-2 border-[#D4AF37] rounded-lg p-8 text-center relative gold-glow">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-[#0A0A0A] px-4 py-1 rounded-full text-sm font-semibold">
                SilkRoute
              </div>
              <p className="text-[#A1A1AA] mb-2 mt-2">{t('savings.silkroute')}</p>
              <p className="font-['Bebas_Neue'] text-5xl text-[#D4AF37] mb-4">52,000 FCFA</p>
              <p className="text-sm text-[#71717A]">{t('savings.perUnit')}</p>
              <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
                <p className="text-[#22C55E] font-semibold flex items-center justify-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  {t('savings.savings')} 33,000 FCFA
                </p>
              </div>
            </div>

            {/* Alibaba Alone */}
            <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-8 text-center">
              <p className="text-[#A1A1AA] mb-2">{t('savings.alibaba')}</p>
              <p className="font-['Bebas_Neue'] text-4xl text-[#F97316] mb-4">72,000 FCFA</p>
              <p className="text-sm text-[#71717A]">{t('savings.perUnit')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Simulation Widget Section */}
      <SimulationWidget />

      {/* Active Groupages Section */}
      <section className="py-24 bg-[#0A0A0A]" data-testid="groupages-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <h2 className="font-['Bebas_Neue'] text-4xl md:text-5xl">
              {t('groupages.title')}
            </h2>
            <Link 
              to="/groupages" 
              className="text-[#D4AF37] hover:text-[#B3922E] flex items-center gap-2"
              data-testid="view-all-groupages"
            >
              {t('common.viewAll')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-16 text-[#A1A1AA]">
              {t('common.loading')}
            </div>
          ) : groupages.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#A1A1AA] mb-6">{t('groupages.empty')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {groupages.map((groupage, index) => (
                <GroupageCard 
                  key={groupage.groupage_id} 
                  groupage={groupage}
                  index={index}
                  getLocalizedText={getLocalizedText}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-16 bg-[#141414] border-t border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: Shield, label: i18n.language === 'fr' ? 'Paiement sécurisé' : 'Secure payment', value: 'Stripe' },
              { icon: Star, label: i18n.language === 'fr' ? 'Fournisseurs vérifiés' : 'Verified suppliers', value: 'Gold Supplier' },
              { icon: Clock, label: i18n.language === 'fr' ? 'Suivi en temps réel' : 'Real-time tracking', value: '24/7' },
              { icon: Users, label: i18n.language === 'fr' ? 'Marchands satisfaits' : 'Satisfied merchants', value: '500+' }
            ].map((badge, index) => (
              <div key={index} className="flex flex-col items-center">
                <badge.icon className="w-8 h-8 text-[#D4AF37] mb-3" />
                <p className="font-['Bebas_Neue'] text-2xl mb-1">{badge.value}</p>
                <p className="text-sm text-[#A1A1AA]">{badge.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

// Simulation Widget Component
const SimulationWidget = () => {
  const { i18n } = useTranslation();
  const [unitPrice, setUnitPrice] = useState('');
  const [weight, setWeight] = useState('0.5');
  const [quantity, setQuantity] = useState('10');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    if (!unitPrice || parseFloat(unitPrice) <= 0) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/simulate`, {
        unit_price_cny: parseFloat(unitPrice),
        unit_weight_kg: parseFloat(weight) || 0.5,
        quantity: parseInt(quantity) || 1
      });
      setResult(response.data);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(price));
  };

  return (
    <section className="py-24 bg-[#0A0A0A]" data-testid="simulation-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="bg-[#141414] border-2 border-[#D4AF37] rounded-2xl p-8 gold-glow"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <h2 className="font-['Bebas_Neue'] text-3xl md:text-4xl mb-2">
              {i18n.language === 'fr' ? 'SIMULEZ VOS ÉCONOMIES' : 'SIMULATE YOUR SAVINGS'}
            </h2>
            <p className="text-[#A1A1AA]">
              {i18n.language === 'fr' 
                ? 'Entrez les détails de votre produit et découvrez combien vous économisez avec SilkRoute'
                : 'Enter your product details and discover how much you save with SilkRoute'
              }
            </p>
          </div>

          {/* Input Form */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Prix unitaire (CNY)' : 'Unit price (CNY)'}
              </label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="ex: 950"
                className="input-dark w-full px-4 py-3 rounded-md"
                data-testid="sim-price-input"
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Poids unitaire (kg)' : 'Unit weight (kg)'}
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="ex: 0.5"
                step="0.1"
                className="input-dark w-full px-4 py-3 rounded-md"
                data-testid="sim-weight-input"
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Quantité souhaitée' : 'Desired quantity'}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="ex: 10"
                className="input-dark w-full px-4 py-3 rounded-md"
                data-testid="sim-quantity-input"
              />
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={loading || !unitPrice}
            className="w-full btn-gold py-4 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50 mb-8"
            data-testid="sim-calculate-btn"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Calculator className="w-5 h-5" />
                {i18n.language === 'fr' ? 'CALCULER MES ÉCONOMIES' : 'CALCULATE MY SAVINGS'}
              </>
            )}
          </button>

          {/* Results */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-[#2A2A2A] pt-8"
            >
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Solo Price */}
                <div className="bg-[#0A0A0A] border border-[#EF4444]/30 rounded-lg p-6">
                  <p className="text-[#EF4444] font-medium mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {i18n.language === 'fr' ? 'Commande SEUL' : 'Order ALONE'}
                  </p>
                  <p className="font-['Bebas_Neue'] text-3xl text-[#EF4444]">
                    {formatPrice(result.estimated_solo_price_fcfa)} FCFA
                  </p>
                </div>

                {/* Groupage Price */}
                <div className="bg-[#0A0A0A] border-2 border-[#D4AF37] rounded-lg p-6">
                  <p className="text-[#D4AF37] font-medium mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    GROUPAGE SilkRoute
                  </p>
                  <p className="font-['Bebas_Neue'] text-3xl text-[#D4AF37]">
                    {formatPrice(result.estimated_groupage_price_fcfa)} FCFA
                  </p>
                </div>
              </div>

              {/* Savings Banner */}
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg p-6 text-center">
                <p className="text-[#A1A1AA] text-sm mb-2">
                  {i18n.language === 'fr' ? 'VOUS ÉCONOMISEZ' : 'YOU SAVE'}
                </p>
                <p className="font-['Bebas_Neue'] text-4xl text-[#22C55E] mb-1">
                  {formatPrice(result.savings_amount_fcfa)} FCFA
                </p>
                <p className="text-[#22C55E] font-semibold flex items-center justify-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  -{result.savings_percentage}%
                </p>
                <p className="text-xs text-[#71717A] mt-4">
                  {result.note}
                </p>
              </div>

              {/* CTA */}
              <Link
                to="/groupages"
                className="block w-full btn-gold py-4 rounded-md text-center font-semibold mt-6"
                data-testid="sim-cta-btn"
              >
                {i18n.language === 'fr' ? 'VOIR LES GROUPAGES DISPONIBLES' : 'VIEW AVAILABLE GROUPAGES'}
                <ArrowRight className="w-5 h-5 inline ml-2" />
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

// Groupage Card Component
const GroupageCard = ({ groupage, index, getLocalizedText }) => {
  const { t, i18n } = useTranslation();
  
  const deadline = new Date(groupage.deadline);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
  const spotsLeft = groupage.max_members - groupage.current_members;
  const progress = (groupage.current_members / groupage.min_members) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="card-ticket"
      data-testid={`groupage-card-${groupage.groupage_id}`}
    >
      {/* Product Image */}
      <div className="h-48 bg-[#1A1A1A] relative">
        {groupage.product_image_url ? (
          <img 
            src={groupage.product_image_url} 
            alt={getLocalizedText(groupage, 'title')}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-[#2A2A2A]" />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span className="badge-success px-3 py-1 rounded-full text-xs font-medium">
            {t('groupages.status.open')}
          </span>
        </div>
      </div>

      {/* Dashed separator */}
      <div className="border-t border-dashed border-[#2A2A2A] mx-4" />

      {/* Content */}
      <div className="p-6">
        <h3 className="font-['Bebas_Neue'] text-2xl mb-2">
          {getLocalizedText(groupage, 'title')}
        </h3>
        
        <p className="text-[#A1A1AA] text-sm mb-4 line-clamp-2">
          {getLocalizedText(groupage, 'description')}
        </p>

        {/* Progress */}
        <div className="mb-4">
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
        <div className="flex justify-between text-sm mb-6">
          <div className="flex items-center gap-1 text-[#F97316]">
            <Clock className="w-4 h-4" />
            <span>{daysLeft} {i18n.language === 'fr' ? 'jours' : 'days'}</span>
          </div>
          <div className="text-[#22C55E]">
            {spotsLeft} {t('groupages.spotsLeft')}
          </div>
        </div>

        {/* CTA */}
        <Link
          to={`/groupages/${groupage.groupage_id}`}
          className="block w-full btn-gold py-3 rounded-md text-center font-semibold"
          data-testid={`view-groupage-${groupage.groupage_id}`}
        >
          {t('groupages.viewDetails')}
        </Link>
      </div>
    </motion.div>
  );
};

export default LandingPage;
