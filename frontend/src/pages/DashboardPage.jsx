import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { toast } from 'sonner';
import {
  Package, FileText, Clock, CheckCircle, AlertCircle,
  ChevronRight, Download, CreditCard, Lightbulb, Users, Loader2
} from 'lucide-react';
import { api } from '@/lib/api';

const DashboardPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [groupages, setGroupages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('groupages');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/user/groupages');
        setGroupages(response.data);
      } catch (error) {
        console.error('Error fetching user groupages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getLocalizedText = (item, field) => {
    return i18n.language === 'en' ? item[`${field}_en`] || item[field] : item[field];
  };

  const kycStatusColors = {
    pending: 'badge-warning',
    submitted: 'badge-gold',
    validated: 'badge-success',
    rejected: 'badge-danger'
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16" data-testid="dashboard-page">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="font-['Bebas_Neue'] text-4xl mb-1">
                {t('dashboard.title')}
              </h1>
              <p className="text-[#A1A1AA]">
                {i18n.language === 'fr' ? `Bonjour, ${user?.name}` : `Hello, ${user?.name}`}
              </p>
            </div>
            
            {/* KYC Status Badge */}
            <div className={`${kycStatusColors[user?.kyc_status]} px-4 py-2 rounded-lg flex items-center gap-2`}>
              {user?.kyc_status === 'validated' && <CheckCircle className="w-4 h-4" />}
              {user?.kyc_status === 'pending' && <Clock className="w-4 h-4" />}
              {user?.kyc_status === 'submitted' && <Clock className="w-4 h-4" />}
              {user?.kyc_status === 'rejected' && <AlertCircle className="w-4 h-4" />}
              <span className="font-medium">KYC: {t(`kyc.${user?.kyc_status}`)}</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Package}
              label={i18n.language === 'fr' ? 'Groupages actifs' : 'Active groupages'}
              value={groupages.filter(g => g.status === 'open').length}
              color="#D4AF37"
            />
            <StatCard
              icon={CheckCircle}
              label={i18n.language === 'fr' ? 'Complétés' : 'Completed'}
              value={groupages.filter(g => g.status === 'completed').length}
              color="#22C55E"
            />
            <StatCard
              icon={CreditCard}
              label={i18n.language === 'fr' ? 'Cautions payées' : 'Deposits paid'}
              value={groupages.filter(g => g.membership?.caution_paid).length}
              color="#F97316"
            />
            <StatCard
              icon={FileText}
              label={i18n.language === 'fr' ? 'Documents' : 'Documents'}
              value={0}
              color="#A1A1AA"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-[#2A2A2A] pb-4">
            {['groupages', 'proposals', 'history', 'documents'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-[#D4AF37] text-[#0A0A0A]'
                    : 'bg-[#1A1A1A] text-[#A1A1AA] hover:bg-[#2A2A2A]'
                }`}
                data-testid={`tab-${tab}`}
              >
                {tab === 'proposals'
                  ? (i18n.language === 'fr' ? 'Mes propositions' : 'My proposals')
                  : t(`dashboard.${tab === 'groupages' ? 'myGroupages' : tab}`)}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-16 text-[#A1A1AA]">
              {t('common.loading')}
            </div>
          ) : (
            <>
              {/* My Groupages Tab */}
              {activeTab === 'groupages' && (
                <div>
                  {groupages.length === 0 ? (
                    <div className="text-center py-16 bg-[#141414] rounded-lg border border-[#2A2A2A]">
                      <Package className="w-16 h-16 text-[#2A2A2A] mx-auto mb-4" />
                      <p className="text-[#A1A1AA] mb-6">{t('dashboard.noGroupages')}</p>
                      <Link
                        to="/groupages"
                        className="btn-gold px-6 py-3 rounded-md inline-flex items-center gap-2"
                        data-testid="explore-groupages-btn"
                      >
                        {t('dashboard.exploreGroupages')}
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupages.map(groupage => (
                        <GroupageRow 
                          key={groupage.groupage_id}
                          groupage={groupage}
                          getLocalizedText={getLocalizedText}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Proposals Tab */}
              {activeTab === 'proposals' && <ProposalsTab />}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="text-center py-16 bg-[#141414] rounded-lg border border-[#2A2A2A]">
                  <Clock className="w-16 h-16 text-[#2A2A2A] mx-auto mb-4" />
                  <p className="text-[#A1A1AA]">
                    {i18n.language === 'fr' ? 'Aucun historique pour le moment' : 'No history yet'}
                  </p>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="text-center py-16 bg-[#141414] rounded-lg border border-[#2A2A2A]">
                  <FileText className="w-16 h-16 text-[#2A2A2A] mx-auto mb-4" />
                  <p className="text-[#A1A1AA]">
                    {i18n.language === 'fr' ? 'Aucun document disponible' : 'No documents available'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
    <Icon className="w-6 h-6 mb-2" style={{ color }} />
    <p className="font-['Bebas_Neue'] text-3xl">{value}</p>
    <p className="text-sm text-[#71717A]">{label}</p>
  </div>
);

const GroupageRow = ({ groupage, getLocalizedText }) => {
  const { t, i18n } = useTranslation();
  
  const statusColors = {
    open: 'badge-success',
    closed: 'badge-warning',
    completed: 'badge-gold'
  };

  return (
    <div 
      className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      data-testid={`groupage-row-${groupage.groupage_id}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-[#1A1A1A] rounded-lg flex items-center justify-center flex-shrink-0">
          {groupage.product_image_url ? (
            <img 
              src={groupage.product_image_url}
              alt={getLocalizedText(groupage, 'title')}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <Package className="w-8 h-8 text-[#2A2A2A]" />
          )}
        </div>
        <div>
          <h3 className="font-semibold">{getLocalizedText(groupage, 'title')}</h3>
          <p className="text-sm text-[#71717A]">
            {i18n.language === 'fr' ? 'Quantité' : 'Quantity'}: {groupage.membership?.quantity || 1}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className={`${statusColors[groupage.status]} px-3 py-1 rounded-full text-xs`}>
          {t(`groupages.status.${groupage.status}`)}
        </span>
        
        <div className="flex gap-2">
          {groupage.membership?.caution_paid && (
            <span className="badge-success px-2 py-1 rounded text-xs">
              {t('payment.caution')}
            </span>
          )}
          {groupage.membership?.solde_paid && (
            <span className="badge-gold px-2 py-1 rounded text-xs">
              {t('payment.solde')}
            </span>
          )}
        </div>

        <Link
          to={`/groupages/${groupage.groupage_id}`}
          className="btn-outline px-4 py-2 rounded-md text-sm flex items-center gap-1"
        >
          {t('groupages.viewDetails')}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

// Propose a product tab: submit a new proposal (an admin will review it and turn
// it into a real groupage) and see the ones you've proposed or shown interest in.
const ProposalsTab = () => {
  const { i18n } = useTranslation();
  const [proposals, setProposals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    product_url: '',
    description: '',
    estimated_unit_price_cny: '',
    category_id: ''
  });

  const fetchProposals = async () => {
    try {
      const response = await api.get('/proposals');
      setProposals(response.data);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
    api.get('/categories').then(res => setCategories(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.product_url.trim()) {
      toast.error(i18n.language === 'fr' ? 'Titre et lien produit requis' : 'Title and product link required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/proposals', {
        title: form.title,
        product_url: form.product_url,
        description: form.description || null,
        estimated_unit_price_cny: form.estimated_unit_price_cny ? parseFloat(form.estimated_unit_price_cny) : null,
        category_id: form.category_id || null
      });

      if (response.data.merged) {
        toast.success(i18n.language === 'fr'
          ? `Une proposition similaire existait deja : votre interet a ete ajoute (${response.data.interested_count} interesses).`
          : `A similar proposal already existed: your interest was added (${response.data.interested_count} interested).`);
      } else {
        toast.success(i18n.language === 'fr' ? 'Proposition envoyee, en attente de validation.' : 'Proposal sent, pending review.');
      }

      setForm({ title: '', product_url: '', description: '', estimated_unit_price_cny: '', category_id: '' });
      setShowForm(false);
      fetchProposals();
    } catch (error) {
      toast.error(error.response?.data?.detail || (i18n.language === 'fr' ? 'Erreur' : 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = {
    pending: 'badge-warning',
    approved: 'badge-success',
    featured: 'badge-gold',
    rejected: 'badge-danger'
  };

  return (
    <div data-testid="proposals-tab">
      <div className="flex justify-between items-center mb-6">
        <p className="text-[#A1A1AA] text-sm max-w-xl">
          {i18n.language === 'fr'
            ? "Vous avez repere un produit interessant ? Proposez-le : si un autre membre l'a deja propose, votre interet y sera simplement ajoute."
            : "Spotted an interesting product? Propose it: if another member already did, your interest will simply be added to it."}
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-gold px-4 py-2 rounded-md whitespace-nowrap"
          data-testid="propose-product-btn"
        >
          {i18n.language === 'fr' ? 'Proposer un produit' : 'Propose a product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {i18n.language === 'fr' ? 'Titre du produit' : 'Product title'}
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md"
              required
              data-testid="proposal-title-input"
            />
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {i18n.language === 'fr' ? 'Lien produit (Alibaba/1688)' : 'Product link (Alibaba/1688)'}
            </label>
            <input
              type="url"
              value={form.product_url}
              onChange={(e) => setForm({ ...form, product_url: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md"
              required
              data-testid="proposal-url-input"
            />
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {i18n.language === 'fr' ? 'Description (optionnel)' : 'Description (optional)'}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md h-20"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Prix unitaire estime (CNY, optionnel)' : 'Estimated unit price (CNY, optional)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={form.estimated_unit_price_cny}
                onChange={(e) => setForm({ ...form, estimated_unit_price_cny: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Catégorie (optionnel)' : 'Category (optional)'}
              </label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md"
              >
                <option value="">{i18n.language === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {i18n.language === 'fr' ? cat.name : cat.name_en}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-gold px-6 py-3 rounded-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="submit-proposal-btn"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (i18n.language === 'fr' ? 'Envoyer' : 'Submit')}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-[#A1A1AA]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-16 bg-[#141414] rounded-lg border border-[#2A2A2A]">
          <Lightbulb className="w-16 h-16 text-[#2A2A2A] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">
            {i18n.language === 'fr' ? "Vous n'avez encore propose aucun produit" : "You haven't proposed any product yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <div key={p.proposal_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{p.title}</h4>
                  <span className={`${statusColors[p.status]} px-2 py-0.5 rounded text-xs shrink-0`}>{p.status}</span>
                </div>
                <p className="text-xs text-[#71717A] flex items-center gap-1 mt-1">
                  <Users className="w-3.5 h-3.5" />
                  {p.interested_count || 1} {i18n.language === 'fr' ? 'interesse(s)' : 'interested'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
