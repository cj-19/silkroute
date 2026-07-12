import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import {
  LayoutDashboard, AlertTriangle, Package, Users, Shield,
  Plus, Check, X, Eye, ChevronRight, Loader2, Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const AdminPage = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const navItems = [
    { path: '/admin', label: t('admin.overview'), icon: LayoutDashboard },
    { path: '/admin/warnings', label: t('admin.warnings'), icon: AlertTriangle },
    { path: '/admin/groupages', label: t('admin.groupages'), icon: Package },
    { path: '/admin/proposals', label: i18n.language === 'fr' ? 'Propositions' : 'Proposals', icon: Lightbulb },
    { path: '/admin/kyc', label: t('admin.kyc'), icon: Shield }
  ];

  return (
    <Layout showFooter={false}>
      <div className="min-h-screen bg-[#0A0A0A]" data-testid="admin-page">
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-64 bg-[#141414] border-r border-[#2A2A2A] min-h-[calc(100vh-64px)] p-4 hidden md:block">
            <h2 className="font-['Bebas_Neue'] text-2xl mb-6 px-4">{t('admin.title')}</h2>
            <nav className="space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[#D4AF37] text-[#0A0A0A]'
                      : 'text-[#A1A1AA] hover:bg-[#1A1A1A]'
                  }`}
                  data-testid={`nav-${item.path.replace('/admin', '').replace('/', '') || 'overview'}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6">
            <Routes>
              <Route index element={<AdminOverview />} />
              <Route path="warnings" element={<AdminWarnings />} />
              <Route path="groupages" element={<AdminGroupages />} />
              <Route path="proposals" element={<AdminProposals />} />
              <Route path="kyc" element={<AdminKYC />} />
            </Routes>
          </main>
        </div>
      </div>
    </Layout>
  );
};

// Admin Overview Component
const AdminOverview = () => {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/admin/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-overview">
      <h1 className="font-['Bebas_Neue'] text-3xl mb-6">{t('admin.overview')}</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label={t('admin.totalUsers')} 
          value={stats?.total_users || 0} 
          color="#D4AF37"
          icon={Users}
        />
        <StatCard 
          label={t('admin.pendingKyc')} 
          value={stats?.pending_kyc || 0} 
          color="#F97316"
          icon={Shield}
        />
        <StatCard 
          label={t('admin.activeGroupages')} 
          value={stats?.active_groupages || 0} 
          color="#22C55E"
          icon={Package}
        />
        <StatCard 
          label={t('admin.totalRevenue')} 
          value={`€${stats?.total_revenue?.toFixed(2) || '0.00'}`} 
          color="#D4AF37"
          icon={LayoutDashboard}
        />
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color, icon: Icon }) => (
  <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6">
    <Icon className="w-8 h-8 mb-4" style={{ color }} />
    <p className="font-['Bebas_Neue'] text-4xl mb-1">{value}</p>
    <p className="text-sm text-[#71717A]">{label}</p>
  </div>
);

