import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import {
  LayoutDashboard, AlertTriangle, Package, Users, Shield,
  Plus, Check, X, Eye, ChevronRight, Loader2, Lightbulb,
  Truck, Factory, KeyRound, Pencil, Copy, RefreshCw
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
    { path: '/admin/kyc', label: t('admin.kyc'), icon: Shield },
    { path: '/admin/transitaires', label: i18n.language === 'fr' ? 'Transitaires' : 'Forwarders', icon: Truck },
    { path: '/admin/suppliers', label: i18n.language === 'fr' ? 'Fournisseurs' : 'Suppliers', icon: Factory },
    { path: '/admin/accounts', label: i18n.language === 'fr' ? 'Comptes partenaires' : 'Partner accounts', icon: KeyRound }
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
              <Route path="transitaires" element={<AdminTransitaires />} />
              <Route path="suppliers" element={<AdminSuppliers />} />
              <Route path="accounts" element={<AdminPartnerAccounts />} />
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
  const [suppliers, setSuppliers] = useState([]);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    title_en: initialData?.title_en || '',
    description: '',
    description_en: '',
    product_category_id: initialData?.product_category_id || '',
    product_url: initialData?.product_url || '',
    product_image_url: '',
    supplier_id: '',
    supplier_name: '',
    supplier_location: 'Guangzhou, China',
    supplier_rating: 4.5,
    supplier_gold_status: true,
    supplier_trade_assurance: true,
    business_license_url: '',
    transitaire_id: '',
    shipping_option_id: '',
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
        const [catRes, transRes, supRes] = await Promise.all([
          api.get('/categories'),
          api.get('/transitaires'),
          api.get('/admin/suppliers?active_only=true')
        ]);
        setCategories(catRes.data);
        setTransitaires(transRes.data);
        setSuppliers(supRes.data);
      } catch (error) {
        console.error('Error loading categories/transitaires:', error);
      }
    };
    loadOptions();
  }, []);

  // Options de transport au kg du transitaire selectionne (le comparateur de prix
  // des groupages ne supporte pas encore la facturation au CBM).
  const selectedTransitaire = transitaires.find(tr => tr.transitaire_id === formData.transitaire_id);
  const kgOptions = (selectedTransitaire?.shipping_options || []).filter(o => o.unit === 'kg' && o.is_active !== false);
  const legacyTransitaire = selectedTransitaire && !(selectedTransitaire.shipping_options || []).length
    && selectedTransitaire.shipping_price_per_kg_cny != null;

  // Selection d'une fiche fournisseur : pre-remplit les champs fournisseur du groupage
  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    if (supplier) {
      setFormData(prev => ({
        ...prev,
        supplier_id: supplierId,
        supplier_name: supplier.name,
        supplier_location: supplier.location,
        supplier_rating: supplier.rating ?? 4.5,
        supplier_gold_status: !!supplier.gold_status,
        supplier_trade_assurance: !!supplier.trade_assurance
      }));
    } else {
      setFormData(prev => ({ ...prev, supplier_id: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.product_category_id || !formData.transitaire_id) {
      toast.error(i18n.language === 'fr'
        ? 'Sélectionnez une catégorie et un transitaire'
        : 'Select a category and a transitaire');
      return;
    }
    if (kgOptions.length > 0 && !formData.shipping_option_id) {
      toast.error(i18n.language === 'fr'
        ? 'Sélectionnez une option de transport'
        : 'Select a shipping option');
      return;
    }
    if (selectedTransitaire && kgOptions.length === 0 && !legacyTransitaire) {
      toast.error(i18n.language === 'fr'
        ? "Ce transitaire n'a aucune option de transport au kg — ajoutez-en une dans l'onglet Transitaires."
        : 'This forwarder has no per-kg shipping option — add one in the Forwarders tab.');
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
        supplier_id: formData.supplier_id || null,
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
        shipping_option_id: formData.shipping_option_id || null,
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
                onChange={(e) => setFormData({...formData, transitaire_id: e.target.value, shipping_option_id: ''})}
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

          {/* Option de transport du transitaire selectionne */}
          {formData.transitaire_id && kgOptions.length > 0 && (
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Option de transport' : 'Shipping option'}
              </label>
              <select
                value={formData.shipping_option_id}
                onChange={(e) => setFormData({...formData, shipping_option_id: e.target.value})}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
                data-testid="shipping-option-select"
              >
                <option value="">{i18n.language === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {kgOptions.map(opt => (
                  <option key={opt.option_id} value={opt.option_id}>
                    {opt.label} — {new Intl.NumberFormat('fr-FR').format(opt.price_fcfa)} FCFA/kg ({opt.eta_min_days}-{opt.eta_max_days}j)
                  </option>
                ))}
              </select>
            </div>
          )}
          {formData.transitaire_id && kgOptions.length === 0 && !legacyTransitaire && (
            <p className="text-sm text-[#F97316]">
              {i18n.language === 'fr'
                ? "⚠ Ce transitaire n'a pas d'option de transport au kg. Ajoutez-en une dans l'onglet Transitaires."
                : '⚠ This forwarder has no per-kg shipping option. Add one in the Forwarders tab.'}
            </p>
          )}

          {/* Fiche fournisseur (optionnel) : pre-remplit les champs et permet au
              fournisseur de suivre ce groupage depuis son espace partenaire */}
          {suppliers.length > 0 && (
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Fiche fournisseur (optionnel, pour l\'espace fournisseur)' : 'Supplier record (optional, for supplier portal)'}
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-md"
                data-testid="supplier-link-select"
              >
                <option value="">{i18n.language === 'fr' ? '-- Aucune (saisie manuelle) --' : '-- None (manual entry) --'}</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>{s.name} ({s.location})</option>
                ))}
              </select>
            </div>
          )}

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

// ============ Admin Transitaires ============

const EMPTY_OPTION = { label: '', mode: 'air', price_fcfa: '', unit: 'kg', eta_min_days: '', eta_max_days: '', is_active: true };

const AdminTransitaires = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [transitaires, setTransitaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | transitaire object

  const fetchTransitaires = async () => {
    try {
      const response = await api.get('/transitaires?active_only=false');
      setTransitaires(response.data);
    } catch (error) {
      console.error('Error fetching transitaires:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransitaires();
  }, []);

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-transitaires">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-['Bebas_Neue'] text-3xl">{fr ? 'Transitaires' : 'Forwarders'}</h1>
        <button
          onClick={() => setEditing('new')}
          className="btn-gold px-4 py-2 rounded-md flex items-center gap-2"
          data-testid="create-transitaire-btn"
        >
          <Plus className="w-5 h-5" />
          {fr ? 'Ajouter un transitaire' : 'Add forwarder'}
        </button>
      </div>

      {transitaires.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center">
          <Truck className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">{fr ? 'Aucun transitaire enregistré' : 'No forwarder yet'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transitaires.map(tr => (
            <div key={tr.transitaire_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{tr.name}</h3>
                    {!tr.is_active && (
                      <span className="badge-danger px-2 py-0.5 rounded text-xs">{fr ? 'Inactif' : 'Inactive'}</span>
                    )}
                  </div>
                  <p className="text-sm text-[#71717A]">
                    {tr.city}, {tr.country} · {fr ? 'Licence' : 'License'}: {tr.license_number}
                    {tr.contact_phone && ` · ${tr.contact_phone}`}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(tr)}
                  className="btn-outline px-3 py-1.5 rounded-md text-sm flex items-center gap-1 shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  {fr ? 'Modifier' : 'Edit'}
                </button>
              </div>

              {/* Options de transport */}
              {(tr.shipping_options || []).length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
                  {tr.shipping_options.map((opt, idx) => (
                    <div key={idx} className={`bg-[#0A0A0A] border rounded-md p-3 ${opt.is_active ? 'border-[#2A2A2A]' : 'border-[#EF4444]/30 opacity-60'}`}>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="font-['Bebas_Neue'] text-xl text-[#D4AF37]">
                        {new Intl.NumberFormat('fr-FR').format(opt.price_fcfa)} FCFA/{opt.unit}
                      </p>
                      <p className="text-xs text-[#71717A]">
                        {opt.mode === 'air' ? (fr ? 'Aérien' : 'Air') : (fr ? 'Maritime' : 'Sea')} · {opt.eta_min_days}-{opt.eta_max_days} {fr ? 'jours' : 'days'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#F97316]">
                  {fr ? "⚠ Aucune option de transport — ajoutez-en pour pouvoir créer des groupages avec ce transitaire."
                      : '⚠ No shipping option — add some to create groupages with this forwarder.'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TransitaireModal
          transitaire={editing === 'new' ? null : editing}
          fr={fr}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchTransitaires();
          }}
        />
      )}
    </div>
  );
};

const TransitaireModal = ({ transitaire, fr, onClose, onSaved }) => {
  const isNew = !transitaire;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: transitaire?.name || '',
    city: transitaire?.city || '',
    country: transitaire?.country || '',
    license_number: transitaire?.license_number || '',
    contact_phone: transitaire?.contact_phone || '',
    contact_email: transitaire?.contact_email || '',
    website: transitaire?.website || '',
    is_active: transitaire?.is_active !== false
  });
  const [options, setOptions] = useState(
    (transitaire?.shipping_options || []).map(o => ({ ...o }))
  );

  const updateOption = (idx, field, value) => {
    setOptions(prev => prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanedOptions = options
      .filter(o => o.label.trim() && o.price_fcfa !== '' && o.eta_min_days !== '' && o.eta_max_days !== '')
      .map(o => ({
        ...(o.option_id ? { option_id: o.option_id } : {}),
        label: o.label,
        mode: o.mode,
        price_fcfa: parseFloat(o.price_fcfa),
        unit: o.unit,
        eta_min_days: parseInt(o.eta_min_days),
        eta_max_days: parseInt(o.eta_max_days),
        is_active: o.is_active !== false
      }));

    const payload = {
      name: form.name,
      city: form.city,
      country: form.country,
      license_number: form.license_number,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      website: form.website || null,
      shipping_options: cleanedOptions,
      is_active: form.is_active
    };

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/admin/transitaires', payload);
      } else {
        await api.put(`/admin/transitaires/${transitaire.transitaire_id}`, payload);
      }
      toast.success(fr ? 'Transitaire enregistré!' : 'Forwarder saved!');
      onSaved();
    } catch (error) {
      console.error('Error saving transitaire:', error);
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#2A2A2A] flex justify-between items-center">
          <h2 className="font-['Bebas_Neue'] text-2xl">
            {isNew ? (fr ? 'Nouveau transitaire' : 'New forwarder') : (fr ? 'Modifier le transitaire' : 'Edit forwarder')}
          </h2>
          <button onClick={onClose} className="text-[#71717A] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Nom' : 'Name'} *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required data-testid="transitaire-name-input" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'N° de licence' : 'License number'} *</label>
              <input type="text" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Ville' : 'City'} *</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Pays' : 'Country'} *</label>
              <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Téléphone' : 'Phone'}</label>
              <input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" placeholder="+86 ..." />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Site web' : 'Website'}</label>
              <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" placeholder="https://..." />
            </div>
          </div>

          {/* Options de transport */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-[#A1A1AA]">
                {fr ? 'Options de transport (prix en FCFA)' : 'Shipping options (prices in FCFA)'}
              </label>
              <button
                type="button"
                onClick={() => setOptions([...options, { ...EMPTY_OPTION }])}
                className="btn-outline px-3 py-1 rounded-md text-xs flex items-center gap-1"
                data-testid="add-option-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                {fr ? 'Ajouter une option' : 'Add option'}
              </button>
            </div>

            {options.length === 0 && (
              <p className="text-xs text-[#71717A] mb-2">
                {fr ? 'Ex: Aérien normal 8 997 FCFA/kg (7-15j), Aérien express 10 997 FCFA/kg (2-3j), Maritime 349 500 FCFA/cbm (45-60j)...'
                    : 'E.g.: Normal air 8,997 FCFA/kg (7-15d), Express air 10,997 FCFA/kg (2-3d), Sea 349,500 FCFA/cbm (45-60d)...'}
              </p>
            )}

            <div className="space-y-3">
              {options.map((opt, idx) => (
                <div key={idx} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-md p-3 grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs text-[#71717A] mb-1">{fr ? 'Nom' : 'Label'}</label>
                    <input type="text" value={opt.label} onChange={(e) => updateOption(idx, 'label', e.target.value)}
                      className="input-dark w-full px-3 py-1.5 rounded-md text-sm" placeholder={fr ? 'Aérien normal' : 'Normal air'} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#71717A] mb-1">Mode</label>
                    <select value={opt.mode} onChange={(e) => updateOption(idx, 'mode', e.target.value)}
                      className="input-dark w-full px-2 py-1.5 rounded-md text-sm">
                      <option value="air">{fr ? 'Aérien' : 'Air'}</option>
                      <option value="sea">{fr ? 'Maritime' : 'Sea'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#71717A] mb-1">{fr ? 'Prix FCFA' : 'Price FCFA'}</label>
                    <input type="number" value={opt.price_fcfa} onChange={(e) => updateOption(idx, 'price_fcfa', e.target.value)}
                      className="input-dark w-full px-3 py-1.5 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#71717A] mb-1">{fr ? 'Unité' : 'Unit'}</label>
                    <select value={opt.unit} onChange={(e) => updateOption(idx, 'unit', e.target.value)}
                      className="input-dark w-full px-2 py-1.5 rounded-md text-sm">
                      <option value="kg">/kg</option>
                      <option value="cbm">/CBM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#71717A] mb-1">{fr ? 'Délai min (j)' : 'ETA min (d)'}</label>
                    <input type="number" value={opt.eta_min_days} onChange={(e) => updateOption(idx, 'eta_min_days', e.target.value)}
                      className="input-dark w-full px-3 py-1.5 rounded-md text-sm" />
                  </div>
                  <div className="flex items-end gap-1">
                    <div className="flex-1">
                      <label className="block text-xs text-[#71717A] mb-1">{fr ? 'Délai max (j)' : 'ETA max (d)'}</label>
                      <input type="number" value={opt.eta_max_days} onChange={(e) => updateOption(idx, 'eta_max_days', e.target.value)}
                        className="input-dark w-full px-3 py-1.5 rounded-md text-sm" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      className="text-[#EF4444] hover:bg-[#EF4444]/10 rounded p-1.5 mb-0.5"
                      title={fr ? 'Supprimer' : 'Remove'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#71717A] mt-2">
              {fr ? 'Note : seules les options au kg peuvent être utilisées dans le comparateur de prix des groupages. Les options au CBM restent affichées à titre informatif.'
                  : 'Note: only per-kg options can feed the groupage price comparator. CBM options remain informational.'}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            {fr ? 'Transitaire actif' : 'Active forwarder'}
          </label>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="btn-outline px-6 py-3 rounded-md flex-1">
              {fr ? 'Annuler' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving}
              className="btn-gold px-6 py-3 rounded-md flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="save-transitaire-btn">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (fr ? 'Enregistrer' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============ Admin Suppliers ============

const AdminSuppliers = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/admin/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-suppliers">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-['Bebas_Neue'] text-3xl">{fr ? 'Fournisseurs' : 'Suppliers'}</h1>
        <button
          onClick={() => setEditing('new')}
          className="btn-gold px-4 py-2 rounded-md flex items-center gap-2"
          data-testid="create-supplier-btn"
        >
          <Plus className="w-5 h-5" />
          {fr ? 'Ajouter un fournisseur' : 'Add supplier'}
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center">
          <Factory className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">
            {fr ? 'Aucune fiche fournisseur. Créez-en une pour pouvoir lier un fournisseur à un groupage et lui ouvrir un accès.'
                : 'No supplier yet. Create one to link it to groupages and give it portal access.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {suppliers.map(s => (
            <div key={s.supplier_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{s.name}</h3>
                    {!s.is_active && <span className="badge-danger px-2 py-0.5 rounded text-xs">{fr ? 'Inactif' : 'Inactive'}</span>}
                  </div>
                  <p className="text-sm text-[#71717A]">{s.location}</p>
                  <div className="flex gap-2 mt-1">
                    {s.gold_status && <span className="badge-gold px-2 py-0.5 rounded text-xs">Gold</span>}
                    {s.trade_assurance && <span className="badge-success px-2 py-0.5 rounded text-xs">Trade Assurance</span>}
                    <span className="text-xs text-[#71717A]">★ {s.rating}/5</span>
                  </div>
                </div>
                <button onClick={() => setEditing(s)} className="btn-outline px-3 py-1.5 rounded-md text-sm flex items-center gap-1 shrink-0">
                  <Pencil className="w-4 h-4" />
                  {fr ? 'Modifier' : 'Edit'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SupplierModal
          supplier={editing === 'new' ? null : editing}
          fr={fr}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchSuppliers();
          }}
        />
      )}
    </div>
  );
};

const SupplierModal = ({ supplier, fr, onClose, onSaved }) => {
  const isNew = !supplier;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: supplier?.name || '',
    location: supplier?.location || 'Guangzhou, China',
    contact_phone: supplier?.contact_phone || '',
    contact_email: supplier?.contact_email || '',
    rating: supplier?.rating ?? 4.5,
    gold_status: supplier?.gold_status || false,
    trade_assurance: supplier?.trade_assurance || false,
    notes: supplier?.notes || '',
    is_active: supplier?.is_active !== false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      rating: parseFloat(form.rating),
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      notes: form.notes || null
    };

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/admin/suppliers', payload);
      } else {
        await api.put(`/admin/suppliers/${supplier.supplier_id}`, payload);
      }
      toast.success(fr ? 'Fournisseur enregistré!' : 'Supplier saved!');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#2A2A2A] flex justify-between items-center">
          <h2 className="font-['Bebas_Neue'] text-2xl">
            {isNew ? (fr ? 'Nouveau fournisseur' : 'New supplier') : (fr ? 'Modifier le fournisseur' : 'Edit supplier')}
          </h2>
          <button onClick={onClose} className="text-[#71717A] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Nom' : 'Name'} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" required data-testid="supplier-name-input" />
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Localisation' : 'Location'} *</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" required />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Téléphone' : 'Phone'}</label>
              <input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Note (/5)</label>
              <input type="number" step="0.1" min="0" max="5" value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <input type="checkbox" checked={form.gold_status} onChange={(e) => setForm({ ...form, gold_status: e.target.checked })} />
              Gold Supplier
            </label>
            <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <input type="checkbox" checked={form.trade_assurance} onChange={(e) => setForm({ ...form, trade_assurance: e.target.checked })} />
              Trade Assurance
            </label>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Notes internes' : 'Internal notes'}</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md h-20" />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            {fr ? 'Fournisseur actif' : 'Active supplier'}
          </label>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="btn-outline px-6 py-3 rounded-md flex-1">
              {fr ? 'Annuler' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving}
              className="btn-gold px-6 py-3 rounded-md flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="save-supplier-btn">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (fr ? 'Enregistrer' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============ Admin Partner Accounts ============

const AdminPartnerAccounts = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [accounts, setAccounts] = useState([]);
  const [transitaires, setTransitaires] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tempCredentials, setTempCredentials] = useState(null); // {email, temp_password}
  const [resettingId, setResettingId] = useState(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'transitaire', entity_id: '' });

  const fetchAll = async () => {
    try {
      const [accRes, trRes, supRes] = await Promise.all([
        api.get('/admin/partner-accounts'),
        api.get('/transitaires?active_only=false'),
        api.get('/admin/suppliers')
      ]);
      setAccounts(accRes.data);
      setTransitaires(trRes.data);
      setSuppliers(supRes.data);
    } catch (error) {
      console.error('Error fetching partner accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const entities = form.role === 'transitaire' ? transitaires : suppliers;
  const entityIdKey = form.role === 'transitaire' ? 'transitaire_id' : 'supplier_id';

  const entityName = (account) => {
    if (account.role === 'transitaire') {
      return transitaires.find(t => t.transitaire_id === account.entity_id)?.name || account.entity_id;
    }
    return suppliers.find(s => s.supplier_id === account.entity_id)?.name || account.entity_id;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text)
      .then(() => toast.success(fr ? 'Copié!' : 'Copied!'))
      .catch(() => {});
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.entity_id) {
      toast.error(fr ? 'Sélectionnez la fiche à relier' : 'Select the linked entity');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/admin/partner-accounts', form);
      setTempCredentials({ email: response.data.email, temp_password: response.data.temp_password });
      setForm({ email: '', name: '', role: 'transitaire', entity_id: '' });
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async (userId, email) => {
    setResettingId(userId);
    try {
      const response = await api.post(`/admin/partner-accounts/${userId}/reset-password`);
      setTempCredentials({ email, temp_password: response.data.temp_password });
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setResettingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-accounts">
      <h1 className="font-['Bebas_Neue'] text-3xl mb-2">{fr ? 'Comptes partenaires' : 'Partner accounts'}</h1>
      <p className="text-[#71717A] text-sm mb-6">
        {fr ? "Créez des accès pour vos transitaires et fournisseurs. Le mot de passe provisoire ne s'affiche qu'une seule fois — transmettez-le au partenaire, il devra le changer à sa première connexion."
            : 'Create access for your forwarders and suppliers. The temporary password is shown only once — send it to the partner; they must change it at first login.'}
      </p>

      {/* Mot de passe provisoire affiche une seule fois */}
      {tempCredentials && (
        <div className="bg-[#D4AF37]/10 border border-[#D4AF37] rounded-lg p-4 mb-6" data-testid="temp-password-box">
          <p className="text-sm text-[#D4AF37] font-medium mb-2">
            {fr ? '⚠ Notez ces identifiants maintenant — le mot de passe ne sera plus jamais affiché.'
                : '⚠ Save these credentials now — the password will never be shown again.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="bg-[#0A0A0A] px-3 py-1.5 rounded text-sm">{tempCredentials.email}</code>
            <code className="bg-[#0A0A0A] px-3 py-1.5 rounded text-sm font-bold">{tempCredentials.temp_password}</code>
            <button
              onClick={() => copyToClipboard(`${fr ? 'Identifiants SilkRoute' : 'SilkRoute credentials'}\nEmail: ${tempCredentials.email}\n${fr ? 'Mot de passe provisoire' : 'Temporary password'}: ${tempCredentials.temp_password}\n${window.location.origin}/login`)}
              className="btn-outline px-3 py-1.5 rounded-md text-sm flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              {fr ? 'Copier' : 'Copy'}
            </button>
            <button onClick={() => setTempCredentials(null)} className="text-[#71717A] hover:text-white ml-auto">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Formulaire de creation */}
      <form onSubmit={handleCreate} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6 mb-8">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#D4AF37]" />
          {fr ? 'Créer un compte' : 'Create account'}
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Rôle' : 'Role'}</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value, entity_id: '' })}
              className="input-dark w-full px-4 py-2 rounded-md"
              data-testid="account-role-select"
            >
              <option value="transitaire">{fr ? 'Transitaire' : 'Forwarder'}</option>
              <option value="supplier">{fr ? 'Fournisseur' : 'Supplier'}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {fr ? 'Fiche à relier' : 'Linked entity'}
            </label>
            <select
              value={form.entity_id}
              onChange={(e) => setForm({ ...form, entity_id: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md"
              required
              data-testid="account-entity-select"
            >
              <option value="">-- {fr ? 'Choisir' : 'Select'} --</option>
              {entities.map(ent => (
                <option key={ent[entityIdKey]} value={ent[entityIdKey]}>{ent.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Nom du contact' : 'Contact name'}</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" required data-testid="account-name-input" />
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" required data-testid="account-email-input" />
          </div>
        </div>
        {entities.length === 0 && (
          <p className="text-xs text-[#F97316] mt-3">
            {fr ? `Créez d'abord une fiche ${form.role === 'transitaire' ? 'transitaire' : 'fournisseur'} dans l'onglet correspondant.`
                : `Create a ${form.role} record first in the corresponding tab.`}
          </p>
        )}
        <button
          type="submit"
          disabled={creating || entities.length === 0}
          className="btn-gold px-6 py-2.5 rounded-md mt-4 flex items-center gap-2 disabled:opacity-50"
          data-testid="create-account-btn"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {fr ? 'Créer et générer le mot de passe' : 'Create and generate password'}
        </button>
      </form>

      {/* Liste des comptes */}
      {accounts.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-8 text-center">
          <KeyRound className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
          <p className="text-[#A1A1AA]">{fr ? 'Aucun compte partenaire' : 'No partner account yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <div key={account.user_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{account.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-xs ${account.role === 'transitaire' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-[#22C55E]/20 text-[#22C55E]'}`}>
                    {account.role === 'transitaire' ? (fr ? 'Transitaire' : 'Forwarder') : (fr ? 'Fournisseur' : 'Supplier')}
                  </span>
                  {account.must_change_password && (
                    <span className="badge-warning px-2 py-0.5 rounded text-xs">
                      {fr ? 'Mdp provisoire' : 'Temp password'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#71717A] truncate">
                  {account.email} · {fr ? 'Lié à' : 'Linked to'}: {entityName(account)}
                </p>
              </div>
              <button
                onClick={() => handleReset(account.user_id, account.email)}
                disabled={resettingId === account.user_id}
                className="btn-outline px-3 py-1.5 rounded-md text-sm flex items-center gap-1 shrink-0 disabled:opacity-50"
                title={fr ? 'Régénérer un mot de passe provisoire' : 'Regenerate temporary password'}
              >
                {resettingId === account.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {fr ? 'Réinit. mdp' : 'Reset pwd'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