// Admin Warnings Component
const AdminWarnings = () => {
  const { t, i18n } = useTranslation();
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWarnings = async () => {
      try {
        const response = await api.get('/admin/warnings');
        setWarnings(response.data);
      } catch (error) {
        console.error('Error fetching warnings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWarnings();
  }, []);

  const severityColors = {
    high: 'badge-danger',
    medium: 'badge-warning',
    low: 'badge-gold'
  };

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-warnings">
      <h1 className="font-['Bebas_Neue'] text-3xl mb-6">{t('admin.warnings')}</h1>
      
      {warnings.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center">
          <Check className="w-12 h-12 text-[#22C55E] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">
            {i18n.language === 'fr' ? 'Aucune alerte' : 'No alerts'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {warnings.map((warning, idx) => (
            <div 
              key={idx}
              className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 flex items-center gap-4"
            >
              <AlertTriangle className={`w-6 h-6 ${
                warning.severity === 'high' ? 'text-[#EF4444]' : 
                warning.severity === 'medium' ? 'text-[#F97316]' : 'text-[#D4AF37]'
              }`} />
              <div className="flex-1">
                <p className="font-medium">{warning.message}</p>
                {warning.title && (
                  <p className="text-sm text-[#71717A]">{warning.title}</p>
                )}
              </div>
              <span className={`${severityColors[warning.severity]} px-3 py-1 rounded-full text-xs`}>
                {warning.severity}
              </span>
              {warning.groupage_id && (
                <Link
                  to={`/groupages/${warning.groupage_id}`}
                  className="btn-outline px-3 py-1.5 rounded text-sm"
                >
                  {i18n.language === 'fr' ? 'Voir' : 'View'}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin Groupages Component
const AdminGroupages = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [groupages, setGroupages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchGroupages();
  }, []);

  // Ouvre directement la modale pre-remplie si on arrive depuis "Creer un groupage"
  // sur l'onglet Propositions.
  useEffect(() => {
    if (location.state?.prefill) {
      setShowCreateModal(true);
    }
  }, [location.state]);

  const fetchGroupages = async () => {
    try {
      const response = await api.get('/groupages');
      setGroupages(response.data);
    } catch (error) {
      console.error('Error fetching groupages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-groupages">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-['Bebas_Neue'] text-3xl">{t('admin.groupages')}</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-gold px-4 py-2 rounded-md flex items-center gap-2"
          data-testid="create-groupage-btn"
        >
          <Plus className="w-5 h-5" />
          {t('admin.createGroupage')}
        </button>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden">
        <table className="table-dark">
          <thead>
            <tr>
              <th>{i18n.language === 'fr' ? 'Titre' : 'Title'}</th>
              <th>{i18n.language === 'fr' ? 'Statut' : 'Status'}</th>
              <th>{i18n.language === 'fr' ? 'Membres' : 'Members'}</th>
              <th>{i18n.language === 'fr' ? 'Deadline' : 'Deadline'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groupages.map(groupage => (
              <tr key={groupage.groupage_id}>
                <td>{groupage.title}</td>
                <td>
                  <span className={`badge-${groupage.status === 'open' ? 'success' : groupage.status === 'closed' ? 'warning' : 'gold'} px-2 py-1 rounded text-xs`}>
                    {t(`groupages.status.${groupage.status}`)}
                  </span>
                </td>
                <td>{groupage.current_members}/{groupage.min_members}</td>
                <td>{new Date(groupage.deadline).toLocaleDateString()}</td>
                <td>
                  <Link
                    to={`/groupages/${groupage.groupage_id}`}
                    className="text-[#D4AF37] hover:underline"
                  >
                    <Eye className="w-5 h-5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateGroupageModal
          initialData={location.state?.prefill}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchGroupages();
          }}
        />
      )}
    </div>
  );
};

// Create Groupage Modal
const CreateGroupageModal = ({ onClose, onCreated, initialData }) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [transitaires, setTransitaires] = useState([]);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    title_en: initialData?.title_en || '',
    description: '',
    description_en: '',
    product_category_id: initialData?.product_category_id || '',
    product_url: initialData?.product_url || '',
    product_image_url: '',
    supplier_name: '',
    supplier_location: 'Guangzhou, China',
    supplier_rating: 4.5,
    supplier_gold_status: true,
    supplier_trade_assurance: true,
    business_license_url: '',
    transitaire_id: '',
    unit_price_cny: 100,
    unit_weight_kg: 0.5,
    total_quantity: 100,
    total_order_price_cny: 10000,
    min_members: 5,
    max_members: 20,
    deadline: '',
    estimated_arrival: '',
    local_price_fcfa: 0,
    suggested_resale_price_fcfa: ''
  });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [catRes, transRes] = await Promise.all([
          api.get('/categories'),
          api.get('/transitaires')
        ]);
        setCategories(catRes.data);
        setTransitaires(transRes.data);
      } catch (error) {
        console.error('Error loading categories/transitaires:', error);
      }
    };
    loadOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.product_category_id || !formData.transitaire_id) {
      toast.error(i18n.language === 'fr'
        ? 'Sélectionnez une catégorie et un transitaire'
        : 'Select a category and a transitaire');
      return;
    }
    if (!formData.business_license_url) {
      toast.error(i18n.language === 'fr'
        ? 'La licence commerciale du fournisseur est obligatoire'
        : 'Supplier business license is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        title_en: formData.title_en,
        description: formData.description,
        description_en: formData.description_en,
        product_category_id: formData.product_category_id,
        product_url: formData.product_url,
        product_image_url: formData.product_image_url || null,
        supplier_name: formData.supplier_name,
        supplier_location: formData.supplier_location,
        supplier_rating: parseFloat(formData.supplier_rating),
        supplier_gold_status: formData.supplier_gold_status,
        supplier_trade_assurance: formData.supplier_trade_assurance,
        supplier_documents: {
          business_license_url: formData.business_license_url,
          export_license_url: null,
          product_certifications: [],
          factory_audit_url: null
        },
        transitaire_id: formData.transitaire_id,
        unit_price_cny: parseFloat(formData.unit_price_cny),
        unit_weight_kg: parseFloat(formData.unit_weight_kg),
        total_quantity: parseInt(formData.total_quantity),
        total_order_price_cny: parseFloat(formData.total_order_price_cny),
        min_members: parseInt(formData.min_members),
        max_members: parseInt(formData.max_members),
        deadline: new Date(formData.deadline).toISOString(),
        estimated_arrival: new Date(formData.estimated_arrival).toISOString(),
        local_price_fcfa: parseFloat(formData.local_price_fcfa),
        suggested_resale_price_fcfa: formData.suggested_resale_price_fcfa
          ? parseFloat(formData.suggested_resale_price_fcfa)
          : null
      };

      await api.post('/admin/groupages', payload);
      toast.success(i18n.language === 'fr' ? 'Groupage créé!' : 'Groupage created!');
      onCreated();
    } catch (error) {
      console.error('Error creating groupage:', error);
      toast.error(error.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#2A2A2A] flex justify-between items-center">
          <h2 className="font-['Bebas_Neue'] text-2xl">{t('admin.createGroupage')}</h2>
          <button onClick={onClose} className="text-[#71717A] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Titre (FR)</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
                data-testid="title-input"
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Title (EN)</label>
              <input
                type="text"
                value={formData.title_en}
                onChange={(e) => setFormData({...formData, title_en: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">Description (FR)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="input-dark w-full px-4 py-2 rounded-md h-20"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">Description (EN)</label>
            <textarea
              value={formData.description_en}
              onChange={(e) => setFormData({...formData, description_en: e.target.value})}
              className="input-dark w-full px-4 py-2 rounded-md h-20"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Catégorie' : 'Category'}
              </label>
              <select
                value={formData.product_category_id}
                onChange={(e) => setFormData({...formData, product_category_id: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
                data-testid="category-select"
              >
                <option value="">{i18n.language === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {i18n.language === 'fr' ? cat.name : cat.name_en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Transitaire' : 'Transitaire'}
              </label>
              <select
                value={formData.transitaire_id}
                onChange={(e) => setFormData({...formData, transitaire_id: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
                data-testid="transitaire-select"
              >
                <option value="">{i18n.language === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {transitaires.map(tr => (
                  <option key={tr.transitaire_id} value={tr.transitaire_id}>
                    {tr.name} ({tr.city}, {tr.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {i18n.language === 'fr' ? 'Lien produit (Alibaba/1688)' : 'Product link (Alibaba/1688)'}
            </label>
            <input
              type="url"
              value={formData.product_url}
              onChange={(e) => setFormData({...formData, product_url: e.target.value})}
              className="input-dark w-full px-4 py-2 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {i18n.language === 'fr' ? "Image produit (URL, optionnel)" : 'Product image (URL, optional)'}
            </label>
            <input
              type="url"
              value={formData.product_image_url}
              onChange={(e) => setFormData({...formData, product_image_url: e.target.value})}
              className="input-dark w-full px-4 py-2 rounded-md"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Supplier Name</label>
              <input
                type="text"
                value={formData.supplier_name}
                onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Supplier Location</label>
              <input
                type="text"
                value={formData.supplier_location}
                onChange={(e) => setFormData({...formData, supplier_location: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Supplier Rating (/5)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.supplier_rating}
                onChange={(e) => setFormData({...formData, supplier_rating: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <input
                type="checkbox"
                checked={formData.supplier_gold_status}
                onChange={(e) => setFormData({...formData, supplier_gold_status: e.target.checked})}
              />
              Gold Supplier
            </label>
            <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <input
                type="checkbox"
                checked={formData.supplier_trade_assurance}
                onChange={(e) => setFormData({...formData, supplier_trade_assurance: e.target.checked})}
              />
              Trade Assurance
            </label>
          </div>

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {i18n.language === 'fr' ? 'Licence commerciale fournisseur (URL, obligatoire)' : 'Supplier business license (URL, required)'}
            </label>
            <input
              type="url"
              value={formData.business_license_url}
              onChange={(e) => setFormData({...formData, business_license_url: e.target.value})}
              className="input-dark w-full px-4 py-2 rounded-md"
              required
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Unit Price (CNY)</label>
              <input
                type="number"
                value={formData.unit_price_cny}
                onChange={(e) => setFormData({...formData, unit_price_cny: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Unit Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_weight_kg}
                onChange={(e) => setFormData({...formData, unit_weight_kg: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Quantité totale commande' : 'Total order quantity'}
              </label>
              <input
                type="number"
                value={formData.total_quantity}
                onChange={(e) => setFormData({...formData, total_quantity: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Prix total commande (CNY)' : 'Total order price (CNY)'}
              </label>
              <input
                type="number"
                value={formData.total_order_price_cny}
                onChange={(e) => setFormData({...formData, total_order_price_cny: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Min Members</label>
              <input
                type="number"
                value={formData.min_members}
                onChange={(e) => setFormData({...formData, min_members: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Max Members</label>
              <input
                type="number"
                value={formData.max_members}
                onChange={(e) => setFormData({...formData, max_members: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Deadline</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Estimated Arrival</label>
              <input
                type="date"
                value={formData.estimated_arrival}
                onChange={(e) => setFormData({...formData, estimated_arrival: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Prix grossiste local (FCFA/unité)' : 'Local wholesaler price (FCFA/unit)'}
              </label>
              <input
                type="number"
                value={formData.local_price_fcfa}
                onChange={(e) => setFormData({...formData, local_price_fcfa: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Prix de vente conseillé (FCFA/unité, optionnel)' : 'Suggested resale price (FCFA/unit, optional)'}
              </label>
              <input
                type="number"
                value={formData.suggested_resale_price_fcfa}
                onChange={(e) => setFormData({...formData, suggested_resale_price_fcfa: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline px-6 py-3 rounded-md flex-1"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-gold px-6 py-3 rounded-md flex-1 flex items-center justify-center gap-2"
              data-testid="submit-groupage-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Admin KYC Component
const AdminKYC = () => {
  const { t, i18n } = useTranslation();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const response = await api.get('/admin/kyc/queue');
      setQueue(response.data);
    } catch (error) {
      console.error('Error fetching KYC queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKycAction = async (userId, status) => {
    try {
      await api.put(`/admin/kyc/${userId}`, { status });
      toast.success(i18n.language === 'fr' ? 'KYC mis à jour!' : 'KYC updated!');
      fetchQueue();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-kyc">
      <h1 className="font-['Bebas_Neue'] text-3xl mb-6">{t('admin.kyc')}</h1>

      {queue.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center">
          <Check className="w-12 h-12 text-[#22C55E] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">
            {i18n.language === 'fr' ? 'Aucune vérification en attente' : 'No pending verifications'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map(user => (
            <div 
              key={user.user_id}
              className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-sm text-[#71717A]">{user.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${user.kyc_status === 'pending' ? 'bg-[#F97316]/20 text-[#F97316]' : 'bg-[#D4AF37]/20 text-[#D4AF37]'}`}>
                    {user.kyc_status === 'pending'
                      ? (i18n.language === 'fr' ? 'Sans documents' : 'No documents')
                      : (i18n.language === 'fr' ? 'Documents soumis' : 'Documents submitted')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleKycAction(user.user_id, 'validated')}
                    className="btn-gold px-4 py-2 rounded-md flex items-center gap-2 text-sm"
                    data-testid={`approve-kyc-${user.user_id}`}
                  >
                    <Check className="w-4 h-4" />
                    {user.kyc_status === 'pending'
                      ? (i18n.language === 'fr' ? 'Valider sans documents' : 'Validate without documents')
                      : t('admin.approve')}
                  </button>
                  <button
                    onClick={() => handleKycAction(user.user_id, 'rejected')}
                    className="bg-[#EF4444] text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm"
                    data-testid={`reject-kyc-${user.user_id}`}
                  >
                    <X className="w-4 h-4" />
                    {t('admin.reject')}
                  </button>
                </div>
              </div>

              {/* KYC Documents Preview */}
              {user.kyc_documents && (
                <div className="grid grid-cols-3 gap-4">
                  {user.kyc_documents.id_front && (
                    <div>
                      <p className="text-xs text-[#71717A] mb-1">{t('onboarding.idFront')}</p>
                      <img 
                        src={user.kyc_documents.id_front} 
                        alt="ID Front"
                        className="w-full h-24 object-cover rounded-md"
                      />
                    </div>
                  )}
                  {user.kyc_documents.id_back && (
                    <div>
                      <p className="text-xs text-[#71717A] mb-1">{t('onboarding.idBack')}</p>
                      <img 
                        src={user.kyc_documents.id_back} 
                        alt="ID Back"
                        className="w-full h-24 object-cover rounded-md"
                      />
                    </div>
                  )}
                  {user.kyc_documents.selfie && (
                    <div>
                      <p className="text-xs text-[#71717A] mb-1">{t('onboarding.selfie')}</p>
                      <img 
                        src={user.kyc_documents.selfie} 
                        alt="Selfie"
                        className="w-full h-24 object-cover rounded-md"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin Proposals Component
const AdminProposals = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const response = await api.get('/proposals', { params: filter ? { status: filter } : {} });
      setProposals(response.data);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (proposalId, status) => {
    try {
      await api.put(`/admin/proposals/${proposalId}`, { status });
      toast.success(i18n.language === 'fr' ? 'Proposition mise à jour!' : 'Proposal updated!');
      fetchProposals();
    } catch (error) {
      toast.error(i18n.language === 'fr' ? 'Erreur' : 'Error');
    }
  };

  const handleCreateGroupageFromProposal = (proposal) => {
    navigate('/admin/groupages', {
      state: {
        prefill: {
          title: proposal.title,
          title_en: proposal.title,
          product_url: proposal.product_url,
          product_category_id: proposal.category_id || ''
        }
      }
    });
  };

  const statusFilters = ['pending', 'approved', 'featured', 'rejected'];
  const statusColors = {
    pending: 'badge-warning',
    approved: 'badge-success',
    featured: 'badge-gold',
    rejected: 'badge-danger'
  };

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-proposals">
      <h1 className="font-['Bebas_Neue'] text-3xl mb-2">
        {i18n.language === 'fr' ? 'Propositions des membres' : 'Member proposals'}
      </h1>
      <p className="text-[#71717A] text-sm mb-6">
        {i18n.language === 'fr'
          ? "Produits proposes par les membres. Les propositions similaires sont regroupees : le nombre d'interesses aide a prioriser."
          : 'Products proposed by members. Similar proposals are merged: the interested count helps prioritize.'}
      </p>

      <div className="flex gap-2 mb-6">
        {statusFilters.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              filter === s ? 'bg-[#D4AF37] text-[#0A0A0A]' : 'bg-[#1A1A1A] text-[#A1A1AA] hover:bg-[#2A2A2A]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {proposals.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center">
          <Lightbulb className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">
            {i18n.language === 'fr' ? 'Aucune proposition dans ce statut' : 'No proposals in this status'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map(p => (
            <div key={p.proposal_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <span className={`${statusColors[p.status]} px-2 py-0.5 rounded text-xs shrink-0`}>
                      {p.status}
                    </span>
                  </div>
                  <a
                    href={p.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#D4AF37] hover:underline break-all"
                  >
                    {p.product_url}
                  </a>
                  {p.description && (
                    <p className="text-sm text-[#71717A] mt-1">{p.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#71717A]">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {p.interested_count || 1} {i18n.language === 'fr' ? 'interesse(s)' : 'interested'}
                    </span>
                    <span>{i18n.language === 'fr' ? 'Propose par' : 'Proposed by'} {p.user_name}</span>
                    {p.estimated_unit_price_cny && (
                      <span>{p.estimated_unit_price_cny} CNY/{i18n.language === 'fr' ? 'unité' : 'unit'}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {p.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(p.proposal_id, 'approved')}
                        className="btn-gold px-3 py-1.5 rounded-md text-xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {i18n.language === 'fr' ? 'Valider' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleStatusChange(p.proposal_id, 'rejected')}
                        className="bg-[#EF4444] text-white px-3 py-1.5 rounded-md text-xs flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        {i18n.language === 'fr' ? 'Rejeter' : 'Reject'}
                      </button>
                    </>
                  )}
                  {p.status !== 'rejected' && (
                    <button
                      onClick={() => handleCreateGroupageFromProposal(p)}
                      className="btn-outline px-3 py-1.5 rounded-md text-xs flex items-center gap-1"
                    >
                      <Package className="w-3.5 h-3.5" />
                      {i18n.language === 'fr' ? 'Créer un groupage' : 'Create groupage'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
