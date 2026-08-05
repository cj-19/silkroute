import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { useSeo } from '@/hooks/useSeo';
import {
  LayoutDashboard, AlertTriangle, Package, Users, Shield,
  Plus, Check, X, Eye, ChevronRight, Loader2, Lightbulb,
  Truck, Factory, KeyRound, Pencil, Copy, RefreshCw, MapPin,
  Image as ImageIcon, FileText, Trash2, ExternalLink, Rocket, HelpCircle, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import ImageDropZone from '@/components/ImageDropZone';
// Les blocs de suivi sont partages avec le portail transitaire : meme UI,
// seule la route appelee change (basePath).
import { PHASES, phaseLabel, PhaseUpdateSection, DocumentUploadSection } from '@/pages/PartnerPage';

const AdminPage = () => {
  useSeo({ title: 'Administration | SilkRoute', path: '/admin', noindex: true });

  const location = useLocation();
  const { t, i18n } = useTranslation();

  const navItems = [
    { path: '/admin', label: t('admin.overview'), icon: LayoutDashboard },
    { path: '/admin/warnings', label: t('admin.warnings'), icon: AlertTriangle },
    { path: '/admin/groupages', label: t('admin.groupages'), icon: Package },
    { path: '/admin/tracking', label: i18n.language === 'fr' ? 'Suivi & documents' : 'Tracking & documents', icon: Truck },
    { path: '/admin/treasury', label: i18n.language === 'fr' ? 'Trésorerie' : 'Treasury', icon: Wallet },
    { path: '/admin/proposals', label: i18n.language === 'fr' ? 'Propositions' : 'Proposals', icon: Lightbulb },
    { path: '/admin/kyc', label: t('admin.kyc'), icon: Shield },
    { path: '/admin/users', label: i18n.language === 'fr' ? 'Utilisateurs' : 'Users', icon: Users },
    { path: '/admin/transitaires', label: i18n.language === 'fr' ? 'Transitaires' : 'Forwarders', icon: Truck },
    { path: '/admin/suppliers', label: i18n.language === 'fr' ? 'Fournisseurs' : 'Suppliers', icon: Factory },
    { path: '/admin/accounts', label: i18n.language === 'fr' ? 'Comptes partenaires' : 'Partner accounts', icon: KeyRound },
    { path: '/admin/content', label: i18n.language === 'fr' ? 'Contenu & SEO' : 'Content & SEO', icon: FileText }
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
              <Route path="tracking" element={<AdminTracking />} />
              <Route path="treasury" element={<AdminTreasury />} />
              <Route path="proposals" element={<AdminProposals />} />
              <Route path="kyc" element={<AdminKYC />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="transitaires" element={<AdminTransitaires />} />
              <Route path="suppliers" element={<AdminSuppliers />} />
              <Route path="accounts" element={<AdminPartnerAccounts />} />
              <Route path="content" element={<AdminContent />} />
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

// ============================================================
// TRESORERIE
// ============================================================
const FCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA';

const FLOW_ACCOUNTS = ['tara', 'reasy', 'stripe', 'cash', 'bank', 'other'];
const ACCOUNT_LABELS = {
  tara: 'Tara Money', reasy: 'REasy', stripe: 'Stripe',
  cash: 'Espèces', bank: 'Banque', other: 'Autre'
};
const FLOW_CATEGORIES = [
  'member_payment', 'refund', 'supplier_payment', 'freight_payment',
  'customs_duty', 'operating_expense', 'other_income'
];
const CATEGORY_LABELS = {
  member_payment: 'Paiement membre', refund: 'Remboursement',
  supplier_payment: 'Paiement fournisseur', freight_payment: 'Paiement transitaire',
  customs_duty: 'Douane', operating_expense: 'Frais de fonctionnement',
  other_income: 'Autre entrée'
};
// Categories qui sont, par nature, des entrees d'argent
const INCOMING_CATEGORIES = ['member_payment', 'other_income'];

const AdminTreasury = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [vue, setVue] = useState('flux'); // flux | groupages | membres
  const [data, setData] = useState({ flows: [], summary: {} });
  const [summary, setSummary] = useState(null);
  const [parGroupage, setParGroupage] = useState([]);
  const [parMembre, setParMembre] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtres, setFiltres] = useState({
    direction: '', account: '', category: '', groupage_id: '', date_from: '', date_to: ''
  });

  const chargerFlux = async () => {
    const params = new URLSearchParams(
      Object.entries(filtres).filter(([, v]) => v)
    ).toString();
    try {
      const res = await api.get(`/admin/cash-flows${params ? `?${params}` : ''}`);
      setData(res.data);
    } catch (e) {
      toast.error(fr ? 'Chargement des flux impossible' : 'Failed to load flows');
    }
  };

  const chargerTout = async () => {
    setLoading(true);
    await Promise.all([
      chargerFlux(),
      api.get('/admin/treasury/summary').then(r => setSummary(r.data)).catch(() => {}),
      api.get('/admin/treasury/groupages').then(r => setParGroupage(r.data)).catch(() => {}),
      api.get('/admin/treasury/members').then(r => setParMembre(r.data)).catch(() => {}),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    chargerTout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) chargerFlux();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres]);

  const supprimerFlux = async (flow) => {
    if (!window.confirm(fr
      ? `Supprimer ce mouvement de ${FCFA(flow.amount_fcfa)} ? Cette action est définitive.`
      : `Delete this ${FCFA(flow.amount_fcfa)} entry? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/cash-flows/${flow.flow_id}`);
      toast.success(fr ? 'Mouvement supprimé' : 'Entry deleted');
      chargerTout();
    } catch (e) {
      toast.error(e.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    }
  };

  const s = data.summary || {};
  const dormantTotal = parGroupage.reduce((acc, g) => acc + (g.idle_fcfa || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-treasury">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="font-['Bebas_Neue'] text-4xl">{fr ? 'Trésorerie' : 'Treasury'}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn-gold px-4 py-2 rounded-md flex items-center gap-2"
          data-testid="add-flow-btn"
        >
          <Plus className="w-4 h-4" />
          {fr ? 'Saisir un mouvement' : 'Add entry'}
        </button>
      </div>
      <p className="text-[#A1A1AA] mb-6">
        {fr
          ? "Tous les flux entrants et sortants, et où dorment les fonds de chaque groupage. Les paiements en ligne s'inscrivent seuls ; les versements REasy et encaissements hors site se saisissent ici."
          : 'All money in and out, and where each groupage\'s funds are sitting. Online payments record themselves; REasy transfers and off-site collections are entered here.'}
      </p>

      {/* Cartes de synthese */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={fr ? 'Entrées confirmées' : 'Confirmed in'} value={FCFA(s.in_confirmed)} color="#22C55E" icon={Package} />
        <StatCard label={fr ? 'Sorties confirmées' : 'Confirmed out'} value={FCFA(s.out_confirmed)} color="#EF4444" icon={Truck} />
        <StatCard label={fr ? 'Solde net' : 'Net balance'} value={FCFA(s.net_confirmed)} color="#D4AF37" icon={LayoutDashboard} />
        <StatCard label={fr ? 'Argent dormant' : 'Idle funds'} value={FCFA(dormantTotal)} color="#F97316" icon={AlertTriangle} />
      </div>

      {(s.in_pending > 0 || s.out_pending > 0) && (
        <div className="bg-[#F97316]/10 border border-[#F97316]/30 rounded-lg p-3 mb-6 text-sm text-[#F97316]">
          {fr ? 'En attente de confirmation' : 'Awaiting confirmation'} :
          {' '}{FCFA(s.in_pending)} {fr ? 'à recevoir' : 'incoming'} ·
          {' '}{FCFA(s.out_pending)} {fr ? 'à verser' : 'outgoing'}
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-2 border-b border-[#2A2A2A] mb-4 overflow-x-auto">
        {[
          ['flux', fr ? 'Tous les flux' : 'All flows'],
          ['groupages', fr ? 'Par groupage' : 'By groupage'],
          ['membres', fr ? 'Par client' : 'By client'],
          ['synthese', fr ? 'Par compte & période' : 'By account & period'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setVue(key)}
            className={`px-4 py-2 border-b-2 whitespace-nowrap transition-colors ${
              vue === key ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#A1A1AA] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vue === 'flux' && (
        <TreasuryFlows
          data={data} filtres={filtres} setFiltres={setFiltres}
          groupages={parGroupage} fr={fr} onDelete={supprimerFlux}
        />
      )}
      {vue === 'groupages' && <TreasuryByGroupage rows={parGroupage} fr={fr} />}
      {vue === 'membres' && <TreasuryByMember rows={parMembre} fr={fr} />}
      {vue === 'synthese' && <TreasurySummary summary={summary} fr={fr} />}

      {showForm && (
        <CashFlowModal
          fr={fr}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); chargerTout(); }}
        />
      )}
    </div>
  );
};

// --- Vue 1 : liste des flux, filtrable ---
const TreasuryFlows = ({ data, filtres, setFiltres, groupages, fr, onDelete }) => {
  const set = (patch) => setFiltres({ ...filtres, ...patch });
  return (
    <div>
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <select value={filtres.direction} onChange={(e) => set({ direction: e.target.value })} className="input-dark px-3 py-2 rounded-md text-sm">
          <option value="">{fr ? 'Sens' : 'Direction'}</option>
          <option value="in">{fr ? 'Entrées' : 'In'}</option>
          <option value="out">{fr ? 'Sorties' : 'Out'}</option>
        </select>
        <select value={filtres.account} onChange={(e) => set({ account: e.target.value })} className="input-dark px-3 py-2 rounded-md text-sm">
          <option value="">{fr ? 'Compte' : 'Account'}</option>
          {FLOW_ACCOUNTS.map(a => <option key={a} value={a}>{ACCOUNT_LABELS[a]}</option>)}
        </select>
        <select value={filtres.category} onChange={(e) => set({ category: e.target.value })} className="input-dark px-3 py-2 rounded-md text-sm">
          <option value="">{fr ? 'Catégorie' : 'Category'}</option>
          {FLOW_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={filtres.groupage_id} onChange={(e) => set({ groupage_id: e.target.value })} className="input-dark px-3 py-2 rounded-md text-sm">
          <option value="">{fr ? 'Groupage' : 'Groupage'}</option>
          {groupages.map(g => (
            <option key={g.groupage_id} value={g.groupage_id}>{g.reference || g.groupage_id}</option>
          ))}
        </select>
        <input type="date" value={filtres.date_from} onChange={(e) => set({ date_from: e.target.value })} className="input-dark px-3 py-2 rounded-md text-sm" />
        <input type="date" value={filtres.date_to} onChange={(e) => set({ date_to: e.target.value })} className="input-dark px-3 py-2 rounded-md text-sm" />
      </div>

      {data.flows.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-10 text-center text-[#71717A]">
          {fr ? 'Aucun mouvement pour ces critères.' : 'No entries for these filters.'}
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-x-auto">
          <table className="table-dark w-full text-sm">
            <thead>
              <tr>
                <th>{fr ? 'Date' : 'Date'}</th>
                <th>{fr ? 'Catégorie' : 'Category'}</th>
                <th>{fr ? 'Compte' : 'Account'}</th>
                <th>{fr ? 'Groupage' : 'Groupage'}</th>
                <th className="text-right">{fr ? 'Montant' : 'Amount'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.flows.map(f => (
                <tr key={f.flow_id}>
                  <td className="whitespace-nowrap">
                    {new Date(f.occurred_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US')}
                    {f.status === 'pending' && (
                      <span className="ml-2 text-[10px] text-[#F97316]">{fr ? 'en attente' : 'pending'}</span>
                    )}
                    {f.status === 'failed' && (
                      <span className="ml-2 text-[10px] text-[#EF4444]">{fr ? 'échoué' : 'failed'}</span>
                    )}
                  </td>
                  <td>
                    {CATEGORY_LABELS[f.category] || f.category}
                    {f.note && <div className="text-[11px] text-[#71717A]">{f.note}</div>}
                  </td>
                  <td>{ACCOUNT_LABELS[f.account] || f.account}</td>
                  <td className="font-mono text-xs text-[#71717A]">{f.groupage_id ? (f.reference_groupage || f.groupage_id.slice(0, 10)) : '—'}</td>
                  <td className={`text-right whitespace-nowrap font-medium ${f.direction === 'in' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {f.direction === 'in' ? '+' : '−'} {FCFA(f.amount_fcfa)}
                    {f.currency !== 'XAF' && (
                      <div className="text-[10px] text-[#71717A]">
                        {new Intl.NumberFormat('fr-FR').format(f.amount)} {f.currency}
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => onDelete(f)}
                      className="text-[#71717A] hover:text-[#EF4444] transition-colors"
                      aria-label={fr ? 'Supprimer' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- Vue 2 : position financiere par groupage ---
const TreasuryByGroupage = ({ rows, fr }) => {
  if (rows.length === 0) {
    return (
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-10 text-center text-[#71717A]">
        {fr ? 'Aucun mouvement rattaché à un groupage pour le moment.' : 'No groupage-linked entries yet.'}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map(g => (
        <div key={g.groupage_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="font-mono text-xs text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-1 rounded">
              {g.reference || '—'}
            </span>
            <span className="font-medium flex-1 min-w-0 truncate">{g.title}</span>
            <span className="text-xs text-[#71717A]">
              {g.current_members ?? 0} {fr ? 'membres' : 'members'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Chiffre label={fr ? 'Encaissé' : 'Collected'} valeur={g.collected_fcfa} couleur="#22C55E" />
            <Chiffre label={fr ? 'Fournisseur' : 'Supplier'} valeur={g.supplier_paid_fcfa} couleur="#A1A1AA" />
            <Chiffre label={fr ? 'Transitaire' : 'Freight'} valeur={g.freight_paid_fcfa} couleur="#A1A1AA" />
            <Chiffre label={fr ? 'Douane' : 'Customs'} valeur={g.customs_paid_fcfa} couleur="#A1A1AA" />
            <Chiffre
              label={fr ? 'Dort en caisse' : 'Idle'}
              valeur={g.idle_fcfa}
              couleur={g.idle_fcfa < 0 ? '#EF4444' : '#F97316'}
            />
          </div>
          {g.idle_fcfa < 0 && (
            <p className="text-[11px] text-[#EF4444] mt-2">
              {fr
                ? "Vous avez avancé plus d'argent que ce que les membres ont versé sur ce groupage."
                : 'You have advanced more than members have paid on this groupage.'}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

const Chiffre = ({ label, valeur, couleur }) => (
  <div>
    <p className="text-[11px] text-[#71717A]">{label}</p>
    <p className="font-medium" style={{ color: couleur }}>{FCFA(valeur)}</p>
  </div>
);

// --- Vue 3 : ce que chaque client a verse et ce qu'il doit ---
const TreasuryByMember = ({ rows, fr }) => {
  if (rows.length === 0) {
    return (
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-10 text-center text-[#71717A]">
        {fr ? 'Aucune adhésion enregistrée.' : 'No memberships yet.'}
      </div>
    );
  }
  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-x-auto">
      <table className="table-dark w-full text-sm">
        <thead>
          <tr>
            <th>{fr ? 'Client' : 'Client'}</th>
            <th>{fr ? 'Groupage' : 'Groupage'}</th>
            <th className="text-right">{fr ? 'Dû' : 'Due'}</th>
            <th className="text-right">{fr ? 'Versé' : 'Paid'}</th>
            <th className="text-right">{fr ? 'Reste' : 'Outstanding'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.user_id}-${r.groupage_id}-${i}`}>
              <td>
                {r.name || '—'}
                <div className="text-[11px] text-[#71717A]">{r.phone || r.email}</div>
              </td>
              <td className="font-mono text-xs">{r.reference || '—'}</td>
              <td className="text-right whitespace-nowrap">{FCFA(r.due_fcfa)}</td>
              <td className="text-right whitespace-nowrap text-[#22C55E]">{FCFA(r.paid_fcfa)}</td>
              <td className={`text-right whitespace-nowrap font-medium ${
                r.outstanding_fcfa > 0 ? 'text-[#F97316]' : 'text-[#22C55E]'
              }`}>
                {r.outstanding_fcfa > 0 ? FCFA(r.outstanding_fcfa) : (fr ? 'à jour' : 'settled')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Vue 4 : soldes par compte, ventilation, serie mensuelle ---
const TreasurySummary = ({ summary, fr }) => {
  if (!summary) return null;
  const comptes = Object.entries(summary.by_account || {});
  const categories = Object.entries(summary.by_category || {});
  const mois = summary.monthly || [];

  return (
    <div className="space-y-6">
      <Bloc titre={fr ? 'Par compte' : 'By account'}>
        {comptes.length === 0
          ? <Vide fr={fr} />
          : comptes.map(([cle, v]) => (
              <LigneSynthese key={cle} label={ACCOUNT_LABELS[cle] || cle} entree={v.in} sortie={v.out} net={v.net} />
            ))}
      </Bloc>

      <Bloc titre={fr ? 'Par catégorie' : 'By category'}>
        {categories.length === 0
          ? <Vide fr={fr} />
          : categories.map(([cle, v]) => (
              <LigneSynthese key={cle} label={CATEGORY_LABELS[cle] || cle} entree={v.in} sortie={v.out} net={v.net} />
            ))}
      </Bloc>

      <Bloc titre={fr ? 'Par mois' : 'By month'}>
        {mois.length === 0
          ? <Vide fr={fr} />
          : mois.map(m => (
              <LigneSynthese key={m.month} label={m.month} entree={m.in} sortie={m.out} net={m.net} />
            ))}
      </Bloc>
    </div>
  );
};

const Bloc = ({ titre, children }) => (
  <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
    <h3 className="font-medium mb-3">{titre}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const Vide = ({ fr }) => (
  <p className="text-sm text-[#71717A]">{fr ? 'Aucune donnée.' : 'No data.'}</p>
);

const LigneSynthese = ({ label, entree, sortie, net }) => (
  <div className="flex flex-wrap items-center gap-2 text-sm border-b border-[#2A2A2A] pb-2 last:border-0">
    <span className="flex-1 min-w-0 truncate">{label}</span>
    <span className="text-[#22C55E] whitespace-nowrap">+{FCFA(entree)}</span>
    <span className="text-[#EF4444] whitespace-nowrap">−{FCFA(sortie)}</span>
    <span className={`whitespace-nowrap font-medium w-32 text-right ${net >= 0 ? 'text-[#D4AF37]' : 'text-[#EF4444]'}`}>
      {FCFA(net)}
    </span>
  </div>
);

// --- Saisie manuelle d'un mouvement ---
const CashFlowModal = ({ fr, onClose, onSaved }) => {
  const [groupages, setGroupages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    direction: 'out', amount: '', currency: 'XAF', account: 'reasy',
    category: 'supplier_payment', status: 'confirmed',
    occurred_at: new Date().toISOString().slice(0, 10),
    groupage_id: '', reference: '', note: '', proof_url: ''
  });
  const set = (patch) => setForm({ ...form, ...patch });

  useEffect(() => {
    api.get('/groupages?limit=200').then(r => setGroupages(r.data)).catch(() => {});
  }, []);

  // Le sens decoule de la categorie : evite d'enregistrer un paiement
  // fournisseur en entree d'argent par inadvertance.
  const choisirCategorie = (category) => {
    set({ category, direction: INCOMING_CATEGORIES.includes(category) ? 'in' : 'out' });
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    const montant = parseFloat(form.amount);
    if (!(montant > 0)) {
      toast.error(fr ? 'Montant invalide' : 'Invalid amount');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/cash-flows', {
        ...form,
        amount: montant,
        groupage_id: form.groupage_id || null,
        reference: form.reference || null,
        note: form.note || null,
        proof_url: form.proof_url || null,
        occurred_at: new Date(form.occurred_at).toISOString(),
      });
      toast.success(fr ? 'Mouvement enregistré' : 'Entry recorded');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <form onSubmit={enregistrer} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-6 w-full max-w-2xl my-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-['Bebas_Neue'] text-2xl">{fr ? 'Saisir un mouvement' : 'Add entry'}</h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Catégorie' : 'Category'}</label>
            <select value={form.category} onChange={(e) => choisirCategorie(e.target.value)} className="input-dark w-full px-4 py-2 rounded-md">
              {FLOW_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <p className="text-[11px] text-[#71717A] mt-1">
              {form.direction === 'in'
                ? (fr ? "Entrée d'argent" : 'Money in')
                : (fr ? "Sortie d'argent" : 'Money out')}
            </p>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Compte utilisé' : 'Account used'}</label>
            <select value={form.account} onChange={(e) => set({ account: e.target.value })} className="input-dark w-full px-4 py-2 rounded-md">
              {FLOW_ACCOUNTS.map(a => <option key={a} value={a}>{ACCOUNT_LABELS[a]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Montant' : 'Amount'}</label>
            <input type="number" step="0.01" min="0" required value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" data-testid="flow-amount" />
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Devise' : 'Currency'}</label>
            <select value={form.currency} onChange={(e) => set({ currency: e.target.value })} className="input-dark w-full px-4 py-2 rounded-md">
              {['XAF', 'EUR', 'USD', 'CNY'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-[#71717A] mt-1">
              {fr ? 'Converti en FCFA pour les totaux.' : 'Converted to FCFA for totals.'}
            </p>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Date' : 'Date'}</label>
            <input type="date" required value={form.occurred_at}
              onChange={(e) => set({ occurred_at: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" />
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Statut' : 'Status'}</label>
            <select value={form.status} onChange={(e) => set({ status: e.target.value })} className="input-dark w-full px-4 py-2 rounded-md">
              <option value="confirmed">{fr ? 'Confirmé' : 'Confirmed'}</option>
              <option value="pending">{fr ? 'En attente' : 'Pending'}</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Groupage concerné (optionnel)' : 'Related groupage (optional)'}</label>
            <select value={form.groupage_id} onChange={(e) => set({ groupage_id: e.target.value })} className="input-dark w-full px-4 py-2 rounded-md">
              <option value="">{fr ? '— Aucun (frais général) —' : '— None (general expense) —'}</option>
              {groupages.map(g => (
                <option key={g.groupage_id} value={g.groupage_id}>
                  {g.reference ? `${g.reference} · ` : ''}{g.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Référence externe' : 'External reference'}</label>
            <input type="text" value={form.reference} onChange={(e) => set({ reference: e.target.value })}
              placeholder={fr ? 'N° de transaction REasy / Tara' : 'REasy / Tara transaction no.'}
              className="input-dark w-full px-4 py-2 rounded-md" />
          </div>
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Justificatif (URL)' : 'Proof (URL)'}</label>
            <input type="url" value={form.proof_url} onChange={(e) => set({ proof_url: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Note' : 'Note'}</label>
            <input type="text" value={form.note} onChange={(e) => set({ note: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-gold px-6 py-2 rounded-md flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {fr ? 'Enregistrer' : 'Save'}
          </button>
          <button type="button" onClick={onClose} className="btn-outline px-6 py-2 rounded-md">
            {fr ? 'Annuler' : 'Cancel'}
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Suivi des expeditions : phases + documents, groupage par groupage ---
// L'admin peut agir sur TOUS les groupages, la ou le transitaire est limite
// aux siens depuis le portail partenaire.
const AdminTracking = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [groupages, setGroupages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');

  const fetchGroupages = async () => {
    try {
      const response = await api.get('/groupages?limit=200');
      setGroupages(response.data);
    } catch (error) {
      toast.error(fr ? 'Chargement impossible' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.trim().toLowerCase();
  const visibles = groupages.filter(g => {
    if (phaseFilter && (g.shipment_status || 'preparation') !== phaseFilter) return false;
    if (!q) return true;
    return [g.reference, g.title, g.title_en, g.transitaire_name]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  });

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-tracking">
      <h1 className="font-['Bebas_Neue'] text-4xl mb-2">
        {fr ? 'Suivi & documents' : 'Tracking & documents'}
      </h1>
      <p className="text-[#A1A1AA] mb-6">
        {fr
          ? "Faites avancer les étapes d'expédition et joignez les documents. Chaque changement est horodaté et visible par les membres."
          : 'Advance shipment phases and attach documents. Every change is timestamped and visible to members.'}
      </p>

      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={fr ? 'Rechercher : référence, titre, transitaire…' : 'Search: reference, title, forwarder…'}
          className="input-dark px-4 py-2 rounded-md"
          data-testid="tracking-search"
        />
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="input-dark px-4 py-2 rounded-md"
        >
          <option value="">{fr ? 'Toutes les étapes' : 'All phases'}</option>
          {PHASES.map(p => (
            <option key={p} value={p}>{phaseLabel(p, fr ? 'fr' : 'en')}</option>
          ))}
        </select>
      </div>

      {visibles.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-10 text-center text-[#71717A]">
          {groupages.length === 0
            ? (fr ? 'Aucun groupage pour le moment.' : 'No groupages yet.')
            : (fr ? 'Aucun groupage ne correspond à cette recherche.' : 'No groupage matches this search.')}
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(g => {
            const phase = g.shipment_status || 'preparation';
            const idx = PHASES.indexOf(phase);
            const nbDocs = (g.logistics_documents || []).length;
            const ouvert = expandedId === g.groupage_id;
            return (
              <div key={g.groupage_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(ouvert ? null : g.groupage_id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#1A1A1A] transition-colors"
                >
                  <span className="font-mono text-xs text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-1 rounded shrink-0">
                    {g.reference || '—'}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-medium">
                    {fr ? g.title : (g.title_en || g.title)}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                    phase === 'delivered' ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-[#D4AF37]/15 text-[#D4AF37]'
                  }`}>
                    {phaseLabel(phase, fr ? 'fr' : 'en')}
                  </span>
                  <span className="text-xs text-[#71717A] whitespace-nowrap hidden sm:inline">
                    {idx + 1}/{PHASES.length} · {nbDocs} doc{nbDocs > 1 ? 's' : ''}
                  </span>
                  {ouvert ? <ChevronRight className="w-4 h-4 rotate-90 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                </button>

                {ouvert && (
                  <div className="border-t border-[#2A2A2A] p-4 space-y-6">
                    <div className="text-xs text-[#71717A] flex flex-wrap gap-x-4 gap-y-1">
                      <span>{fr ? 'Transitaire' : 'Forwarder'} : {g.transitaire_name || '—'}</span>
                      <span>{fr ? 'Membres' : 'Members'} : {g.current_members ?? 0}</span>
                      <a
                        href={`/groupages/${g.groupage_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                      >
                        {fr ? 'Voir la page' : 'View page'} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <PhaseUpdateSection
                      groupage={g}
                      fr={fr}
                      onUpdated={fetchGroupages}
                      basePath="/admin/groupages"
                    />

                    <DocumentUploadSection
                      groupage={g}
                      isTransitaire
                      fr={fr}
                      onUpdated={fetchGroupages}
                      basePath="/admin/groupages"
                      allowDelete
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const [pickupSummary, setPickupSummary] = useState(null); // {title, by_city}
  const [editingImage, setEditingImage] = useState(null); // groupage dont on modifie l'image
  const [editingGroupage, setEditingGroupage] = useState(null); // groupage en edition complete
  const fr = i18n.language === 'fr';

  const toggleTransitaireStatus = async (groupage) => {
    const newStatus = groupage.transitaire_status === 'confirmed' ? 'recommended' : 'confirmed';
    try {
      await api.put(`/admin/groupages/${groupage.groupage_id}`, { transitaire_status: newStatus });
      toast.success(newStatus === 'confirmed'
        ? (fr ? 'Transitaire confirmé — les membres voient "Votre transitaire".' : 'Forwarder confirmed — members now see "Your forwarder".')
        : (fr ? 'Repassé en "Transitaire recommandé".' : 'Back to "Recommended forwarder".'));
      fetchGroupages();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('common.error'));
    }
  };

  const showPickupSummary = async (groupage) => {
    try {
      const response = await api.get(`/admin/groupages/${groupage.groupage_id}/pickup-summary`);
      setPickupSummary({ title: groupage.title, by_city: response.data.by_city });
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

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

  // Raccourci "Modifier (admin)" depuis la page publique d'un groupage :
  // ouvre directement le modal d'edition du groupage demande.
  useEffect(() => {
    const targetId = location.state?.editGroupageId;
    if (targetId && groupages.length > 0) {
      const target = groupages.find(g => g.groupage_id === targetId);
      if (target) {
        setEditingGroupage(target);
        window.history.replaceState({}, '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupages]);

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
              <th>{i18n.language === 'fr' ? 'Transitaire' : 'Forwarder'}</th>
              <th>{i18n.language === 'fr' ? 'Deadline' : 'Deadline'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groupages.map(groupage => (
              <tr key={groupage.groupage_id}>
                <td>
                  {/* La reference distingue deux groupages du meme produit */}
                  {groupage.reference && (
                    <span className="font-mono text-[11px] text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded mr-2">
                      {groupage.reference}
                    </span>
                  )}
                  {groupage.title}
                </td>
                <td>
                  <span className={`badge-${groupage.status === 'open' ? 'success' : groupage.status === 'closed' ? 'warning' : 'gold'} px-2 py-1 rounded text-xs`}>
                    {t(`groupages.status.${groupage.status}`)}
                  </span>
                </td>
                <td>{groupage.current_members}/{groupage.min_members}</td>
                <td>
                  <button
                    onClick={() => toggleTransitaireStatus(groupage)}
                    className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                      groupage.transitaire_status === 'confirmed'
                        ? 'bg-[#22C55E]/20 text-[#22C55E]'
                        : 'bg-[#F97316]/20 text-[#F97316] hover:bg-[#F97316]/30'
                    }`}
                    title={fr ? 'Cliquer pour basculer recommandé/confirmé' : 'Click to toggle recommended/confirmed'}
                    data-testid={`transitaire-status-${groupage.groupage_id}`}
                  >
                    {groupage.transitaire_status === 'confirmed'
                      ? (fr ? '✓ Confirmé' : '✓ Confirmed')
                      : (fr ? 'Recommandé' : 'Recommended')}
                  </button>
                </td>
                <td>{new Date(groupage.deadline).toLocaleDateString()}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingGroupage(groupage)}
                      className="text-[#A1A1AA] hover:text-[#D4AF37]"
                      title={fr ? 'Modifier le groupage' : 'Edit groupage'}
                      data-testid={`edit-groupage-${groupage.groupage_id}`}
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setEditingImage(groupage)}
                      className="text-[#A1A1AA] hover:text-[#D4AF37]"
                      title={fr ? "Modifier l'image produit" : 'Edit product image'}
                      data-testid={`edit-image-${groupage.groupage_id}`}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => showPickupSummary(groupage)}
                      className="text-[#A1A1AA] hover:text-[#D4AF37]"
                      title={fr ? 'Répartition par ville de retrait' : 'Split by pickup city'}
                    >
                      <MapPin className="w-5 h-5" />
                    </button>
                    <Link
                      to={`/groupages/${groupage.groupage_id}`}
                      className="text-[#D4AF37] hover:underline"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                  </div>
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

      {/* Edition complete d'un groupage existant */}
      {editingGroupage && (
        <EditGroupageModal
          groupage={editingGroupage}
          fr={fr}
          onClose={() => setEditingGroupage(null)}
          onSaved={() => {
            setEditingGroupage(null);
            fetchGroupages();
          }}
        />
      )}

      {/* Edition de l'image produit d'un groupage existant */}
      {editingImage && (
        <EditImageModal
          groupage={editingImage}
          fr={fr}
          onClose={() => setEditingImage(null)}
          onSaved={() => {
            setEditingImage(null);
            fetchGroupages();
          }}
        />
      )}

      {/* Repartition par ville de retrait (pour organiser le split avec le transitaire) */}
      {pickupSummary && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPickupSummary(null)}>
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-['Bebas_Neue'] text-xl">
                {fr ? 'Répartition par ville' : 'Split by city'}
              </h3>
              <button onClick={() => setPickupSummary(null)} className="text-[#71717A] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#71717A] mb-4 truncate">{pickupSummary.title}</p>
            {Object.keys(pickupSummary.by_city).length === 0 ? (
              <p className="text-[#A1A1AA] text-sm">{fr ? 'Aucun membre pour le moment.' : 'No members yet.'}</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(pickupSummary.by_city).map(([city, data]) => (
                  <div key={city} className="flex justify-between items-center bg-[#0A0A0A] rounded-md px-4 py-3">
                    <span className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#D4AF37]" />
                      {city}
                    </span>
                    <span className="text-sm text-[#A1A1AA]">
                      {data.members} {fr ? 'membre(s)' : 'member(s)'} · {data.quantity} {fr ? 'unités' : 'units'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
    wholesale_unit_price_fcfa: '',
    member_unit_price_fcfa: '',
    solo_unit_price_fcfa: '',
    service_fee_percent: '',
    caution_fcfa: '',
    unit_price_cny: 100,
    solo_unit_price_cny: '',
    unit_weight_kg: 0.5,
    unit_volume_cbm: '',
    total_quantity: 100,
    total_order_price_cny: 10000,
    internal_cost_cny: '',
    margin_percent: '',
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

  // Options de transport actives du transitaire selectionne (au kg ou au CBM)
  const selectedTransitaire = transitaires.find(tr => tr.transitaire_id === formData.transitaire_id);
  const activeOptions = (selectedTransitaire?.shipping_options || []).filter(o => o.is_active !== false);
  const legacyTransitaire = selectedTransitaire && !(selectedTransitaire.shipping_options || []).length
    && selectedTransitaire.shipping_price_per_kg_cny != null;
  const selectedOption = activeOptions.find(o => o.option_id === formData.shipping_option_id);
  const isCbm = selectedOption?.unit === 'cbm';

  const [scraping, setScraping] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);

  // Calcule le prix total selon la formule du transitaire (= cout reel), puis
  // applique la marge SilkRoute pour obtenir le prix facture aux membres.
  const handleEstimate = async () => {
    setEstimating(true);
    try {
      const response = await api.post('/admin/groupages/estimate', {
        transitaire_id: formData.transitaire_id,
        shipping_option_id: formData.shipping_option_id || null,
        unit_price_cny: parseFloat(formData.unit_price_cny),
        unit_weight_kg: parseFloat(formData.unit_weight_kg) || null,
        unit_volume_cbm: parseFloat(formData.unit_volume_cbm) || null,
        total_quantity: parseInt(formData.total_quantity),
        margin_percent: parseFloat(formData.margin_percent) || 0
      });
      setEstimate(response.data);
      setFormData(prev => ({
        ...prev,
        total_order_price_cny: response.data.billed_total_order_price_cny,
        internal_cost_cny: response.data.internal_cost_cny
      }));
      toast.success(i18n.language === 'fr' ? 'Prix total calculé!' : 'Total price computed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || (i18n.language === 'fr' ? 'Erreur de calcul' : 'Estimation error'));
    } finally {
      setEstimating(false);
    }
  };

  // Recupere l'image principale de la page produit (og:image) via le backend
  const handleScrapeImage = async () => {
    if (!formData.product_url) return;
    setScraping(true);
    try {
      const response = await api.post('/admin/scrape-product-image', { url: formData.product_url });
      setFormData(prev => ({ ...prev, product_image_url: response.data.image_url }));
      toast.success(i18n.language === 'fr' ? 'Image récupérée!' : 'Image fetched!');
    } catch (error) {
      toast.error(error.response?.data?.detail || (i18n.language === 'fr' ? "Impossible de récupérer l'image" : 'Could not fetch image'));
    } finally {
      setScraping(false);
    }
  };

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
    if (activeOptions.length > 0 && !formData.shipping_option_id) {
      toast.error(i18n.language === 'fr'
        ? 'Sélectionnez une option de transport'
        : 'Select a shipping option');
      return;
    }
    if (selectedTransitaire && activeOptions.length === 0 && !legacyTransitaire) {
      toast.error(i18n.language === 'fr'
        ? "Ce transitaire n'a aucune option de transport — ajoutez-en une dans l'onglet Transitaires."
        : 'This forwarder has no shipping option — add one in the Forwarders tab.');
      return;
    }
    if (isCbm && !parseFloat(formData.unit_volume_cbm)) {
      toast.error(i18n.language === 'fr'
        ? 'Cette option est facturée au volume : renseignez le volume unitaire (CBM).'
        : 'This option is billed by volume: enter the unit volume (CBM).');
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
        wholesale_unit_price_fcfa: parseFloat(formData.wholesale_unit_price_fcfa) || null,
        member_unit_price_fcfa: parseFloat(formData.member_unit_price_fcfa) || null,
        solo_unit_price_fcfa: parseFloat(formData.solo_unit_price_fcfa) || null,
        // '' et 0 sont distincts : vide = defaut serveur, 0 = aucun frais
        service_fee_percent: formData.service_fee_percent === ''
          ? null
          : parseFloat(formData.service_fee_percent),
        caution_fcfa: formData.caution_fcfa === '' ? null : parseFloat(formData.caution_fcfa),
        unit_price_cny: parseFloat(formData.unit_price_cny),
        solo_unit_price_cny: parseFloat(formData.solo_unit_price_cny) || null,
        unit_weight_kg: parseFloat(formData.unit_weight_kg),
        unit_volume_cbm: parseFloat(formData.unit_volume_cbm) || null,
        total_quantity: parseInt(formData.total_quantity),
        total_order_price_cny: parseFloat(formData.total_order_price_cny),
        internal_cost_cny: parseFloat(formData.internal_cost_cny) || null,
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
          {formData.transitaire_id && activeOptions.length > 0 && (
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Option de transport' : 'Shipping option'}
              </label>
              <select
                value={formData.shipping_option_id}
                onChange={(e) => { setFormData({...formData, shipping_option_id: e.target.value}); setEstimate(null); }}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
                data-testid="shipping-option-select"
              >
                <option value="">{i18n.language === 'fr' ? '-- Choisir --' : '-- Select --'}</option>
                {activeOptions.map(opt => (
                  <option key={opt.option_id} value={opt.option_id}>
                    {opt.label} — {new Intl.NumberFormat('fr-FR').format(opt.price_fcfa)} FCFA/{opt.unit === 'cbm' ? 'CBM' : 'kg'} ({opt.eta_min_days}-{opt.eta_max_days}j)
                  </option>
                ))}
              </select>
            </div>
          )}
          {formData.transitaire_id && activeOptions.length === 0 && !legacyTransitaire && (
            <p className="text-sm text-[#F97316]">
              {i18n.language === 'fr'
                ? "⚠ Ce transitaire n'a pas d'option de transport. Ajoutez-en une dans l'onglet Transitaires."
                : '⚠ This forwarder has no shipping option. Add one in the Forwarders tab.'}
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
              {i18n.language === 'fr' ? 'Image produit (optionnel)' : 'Product image (optional)'}
            </label>
            <ImageDropZone
              value={formData.product_image_url}
              onChange={(url) => setFormData(prev => ({ ...prev, product_image_url: url }))}
              fr={i18n.language === 'fr'}
            />
            <div className="flex gap-2 mt-2">
              <input
                type="url"
                value={formData.product_image_url}
                onChange={(e) => setFormData({...formData, product_image_url: e.target.value})}
                placeholder={i18n.language === 'fr' ? "...ou collez l'URL d'une image" : '...or paste an image URL'}
                className="input-dark flex-1 px-4 py-2 rounded-md"
              />
              <button
                type="button"
                onClick={handleScrapeImage}
                disabled={scraping || !formData.product_url}
                className="btn-outline px-3 py-2 rounded-md text-sm whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                title={i18n.language === 'fr' ? 'Récupérer automatiquement l\'image depuis le lien produit' : 'Auto-fetch the image from the product link'}
                data-testid="scrape-image-btn"
              >
                {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                {i18n.language === 'fr' ? 'Depuis le lien' : 'From link'}
              </button>
            </div>
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

          {/* Prix unitaires saisis DIRECTEMENT en FCFA, tous HORS TRANSPORT
              (le transport vient de la fiche transitaire et s'ajoute au total).
              Des qu'un prix membre est saisi ici, il prime sur le calcul CNY. */}
          <div className="border border-[#D4AF37]/30 bg-[#D4AF37]/5 rounded-lg p-4 space-y-4">
            <div>
              <h4 className="text-[#D4AF37] font-medium">
                {i18n.language === 'fr' ? 'Prix unitaires en FCFA (hors transport)' : 'Unit prices in FCFA (excl. shipping)'}
              </h4>
              <p className="text-[11px] text-[#71717A] mt-1">
                {i18n.language === 'fr'
                  ? "Le transport est calculé à part depuis la fiche transitaire et ajouté au total. Dès qu'un prix acheteurs est saisi, il remplace le calcul en CNY ci-dessous."
                  : 'Shipping is computed separately from the forwarder profile and added to the total. Once a buyer price is set, it replaces the CNY calculation below.'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {i18n.language === 'fr' ? 'Prix de GROS fournisseur' : 'Supplier WHOLESALE price'}
                  <span className="ml-2 text-[10px] text-[#F97316]">
                    {i18n.language === 'fr' ? 'INTERNE' : 'INTERNAL'}
                  </span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.wholesale_unit_price_fcfa}
                  onChange={(e) => setFormData({...formData, wholesale_unit_price_fcfa: e.target.value})}
                  placeholder={i18n.language === 'fr' ? 'Ce que le fournisseur vous laisse' : 'What the supplier charges you'}
                  className="input-dark w-full px-4 py-2 rounded-md"
                  data-testid="wholesale-price-input"
                />
                <p className="text-[10px] text-[#71717A] mt-1">
                  {i18n.language === 'fr'
                    ? 'Jamais exposé aux acheteurs. Sert uniquement à calculer votre marge.'
                    : 'Never exposed to buyers. Used only to compute your margin.'}
                </p>
              </div>
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {i18n.language === 'fr' ? 'Prix ACHETEURS sur la plateforme' : 'BUYER price on the platform'}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.member_unit_price_fcfa}
                  onChange={(e) => setFormData({...formData, member_unit_price_fcfa: e.target.value})}
                  placeholder={i18n.language === 'fr' ? 'Ce que le membre paie par unité' : 'What each member pays per unit'}
                  className="input-dark w-full px-4 py-2 rounded-md"
                  data-testid="member-price-input"
                />
              </div>
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {i18n.language === 'fr' ? 'Prix en ACHAT SEUL' : 'SOLO purchase price'}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.solo_unit_price_fcfa}
                  onChange={(e) => setFormData({...formData, solo_unit_price_fcfa: e.target.value})}
                  placeholder={i18n.language === 'fr' ? 'Palier 1 pièce, sans groupage' : '1-piece tier, no group'}
                  className="input-dark w-full px-4 py-2 rounded-md"
                  data-testid="solo-price-fcfa-input"
                />
              </div>
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {i18n.language === 'fr' ? 'Prix sur le MARCHÉ camerounais' : 'Cameroonian MARKET price'}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.local_price_fcfa}
                  onChange={(e) => setFormData({...formData, local_price_fcfa: e.target.value})}
                  placeholder={i18n.language === 'fr' ? 'Chez un grossiste à Douala' : 'At a local wholesaler'}
                  className="input-dark w-full px-4 py-2 rounded-md"
                />
              </div>
            </div>

            {/* Frais de service preleves en plus, propres a ce groupage. */}
            <div className="grid md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {i18n.language === 'fr' ? 'Frais de service (%)' : 'Service fee (%)'}
                  <span className="ml-2 text-[10px] text-[#F97316]">
                    {i18n.language === 'fr' ? 'INTERNE' : 'INTERNAL'}
                  </span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  value={formData.service_fee_percent}
                  onChange={(e) => setFormData({...formData, service_fee_percent: e.target.value})}
                  placeholder={i18n.language === 'fr' ? 'Vide = 5 % par défaut' : 'Blank = 5% default'}
                  className="input-dark w-full px-4 py-2 rounded-md"
                  data-testid="service-fee-input"
                />
                <p className="text-[10px] text-[#71717A] mt-1">
                  {i18n.language === 'fr'
                    ? 'Maximum 20 %. Prélevés sur la part du membre (marchandise + transport), fondus dans le total : l\'acheteur ne les voit pas comme une ligne séparée. Saisir 0 pour ne rien prélever.'
                    : 'Max 20%. Charged on the member share (goods + shipping) and blended into the total: buyers never see it as a separate line. Enter 0 for no fee.'}
                </p>
              </div>
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {i18n.language === 'fr' ? 'Caution à l\'adhésion (FCFA)' : 'Deposit on joining (FCFA)'}
                </label>
                <input
                  type="number"
                  step="500"
                  min="0"
                  value={formData.caution_fcfa}
                  onChange={(e) => setFormData({...formData, caution_fcfa: e.target.value})}
                  placeholder={i18n.language === 'fr' ? 'Vide ou 0 = paiement en une fois' : 'Blank or 0 = single payment'}
                  className="input-dark w-full px-4 py-2 rounded-md"
                  data-testid="caution-input"
                />
                <p className="text-[10px] text-[#71717A] mt-1">
                  {i18n.language === 'fr'
                    ? "Laissez vide pour que le membre règle la totalité d'un coup. Sinon, il verse d'abord ce montant pour réserver sa place, puis le solde."
                    : 'Leave blank so the member pays in full at once. Otherwise they pay this first to reserve their spot, then the balance.'}
                </p>
              </div>
            </div>

            {/* Marge calculee en direct : uniquement visible ici, dans l'admin. */}
            {formData.wholesale_unit_price_fcfa && formData.member_unit_price_fcfa && (
              (() => {
                const gros = parseFloat(formData.wholesale_unit_price_fcfa);
                const membre = parseFloat(formData.member_unit_price_fcfa);
                if (!(gros > 0) || !(membre > 0)) return null;
                const margeProduit = membre - gros;
                const pct = (margeProduit / gros) * 100;
                // Les frais s'appliquent aussi au transport, absent d'ici : on
                // n'annonce donc que leur part sur la marchandise.
                const tauxFrais = formData.service_fee_percent === ''
                  ? 5
                  : parseFloat(formData.service_fee_percent) || 0;
                const fraisSurProduit = membre * tauxFrais / 100;
                const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
                return (
                  <div className={`text-sm rounded-md px-3 py-2 ${margeProduit >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                    {i18n.language === 'fr' ? 'Marge par unité' : 'Margin per unit'}
                    {' : '}<strong>{fmt(margeProduit)} FCFA</strong> ({pct.toFixed(1)} %)
                    {tauxFrais > 0 && (
                      <span className="block text-[11px] mt-1 opacity-90">
                        {i18n.language === 'fr'
                          ? `+ ${fmt(fraisSurProduit)} FCFA de frais de service (${tauxFrais} %), soit ${fmt(margeProduit + fraisSurProduit)} FCFA au total — hors frais sur le transport.`
                          : `+ ${fmt(fraisSurProduit)} FCFA service fee (${tauxFrais}%), i.e. ${fmt(margeProduit + fraisSurProduit)} FCFA total — excluding fee on shipping.`}
                      </span>
                    )}
                    {margeProduit < 0 && (
                      <span className="block text-[11px] mt-1">
                        {i18n.language === 'fr'
                          ? 'Vous vendez en dessous de votre prix d\'achat.'
                          : 'You are selling below your purchase price.'}
                      </span>
                    )}
                  </div>
                );
              })()
            )}
          </div>

          {/* Ancien mode CNY : conserve pour les groupages deja crees et comme
              repli quand les prix FCFA ci-dessus ne sont pas renseignes. */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Prix unitaire GROS (CNY, palier quantité cible)' : 'WHOLESALE unit price (CNY, target-qty tier)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_price_cny}
                onChange={(e) => { setFormData({...formData, unit_price_cny: e.target.value}); setEstimate(null); }}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Prix unitaire SEUL (CNY, petite quantité)' : 'SOLO unit price (CNY, small-qty tier)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.solo_unit_price_cny}
                onChange={(e) => setFormData({...formData, solo_unit_price_cny: e.target.value})}
                placeholder={i18n.language === 'fr' ? 'Palier 1 pièce sur Alibaba' : '1-piece tier on Alibaba'}
                className="input-dark w-full px-4 py-2 rounded-md"
                data-testid="solo-unit-price-input"
              />
              <p className="text-[10px] text-[#71717A] mt-1">
                {i18n.language === 'fr'
                  ? "C'est lui qui matérialise l'économie du prix de gros dans le comparateur."
                  : 'This is what materializes the bulk-price savings in the comparator.'}
              </p>
            </div>
          </div>

          <div className={isCbm ? 'grid md:grid-cols-3 gap-4' : 'grid md:grid-cols-2 gap-4'}>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Poids unitaire (kg)' : 'Unit weight (kg)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_weight_kg}
                onChange={(e) => { setFormData({...formData, unit_weight_kg: e.target.value}); setEstimate(null); }}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
            {isCbm && (
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {i18n.language === 'fr' ? 'Volume unitaire (CBM)' : 'Unit volume (CBM)'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.unit_volume_cbm}
                  onChange={(e) => { setFormData({...formData, unit_volume_cbm: e.target.value}); setEstimate(null); }}
                  className="input-dark w-full px-4 py-2 rounded-md"
                  required
                  data-testid="unit-volume-input"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {i18n.language === 'fr' ? 'Quantité cible' : 'Target quantity'}
              </label>
              <input
                type="number"
                value={formData.total_quantity}
                onChange={(e) => { setFormData({...formData, total_quantity: e.target.value}); setEstimate(null); }}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
              />
            </div>
          </div>

          {/* Prix total commande : cout reel selon la formule du transitaire,
              majore de la marge SilkRoute (spread invisible pour les membres) */}
          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {i18n.language === 'fr' ? 'Prix total facturé (CNY)' : 'Billed total price (CNY)'}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                step="0.01"
                value={formData.total_order_price_cny}
                onChange={(e) => setFormData({...formData, total_order_price_cny: e.target.value})}
                className="input-dark flex-1 min-w-[140px] px-4 py-2 rounded-md"
                required
              />
              <div className="relative w-28">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.margin_percent}
                  onChange={(e) => { setFormData({...formData, margin_percent: e.target.value}); setEstimate(null); }}
                  placeholder={i18n.language === 'fr' ? 'Marge' : 'Margin'}
                  className="input-dark w-full pl-3 pr-8 py-2 rounded-md"
                  data-testid="margin-input"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] text-sm">%</span>
              </div>
              <button
                type="button"
                onClick={handleEstimate}
                disabled={estimating || !formData.transitaire_id || (activeOptions.length > 0 && !formData.shipping_option_id)}
                className="btn-outline px-3 py-2 rounded-md text-sm whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                title={i18n.language === 'fr'
                  ? 'Coût réel (marchandise + transport au tarif transitaire) majoré de la marge'
                  : 'Real cost (goods + transport at forwarder tariff) plus margin'}
                data-testid="estimate-btn"
              >
                {estimating ? <Loader2 className="w-4 h-4 animate-spin" /> : '🧮'}
                {i18n.language === 'fr' ? 'Calculer selon transitaire' : 'Compute from forwarder'}
              </button>
            </div>
            {estimate && (
              <p className="text-xs text-[#71717A] mt-2" data-testid="estimate-breakdown">
                {i18n.language === 'fr' ? 'Coût réel' : 'Real cost'}: {new Intl.NumberFormat('fr-FR').format(estimate.total_order_price_fcfa)} FCFA
                {' ('}{i18n.language === 'fr' ? 'marchandise' : 'goods'} {new Intl.NumberFormat('fr-FR').format(estimate.merchandise_fcfa)}
                {' + transport '}{new Intl.NumberFormat('fr-FR').format(estimate.transport_total_fcfa)}{')'}
                {estimate.margin_percent > 0 && (
                  <>
                    {' → '}{i18n.language === 'fr' ? 'facturé' : 'billed'}: <span className="text-[#D4AF37]">{new Intl.NumberFormat('fr-FR').format(estimate.billed_total_order_price_fcfa)} FCFA</span>
                    {' '}(<span className="text-[#22C55E]">+{new Intl.NumberFormat('fr-FR').format(estimate.margin_fcfa)} FCFA {i18n.language === 'fr' ? 'de marge' : 'margin'}</span>)
                  </>
                )}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
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

          {/* Le prix grossiste local est saisi plus haut, dans le bloc des prix FCFA. */}
          <div className="grid md:grid-cols-2 gap-4">
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
                  {(tr.service_cities || []).length > 0 && (
                    <p className="text-xs text-[#71717A] mt-1">
                      {fr ? 'Villes de desserte' : 'Service cities'}: {tr.service_cities.join(', ')}
                    </p>
                  )}
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
    service_cities: (transitaire?.service_cities || []).join(', '),
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
      service_cities: form.service_cities.split(',').map(c => c.trim()).filter(Boolean),
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

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {fr ? 'Villes de desserte (séparées par des virgules)' : 'Service cities (comma separated)'}
            </label>
            <input
              type="text"
              value={form.service_cities}
              onChange={(e) => setForm({ ...form, service_cities: e.target.value })}
              className="input-dark w-full px-4 py-2 rounded-md"
              placeholder={fr ? 'Douala, Yaoundé, Bafoussam' : 'Douala, Yaounde, Bafoussam'}
              data-testid="service-cities-input"
            />
            <p className="text-xs text-[#71717A] mt-1">
              {fr ? 'Chaque membre devra choisir SA ville de retrait parmi cette liste en rejoignant un groupage (choix définitif, utilisé pour le split de la commande).'
                  : 'Each member will pick THEIR pickup city from this list when joining a groupage (final choice, used to split the order).'}
            </p>
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

// Convertit une date ISO en valeur pour input datetime-local
const toLocalInput = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
};

// Modal d'edition complete d'un groupage : transitaire, option de transport,
// chiffres (avec recalcul selon la formule du transitaire), dates, statut.
const EditGroupageModal = ({ groupage, fr, onClose, onSaved }) => {
  const [transitaires, setTransitaires] = useState([]);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);

  const [form, setForm] = useState({
    title: groupage.title || '',
    title_en: groupage.title_en || '',
    status: groupage.status || 'open',
    transitaire_id: groupage.transitaire_id || '',
    shipping_option_id: groupage.shipping_option_id || '',
    unit_price_cny: groupage.unit_price_cny ?? '',
    solo_unit_price_cny: groupage.solo_unit_price_cny ?? '',
    unit_weight_kg: groupage.unit_weight_kg ?? '',
    unit_volume_cbm: groupage.unit_volume_cbm ?? '',
    total_quantity: groupage.total_quantity ?? '',
    total_order_price_cny: groupage.total_order_price_cny ?? '',
    internal_cost_cny: '',
    margin_percent: '',
    min_members: groupage.min_members ?? '',
    max_members: groupage.max_members ?? '',
    deadline: toLocalInput(groupage.deadline),
    estimated_arrival: toLocalInput(groupage.estimated_arrival),
    local_price_fcfa: groupage.local_price_fcfa ?? '',
    // Le prix de gros n'est jamais renvoye par l'API : on ne le prerenseigne pas.
    // Laisse vide, il n'est pas envoye et la valeur en base reste inchangee.
    wholesale_unit_price_fcfa: '',
    member_unit_price_fcfa: groupage.member_unit_price_fcfa ?? '',
    solo_unit_price_fcfa: groupage.solo_unit_price_fcfa ?? '',
    // Comme le prix de gros, le taux de frais n'est pas renvoye par l'API.
    // Laisse vide, il n'est pas envoye et la valeur en base reste inchangee.
    service_fee_percent: '',
    caution_fcfa: groupage.caution_fcfa ?? '',
    suggested_resale_price_fcfa: groupage.suggested_resale_price_fcfa ?? ''
  });

  useEffect(() => {
    api.get('/transitaires?active_only=false')
      .then(res => setTransitaires(res.data))
      .catch(() => {});
  }, []);

  const selectedTransitaire = transitaires.find(t => t.transitaire_id === form.transitaire_id);
  const activeOptions = (selectedTransitaire?.shipping_options || []).filter(o => o.is_active !== false);
  const selectedOption = activeOptions.find(o => o.option_id === form.shipping_option_id);
  const isCbm = selectedOption?.unit === 'cbm';
  const set = (patch) => { setForm(prev => ({ ...prev, ...patch })); setEstimate(null); };

  const handleEstimate = async () => {
    setEstimating(true);
    try {
      const response = await api.post('/admin/groupages/estimate', {
        transitaire_id: form.transitaire_id,
        shipping_option_id: form.shipping_option_id || null,
        unit_price_cny: parseFloat(form.unit_price_cny),
        unit_weight_kg: parseFloat(form.unit_weight_kg) || null,
        unit_volume_cbm: parseFloat(form.unit_volume_cbm) || null,
        total_quantity: parseInt(form.total_quantity),
        margin_percent: parseFloat(form.margin_percent) || 0
      });
      setEstimate(response.data);
      setForm(prev => ({
        ...prev,
        total_order_price_cny: response.data.billed_total_order_price_cny,
        internal_cost_cny: response.data.internal_cost_cny
      }));
      toast.success(fr ? 'Prix total recalculé!' : 'Total price recomputed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur de calcul' : 'Estimation error'));
    } finally {
      setEstimating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCbm && !parseFloat(form.unit_volume_cbm)) {
      toast.error(fr ? 'Cette option est facturée au volume : renseignez le volume unitaire (CBM).' : 'This option is billed by volume: enter the unit volume (CBM).');
      return;
    }

    const payload = {
      title: form.title,
      title_en: form.title_en,
      status: form.status,
      transitaire_id: form.transitaire_id,
      shipping_option_id: form.shipping_option_id || null,
      unit_price_cny: parseFloat(form.unit_price_cny),
      solo_unit_price_cny: parseFloat(form.solo_unit_price_cny) || null,
      unit_weight_kg: parseFloat(form.unit_weight_kg),
      unit_volume_cbm: parseFloat(form.unit_volume_cbm) || null,
      total_quantity: parseInt(form.total_quantity),
      total_order_price_cny: parseFloat(form.total_order_price_cny),
      min_members: parseInt(form.min_members),
      ...(form.internal_cost_cny ? { internal_cost_cny: parseFloat(form.internal_cost_cny) } : {}),
      max_members: parseInt(form.max_members),
      local_price_fcfa: parseFloat(form.local_price_fcfa) || 0,
      member_unit_price_fcfa: form.member_unit_price_fcfa === '' ? null : parseFloat(form.member_unit_price_fcfa),
      caution_fcfa: form.caution_fcfa === '' ? null : parseFloat(form.caution_fcfa),
      solo_unit_price_fcfa: form.solo_unit_price_fcfa === '' ? null : parseFloat(form.solo_unit_price_fcfa),
      // Laisse vide = on n'y touche pas (ces champs internes ne sont jamais relus depuis l'API)
      ...(form.wholesale_unit_price_fcfa ? { wholesale_unit_price_fcfa: parseFloat(form.wholesale_unit_price_fcfa) } : {}),
      ...(form.service_fee_percent !== '' ? { service_fee_percent: parseFloat(form.service_fee_percent) } : {}),
      suggested_resale_price_fcfa: form.suggested_resale_price_fcfa === '' ? null : parseFloat(form.suggested_resale_price_fcfa)
    };
    if (form.deadline) payload.deadline = new Date(form.deadline).toISOString();
    if (form.estimated_arrival) payload.estimated_arrival = new Date(form.estimated_arrival).toISOString();

    setSaving(true);
    try {
      await api.put(`/admin/groupages/${groupage.groupage_id}`, payload);
      toast.success(fr ? 'Groupage mis à jour!' : 'Groupage updated!');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const num = (v) => new Intl.NumberFormat('fr-FR').format(v);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="edit-groupage-modal">
        <div className="p-6 border-b border-[#2A2A2A] flex justify-between items-center">
          <h2 className="font-['Bebas_Neue'] text-2xl">{fr ? 'Modifier le groupage' : 'Edit groupage'}</h2>
          <button onClick={onClose} className="text-[#71717A] hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Titre (FR)' : 'Title (FR)'}</label>
              <input type="text" value={form.title} onChange={(e) => set({ title: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Statut' : 'Status'}</label>
              <select value={form.status} onChange={(e) => set({ status: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md">
                <option value="open">open</option>
                <option value="closed">closed</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Transitaire' : 'Forwarder'}</label>
              <select
                value={form.transitaire_id}
                onChange={(e) => set({ transitaire_id: e.target.value, shipping_option_id: '' })}
                className="input-dark w-full px-4 py-2 rounded-md"
                required
                data-testid="edit-transitaire-select"
              >
                {transitaires.map(tr => (
                  <option key={tr.transitaire_id} value={tr.transitaire_id}>
                    {tr.name} ({tr.city}){tr.is_active === false ? (fr ? ' — inactif' : ' — inactive') : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Option de transport' : 'Shipping option'}</label>
              <select
                value={form.shipping_option_id}
                onChange={(e) => set({ shipping_option_id: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md"
                required={activeOptions.length > 0}
                data-testid="edit-shipping-option-select"
              >
                <option value="">{fr ? '-- Choisir --' : '-- Select --'}</option>
                {activeOptions.map(opt => (
                  <option key={opt.option_id} value={opt.option_id}>
                    {opt.label} — {num(opt.price_fcfa)} FCFA/{opt.unit === 'cbm' ? 'CBM' : 'kg'} ({opt.eta_min_days}-{opt.eta_max_days}j)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.transitaire_id !== groupage.transitaire_id && (groupage.current_members || 0) > 0 && (
            <p className="text-xs text-[#F97316]">
              {fr
                ? `⚠ ${groupage.current_members} membre(s) ont déjà rejoint avec les villes de retrait de l'ancien transitaire. Leur choix de ville est conservé — vérifiez la compatibilité avec le nouveau transitaire.`
                : `⚠ ${groupage.current_members} member(s) already joined with the previous forwarder's pickup cities. Their city choice is kept — check compatibility with the new forwarder.`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Prix unit. GROS (CNY)' : 'WHOLESALE unit price (CNY)'}</label>
              <input type="number" step="0.01" value={form.unit_price_cny}
                onChange={(e) => set({ unit_price_cny: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Prix unit. SEUL (CNY)' : 'SOLO unit price (CNY)'}</label>
              <input type="number" step="0.01" value={form.solo_unit_price_cny}
                onChange={(e) => set({ solo_unit_price_cny: e.target.value })}
                placeholder={fr ? 'Palier petite quantité' : 'Small-qty tier'}
                className="input-dark w-full px-4 py-2 rounded-md"
                data-testid="edit-solo-unit-price" />
            </div>
          </div>

          <div className={isCbm ? 'grid grid-cols-2 md:grid-cols-3 gap-4' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Poids unit. (kg)' : 'Unit weight (kg)'}</label>
              <input type="number" step="0.01" value={form.unit_weight_kg}
                onChange={(e) => set({ unit_weight_kg: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
            {isCbm && (
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Volume unit. (CBM)' : 'Unit volume (CBM)'}</label>
                <input type="number" step="0.001" value={form.unit_volume_cbm}
                  onChange={(e) => set({ unit_volume_cbm: e.target.value })}
                  className="input-dark w-full px-4 py-2 rounded-md" required />
              </div>
            )}
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Quantité cible' : 'Target quantity'}</label>
              <input type="number" value={form.total_quantity}
                onChange={(e) => set({ total_quantity: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
              {(groupage.current_quantity_reserved || 0) > 0 && (
                <p className="text-[10px] text-[#71717A] mt-1">
                  {fr ? `${groupage.current_quantity_reserved} déjà réservées` : `${groupage.current_quantity_reserved} already reserved`}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Prix total facturé (CNY)' : 'Billed total price (CNY)'}</label>
            <div className="flex flex-wrap gap-2">
              <input type="number" step="0.01" value={form.total_order_price_cny}
                onChange={(e) => setForm(prev => ({ ...prev, total_order_price_cny: e.target.value }))}
                className="input-dark flex-1 min-w-[140px] px-4 py-2 rounded-md" required />
              <div className="relative w-28">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.margin_percent}
                  onChange={(e) => set({ margin_percent: e.target.value })}
                  placeholder={fr ? 'Marge' : 'Margin'}
                  className="input-dark w-full pl-3 pr-8 py-2 rounded-md"
                  data-testid="edit-margin-input"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] text-sm">%</span>
              </div>
              <button
                type="button"
                onClick={handleEstimate}
                disabled={estimating || !form.transitaire_id || (activeOptions.length > 0 && !form.shipping_option_id)}
                className="btn-outline px-3 py-2 rounded-md text-sm whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                data-testid="edit-estimate-btn"
              >
                {estimating ? <Loader2 className="w-4 h-4 animate-spin" /> : '🧮'}
                {fr ? 'Calculer selon transitaire' : 'Compute from forwarder'}
              </button>
            </div>
            {estimate && (
              <p className="text-xs text-[#71717A] mt-2">
                {fr ? 'Coût réel' : 'Real cost'}: {num(estimate.total_order_price_fcfa)} FCFA
                {' ('}{fr ? 'marchandise' : 'goods'} {num(estimate.merchandise_fcfa)}
                {' + transport '}{num(estimate.transport_total_fcfa)}{')'}
                {estimate.margin_percent > 0 && (
                  <>
                    {' → '}{fr ? 'facturé' : 'billed'}: <span className="text-[#D4AF37]">{num(estimate.billed_total_order_price_fcfa)} FCFA</span>
                    {' '}(<span className="text-[#22C55E]">+{num(estimate.margin_fcfa)} FCFA {fr ? 'de marge' : 'margin'}</span>)
                  </>
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Min membres</label>
              <input type="number" value={form.min_members} onChange={(e) => set({ min_members: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Max membres</label>
              <input type="number" value={form.max_members} onChange={(e) => set({ max_members: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Prix local (FCFA)' : 'Local price (FCFA)'}</label>
              <input type="number" value={form.local_price_fcfa} onChange={(e) => set({ local_price_fcfa: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Prix ACHETEURS (FCFA, hors transport)' : 'BUYER price (FCFA, excl. shipping)'}
              </label>
              <input type="number" value={form.member_unit_price_fcfa}
                onChange={(e) => set({ member_unit_price_fcfa: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Prix ACHAT SEUL (FCFA, hors transport)' : 'SOLO price (FCFA, excl. shipping)'}
              </label>
              <input type="number" value={form.solo_unit_price_fcfa}
                onChange={(e) => set({ solo_unit_price_fcfa: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Prix de GROS fournisseur (FCFA)' : 'Supplier WHOLESALE price (FCFA)'}
                <span className="ml-2 text-[10px] text-[#F97316]">{fr ? 'INTERNE' : 'INTERNAL'}</span>
              </label>
              <input type="number" value={form.wholesale_unit_price_fcfa}
                onChange={(e) => set({ wholesale_unit_price_fcfa: e.target.value })}
                placeholder={fr ? 'Laisser vide = inchangé' : 'Leave blank = unchanged'}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Frais de service (%)' : 'Service fee (%)'}
                <span className="ml-2 text-[10px] text-[#F97316]">{fr ? 'INTERNE' : 'INTERNAL'}</span>
              </label>
              <input type="number" step="0.5" min="0" max="20" value={form.service_fee_percent}
                onChange={(e) => set({ service_fee_percent: e.target.value })}
                placeholder={fr ? 'Laisser vide = inchangé (max 20)' : 'Leave blank = unchanged (max 20)'}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">
                {fr ? 'Caution (FCFA)' : 'Deposit (FCFA)'}
              </label>
              <input type="number" step="500" min="0" value={form.caution_fcfa}
                onChange={(e) => set({ caution_fcfa: e.target.value })}
                placeholder={fr ? '0 = paiement en une fois' : '0 = single payment'}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Prix revente (FCFA)' : 'Resale price (FCFA)'}</label>
              <input type="number" value={form.suggested_resale_price_fcfa}
                onChange={(e) => set({ suggested_resale_price_fcfa: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">Deadline</label>
              <input type="datetime-local" value={form.deadline} onChange={(e) => set({ deadline: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Arrivée estimée' : 'Estimated arrival'}</label>
              <input type="datetime-local" value={form.estimated_arrival} onChange={(e) => set({ estimated_arrival: e.target.value })}
                className="input-dark w-full px-4 py-2 rounded-md" required />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="btn-outline px-6 py-3 rounded-md flex-1">
              {fr ? 'Annuler' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving}
              className="btn-gold px-6 py-3 rounded-md flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="save-groupage-btn">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (fr ? 'Enregistrer' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal d'edition de l'image produit d'un groupage
const EditImageModal = ({ groupage, fr, onClose, onSaved }) => {
  const [imageUrl, setImageUrl] = useState(groupage.product_image_url || '');
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const response = await api.post('/admin/scrape-product-image', { url: groupage.product_url });
      setImageUrl(response.data.image_url);
      toast.success(fr ? 'Image récupérée!' : 'Image fetched!');
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? "Impossible de récupérer l'image" : 'Could not fetch image'));
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/groupages/${groupage.groupage_id}`, { product_image_url: imageUrl || null });
      toast.success(fr ? 'Image mise à jour!' : 'Image updated!');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()} data-testid="edit-image-modal">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-['Bebas_Neue'] text-xl">{fr ? 'Image du produit' : 'Product image'}</h3>
          <button onClick={onClose} className="text-[#71717A] hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-[#71717A] mb-4 truncate">{groupage.title}</p>

        <div className="mb-4">
          <ImageDropZone value={imageUrl} onChange={setImageUrl} fr={fr} />
        </div>

        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder={fr ? "...ou collez l'URL d'une image" : '...or paste an image URL'}
          className="input-dark w-full px-4 py-2 rounded-md mb-3"
          data-testid="image-url-input"
        />

        <div className="flex gap-3">
          <button
            onClick={handleScrape}
            disabled={scraping || !groupage.product_url}
            className="btn-outline px-4 py-2 rounded-md flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {fr ? 'Depuis le lien produit' : 'From product link'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold px-4 py-2 rounded-md flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="save-image-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (fr ? 'Enregistrer' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Admin Contenu & SEO ============
//
// Gere les questions de FAQ et les guides. Publier enregistre en base (visible
// immediatement dans l'application) ; le bouton "Regenerer les pages" declenche
// un build du site pour que le contenu entre aussi dans les pages statiques
// lues par les robots qui n'executent pas JavaScript.

// Transforme un titre en slug d'URL : "Fret aérien Chine-Cameroun" -> "fret-aerien-chine-cameroun"
const slugify = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const AdminContent = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('guide');
  const [editing, setEditing] = useState(null); // 'new' | entry
  const [rebuilding, setRebuilding] = useState(false);
  const [dirtySincePublish, setDirtySincePublish] = useState(false);

  const fetchEntries = async () => {
    try {
      const response = await api.get('/admin/content');
      setEntries(response.data);
    } catch (error) {
      toast.error(fr ? 'Erreur de chargement' : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const response = await api.post('/admin/content/rebuild');
      toast.success(response.data.message);
      setDirtySincePublish(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setRebuilding(false);
    }
  };

  const togglePublished = async (entry) => {
    try {
      await api.put(`/admin/content/${entry.content_id}`, { published: !entry.published });
      setDirtySincePublish(true);
      fetchEntries();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    }
  };

  const handleDelete = async (entry) => {
    try {
      await api.delete(`/admin/content/${entry.content_id}`);
      toast.success(fr ? 'Supprimé' : 'Deleted');
      setDirtySincePublish(true);
      fetchEntries();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    }
  };

  const filtered = entries.filter((e) => e.type === tab);
  const publishedCount = entries.filter((e) => e.published).length;

  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>;
  }

  return (
    <div data-testid="admin-content">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h1 className="font-['Bebas_Neue'] text-3xl">
          {fr ? 'Contenu & SEO' : 'Content & SEO'}{' '}
          <span className="text-[#71717A] text-xl">({publishedCount} {fr ? 'publiés' : 'published'})</span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className={`px-4 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50 ${dirtySincePublish ? 'btn-gold' : 'btn-outline'}`}
            title={fr ? 'Régénère les pages statiques lues par Google et les IA' : 'Regenerate static pages'}
            data-testid="rebuild-btn"
          >
            {rebuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {fr ? 'Régénérer les pages' : 'Regenerate pages'}
          </button>
          <button
            onClick={() => setEditing('new')}
            className="btn-gold px-4 py-2 rounded-md text-sm flex items-center gap-2"
            data-testid="create-content-btn"
          >
            <Plus className="w-4 h-4" />
            {fr ? 'Nouveau' : 'New'}
          </button>
        </div>
      </div>

      <p className="text-sm text-[#71717A] mb-5 max-w-2xl">
        {fr
          ? "Publier rend le contenu visible immédiatement sur le site. Pour qu'il entre aussi dans les pages statiques lues par Google et les assistants IA, cliquez sur « Régénérer les pages » (2 à 3 minutes)."
          : 'Publishing makes content visible on the site right away. To also include it in the static pages read by Google and AI assistants, click "Regenerate pages".'}
      </p>

      {dirtySincePublish && (
        <div className="bg-[#F97316]/10 border border-[#F97316]/30 rounded-lg p-3 mb-5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-[#F97316] shrink-0" />
          <p className="text-sm text-[#F97316]">
            {fr
              ? 'Des changements ne sont pas encore dans les pages statiques. Cliquez sur « Régénérer les pages ».'
              : 'Changes are not in the static pages yet. Click "Regenerate pages".'}
          </p>
        </div>
      )}

      {/* Onglets FAQ / Guides */}
      <div className="flex gap-1 border-b border-[#2A2A2A] mb-5">
        {[
          { key: 'guide', label: fr ? 'Guides' : 'Guides', icon: FileText },
          { key: 'faq', label: 'FAQ', icon: HelpCircle }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm flex items-center gap-2 border-b-2 transition-colors ${
              tab === key ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#A1A1AA] hover:text-white'
            }`}
            data-testid={`content-tab-${key}`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="text-xs text-[#71717A]">({entries.filter((e) => e.type === key).length})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-10 text-center">
          <FileText className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
          <p className="text-[#A1A1AA] mb-1">
            {tab === 'guide'
              ? (fr ? 'Aucun guide pour le moment.' : 'No guide yet.')
              : (fr ? 'Aucune question ajoutée.' : 'No question added.')}
          </p>
          <p className="text-sm text-[#71717A]">
            {tab === 'guide'
              ? (fr ? 'Un guide devient une page à l\'adresse /guides/votre-slug' : 'A guide becomes a page at /guides/your-slug')
              : (fr ? 'Les questions s\'ajoutent à la fin de la page /faq' : 'Questions are appended to the /faq page')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div key={entry.content_id} className="bg-[#141414] border border-[#2A2A2A] rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-medium normal-case"
                        style={{ fontFamily: 'DM Sans, sans-serif', textTransform: 'none', letterSpacing: 'normal' }}>
                      {entry.type === 'faq' ? (entry.question || entry.title) : entry.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${entry.published ? 'badge-success' : 'badge-warning'}`}>
                      {entry.published ? (fr ? 'Publié' : 'Published') : (fr ? 'Brouillon' : 'Draft')}
                    </span>
                    {entry.cluster && (
                      <span className="text-xs text-[#71717A]">{entry.cluster}</span>
                    )}
                  </div>
                  {entry.type === 'guide' && (
                    <p className="text-xs text-[#71717A] font-mono">/guides/{entry.slug}</p>
                  )}
                  {entry.meta_description && (
                    <p className="text-sm text-[#A1A1AA] mt-1 line-clamp-2">{entry.meta_description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {entry.type === 'guide' && entry.published && (
                    <a
                      href={`/guides/${entry.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[#A1A1AA] hover:text-[#D4AF37]"
                      title={fr ? 'Voir la page' : 'View page'}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => togglePublished(entry)}
                    className="p-2 text-[#A1A1AA] hover:text-[#22C55E]"
                    title={entry.published ? (fr ? 'Dépublier' : 'Unpublish') : (fr ? 'Publier' : 'Publish')}
                  >
                    {entry.published ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditing(entry)}
                    className="p-2 text-[#A1A1AA] hover:text-[#D4AF37]"
                    title={fr ? 'Modifier' : 'Edit'}
                    data-testid={`edit-content-${entry.content_id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="p-2 text-[#A1A1AA] hover:text-[#EF4444]"
                    title={fr ? 'Supprimer' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ContentEditorModal
          entry={editing === 'new' ? null : editing}
          defaultType={tab}
          fr={fr}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setDirtySincePublish(true);
            fetchEntries();
          }}
        />
      )}
    </div>
  );
};

const ContentEditorModal = ({ entry, defaultType, fr, onClose, onSaved }) => {
  const isNew = !entry;
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [form, setForm] = useState({
    type: entry?.type || defaultType,
    slug: entry?.slug || '',
    title: entry?.title || '',
    meta_description: entry?.meta_description || '',
    question: entry?.question || '',
    answer: entry?.answer || '',
    body: entry?.body || '',
    cluster: entry?.cluster || '',
    published: entry?.published || false,
    order: entry?.order ?? 0
  });

  const isFaq = form.type === 'faq';

  // Le slug se derive du titre tant que l'admin ne l'a pas edite manuellement
  const setTitle = (value) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugTouched ? prev.slug : slugify(value)
    }));
  };
  const setQuestion = (value) => {
    setForm((prev) => ({
      ...prev,
      question: value,
      title: value,
      slug: slugTouched ? prev.slug : slugify(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isFaq && (!form.question.trim() || !form.answer.trim())) {
      toast.error(fr ? 'Question et réponse sont obligatoires' : 'Question and answer are required');
      return;
    }
    if (!isFaq && (!form.title.trim() || !form.body.trim())) {
      toast.error(fr ? 'Titre et contenu sont obligatoires' : 'Title and body are required');
      return;
    }
    if (!form.slug.trim()) {
      toast.error(fr ? 'Le slug est obligatoire' : 'Slug is required');
      return;
    }

    const payload = {
      type: form.type,
      slug: form.slug.trim(),
      title: (isFaq ? form.question : form.title).trim(),
      meta_description: form.meta_description.trim(),
      question: isFaq ? form.question.trim() : null,
      answer: isFaq ? form.answer.trim() : null,
      body: isFaq ? null : form.body,
      cluster: form.cluster.trim() || null,
      published: form.published,
      order: parseInt(form.order) || 0
    };

    setSaving(true);
    try {
      if (isNew) {
        await api.post('/admin/content', payload);
      } else {
        await api.put(`/admin/content/${entry.content_id}`, payload);
      }
      toast.success(fr ? 'Enregistré !' : 'Saved!');
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const bodyWords = form.body.trim() ? form.body.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="content-editor">
        <div className="p-6 border-b border-[#2A2A2A] flex justify-between items-center sticky top-0 bg-[#141414] z-10">
          <h2 className="font-['Bebas_Neue'] text-2xl">
            {isNew
              ? (isFaq ? (fr ? 'Nouvelle question' : 'New question') : (fr ? 'Nouveau guide' : 'New guide'))
              : (fr ? 'Modifier' : 'Edit')}
          </h2>
          <button onClick={onClose} className="text-[#71717A] hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isNew && (
            <div>
              <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Type de contenu' : 'Content type'}</label>
              <div className="flex gap-2">
                {[
                  { key: 'guide', label: fr ? 'Guide (page dédiée)' : 'Guide (own page)' },
                  { key: 'faq', label: fr ? 'Question de FAQ' : 'FAQ question' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, type: key })}
                    className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                      form.type === key
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-[#2A2A2A] text-[#A1A1AA] hover:border-[#71717A]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isFaq ? (
            <>
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {fr ? 'Question (telle que les gens la tapent sur Google)' : 'Question'}
                </label>
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="input-dark w-full px-4 py-2.5 rounded-md"
                  placeholder={fr ? 'Combien coûte le fret maritime Chine-Douala ?' : 'How much is sea freight?'}
                  required
                  data-testid="faq-question-input"
                />
              </div>
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">{fr ? 'Réponse' : 'Answer'}</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  className="input-dark w-full px-4 py-2.5 rounded-md h-40 resize-y"
                  placeholder={fr
                    ? 'Réponse complète et autonome : donnez des chiffres précis, ce sont eux que Google et les IA reprennent.'
                    : 'A complete, self-contained answer with precise figures.'}
                  required
                  data-testid="faq-answer-input"
                />
                <p className="text-xs text-[#71717A] mt-1">
                  {fr
                    ? 'Conseil : 3 à 5 phrases, avec au moins un chiffre concret et le nom de votre plateforme.'
                    : 'Tip: 3-5 sentences with at least one concrete figure.'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {fr ? 'Titre de la page' : 'Page title'}
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-dark w-full px-4 py-2.5 rounded-md"
                  placeholder={fr ? 'Fret aérien Chine-Cameroun : tarifs, délais, quand le choisir' : 'Air freight China-Cameroon'}
                  required
                  data-testid="guide-title-input"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#A1A1AA] mb-2">
                    {fr ? 'Adresse de la page' : 'Page URL'}
                  </label>
                  <div className="flex items-center">
                    <span className="text-xs text-[#71717A] font-mono px-2 py-2.5 bg-[#0A0A0A] border border-r-0 border-[#2A2A2A] rounded-l-md whitespace-nowrap">
                      /guides/
                    </span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }}
                      className="input-dark flex-1 px-3 py-2.5 rounded-r-md font-mono text-sm min-w-0"
                      required
                      data-testid="guide-slug-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#A1A1AA] mb-2">
                    {fr ? 'Grappe thématique' : 'Content cluster'}
                  </label>
                  <input
                    type="text"
                    value={form.cluster}
                    onChange={(e) => setForm({ ...form, cluster: e.target.value })}
                    className="input-dark w-full px-4 py-2.5 rounded-md"
                    placeholder={fr ? 'Transport, fret et douane' : 'Shipping and customs'}
                    list="cluster-suggestions"
                  />
                  <datalist id="cluster-suggestions">
                    <option value="Voyager en Chine pour acheter" />
                    <option value="Les villes et marchés de gros chinois" />
                    <option value="Trouver et vérifier un fournisseur" />
                    <option value="Transport, fret et douane" />
                    <option value="Payer et financer" />
                    <option value="Rentabilité par secteur" />
                    <option value="Se former et décider" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#A1A1AA] mb-2">
                  {fr ? 'Contenu' : 'Body'}
                  <span className="text-xs text-[#71717A] ml-2">{bodyWords} {fr ? 'mots' : 'words'}</span>
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="input-dark w-full px-4 py-3 rounded-md h-80 resize-y font-mono text-sm leading-relaxed"
                  placeholder={fr
                    ? '## Un titre de section\n\nUn paragraphe avec du **gras**.\n\n- un point de liste\n- un autre\n\n| Mode | Prix | Délai |\n| --- | --- | --- |\n| Aérien | 8 997 F/kg | 7-15 j |\n\n> Une remarque mise en avant.'
                    : '## Section title\n\nA paragraph with **bold**.\n\n- list item\n\n| A | B |\n| --- | --- |'}
                  required
                  data-testid="guide-body-input"
                />
                <p className="text-xs text-[#71717A] mt-1">
                  {fr
                    ? 'Mise en forme : ## titre, ### sous-titre, - liste, 1. liste numérotée, **gras**, *italique*, [texte](/lien), > remarque, et tableaux avec des barres verticales.'
                    : 'Formatting: ## heading, - list, **bold**, [text](/link), > note, and pipe tables.'}
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-[#A1A1AA] mb-2">
              {fr ? 'Description pour Google (150-160 caractères)' : 'Meta description'}
              <span className={`text-xs ml-2 ${form.meta_description.length > 160 ? 'text-[#EF4444]' : 'text-[#71717A]'}`}>
                {form.meta_description.length}/160
              </span>
            </label>
            <textarea
              value={form.meta_description}
              onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
              className="input-dark w-full px-4 py-2.5 rounded-md h-20 resize-y"
              placeholder={fr
                ? "Ce texte s'affiche sous le titre dans les résultats Google. Soyez concret."
                : 'Shown under the title in Google results.'}
            />
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm text-[#A1A1AA] cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="accent-[#D4AF37]"
                data-testid="content-published-checkbox"
              />
              {fr ? 'Publier maintenant' : 'Publish now'}
            </label>
            <label className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              {fr ? 'Ordre' : 'Order'}
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
                className="input-dark w-20 px-3 py-1.5 rounded-md"
              />
            </label>
          </div>

          <div className="flex gap-4 pt-3">
            <button type="button" onClick={onClose} className="btn-outline px-6 py-3 rounded-md flex-1">
              {fr ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-gold px-6 py-3 rounded-md flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="save-content-btn"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (fr ? 'Enregistrer' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============ Admin Users (vue 360 des utilisateurs) ============

const AdminUsers = () => {
  const { i18n } = useTranslation();
  const fr = i18n.language === 'fr';
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const PAGE_SIZE = 25;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, skip: page * PAGE_SIZE });
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      if (kycFilter) params.set('kyc_status', kycFilter);
      const response = await api.get(`/admin/users?${params}`);
      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(fr ? 'Erreur de chargement' : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, kycFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  const roleBadge = (role) => {
    const styles = {
      admin: 'bg-[#D4AF37]/20 text-[#D4AF37]',
      member: 'bg-[#2A2A2A] text-[#A1A1AA]',
      transitaire: 'bg-[#22C55E]/20 text-[#22C55E]',
      supplier: 'bg-[#F97316]/20 text-[#F97316]'
    };
    const labels = fr
      ? { admin: 'Admin', member: 'Membre', transitaire: 'Transitaire', supplier: 'Fournisseur' }
      : { admin: 'Admin', member: 'Member', transitaire: 'Forwarder', supplier: 'Supplier' };
    return <span className={`px-2 py-0.5 rounded text-xs ${styles[role] || styles.member}`}>{labels[role] || role}</span>;
  };

  const kycBadge = (status) => {
    const map = { pending: 'badge-warning', submitted: 'badge-gold', validated: 'badge-success', rejected: 'badge-danger' };
    return <span className={`${map[status] || 'badge-warning'} px-2 py-0.5 rounded text-xs`}>{status}</span>;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div data-testid="admin-users">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-['Bebas_Neue'] text-3xl">
          {fr ? 'Utilisateurs' : 'Users'} <span className="text-[#71717A] text-xl">({total})</span>
        </h1>
      </div>

      {/* Recherche + filtres */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={fr ? 'Rechercher (nom, email, téléphone, ville)...' : 'Search (name, email, phone, city)...'}
          className="input-dark px-4 py-2 rounded-md flex-1 min-w-[220px]"
          data-testid="users-search-input"
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
          className="input-dark px-3 py-2 rounded-md">
          <option value="">{fr ? 'Tous les rôles' : 'All roles'}</option>
          <option value="member">{fr ? 'Membres' : 'Members'}</option>
          <option value="admin">Admins</option>
          <option value="transitaire">{fr ? 'Transitaires' : 'Forwarders'}</option>
          <option value="supplier">{fr ? 'Fournisseurs' : 'Suppliers'}</option>
        </select>
        <select value={kycFilter} onChange={(e) => { setKycFilter(e.target.value); setPage(0); }}
          className="input-dark px-3 py-2 rounded-md">
          <option value="">{fr ? 'Tout KYC' : 'All KYC'}</option>
          <option value="pending">pending</option>
          <option value="submitted">submitted</option>
          <option value="validated">validated</option>
          <option value="rejected">rejected</option>
        </select>
        <button type="submit" className="btn-gold px-4 py-2 rounded-md">
          {fr ? 'Rechercher' : 'Search'}
        </button>
      </form>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>
      ) : (
        <>
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-x-auto">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>{fr ? 'Nom' : 'Name'}</th>
                  <th>Email</th>
                  <th>{fr ? 'Rôle' : 'Role'}</th>
                  <th>KYC</th>
                  <th>{fr ? 'Ville' : 'City'}</th>
                  <th>{fr ? 'Inscrit le' : 'Joined'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="cursor-pointer" onClick={() => setSelectedUserId(u.user_id)}>
                    <td className="font-medium">{u.name}</td>
                    <td className="text-[#A1A1AA]">
                      {u.email}
                      {u.email_verified === false && (
                        <span className="ml-2 badge-warning px-1.5 py-0.5 rounded text-[10px]">{fr ? 'non vérifié' : 'unverified'}</span>
                      )}
                    </td>
                    <td>{roleBadge(u.role)}</td>
                    <td>{kycBadge(u.kyc_status)}</td>
                    <td className="text-[#A1A1AA]">{u.location || '—'}</td>
                    <td className="text-[#71717A] text-sm">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US') : '—'}
                    </td>
                    <td><Eye className="w-4 h-4 text-[#D4AF37]" /></td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-[#71717A] py-8">
                    {fr ? 'Aucun utilisateur trouvé' : 'No user found'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="btn-outline px-3 py-1.5 rounded-md text-sm disabled:opacity-40">
                ← {fr ? 'Précédent' : 'Previous'}
              </button>
              <span className="text-sm text-[#71717A]">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="btn-outline px-3 py-1.5 rounded-md text-sm disabled:opacity-40">
                {fr ? 'Suivant' : 'Next'} →
              </button>
            </div>
          )}
        </>
      )}

      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          fr={fr}
          onClose={() => setSelectedUserId(null)}
          onChanged={fetchUsers}
        />
      )}
    </div>
  );
};

const UserDetailModal = ({ userId, fr, onClose, onChanged }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kycSaving, setKycSaving] = useState(false);

  const fetchDetails = async () => {
    try {
      const response = await api.get(`/admin/users/${userId}/details`);
      setData(response.data);
    } catch (error) {
      toast.error(fr ? 'Erreur de chargement' : 'Loading error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const updateKyc = async (status) => {
    setKycSaving(true);
    try {
      await api.put(`/admin/kyc/${userId}`, { status });
      toast.success(`KYC ${status}`);
      fetchDetails();
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setKycSaving(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString(fr ? 'fr-FR' : 'en-US') : '—';
  const fcfa = (n) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))} FCFA`;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} data-testid="user-detail-modal">
        {loading || !data ? (
          <div className="p-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" /></div>
        ) : (
          <>
            <div className="p-6 border-b border-[#2A2A2A] flex justify-between items-start">
              <div>
                <h2 className="font-['Bebas_Neue'] text-2xl">{data.user.name}</h2>
                <p className="text-sm text-[#A1A1AA]">{data.user.email}</p>
              </div>
              <button onClick={onClose} className="text-[#71717A] hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Infos profil */}
              <section>
                <h3 className="text-sm font-medium text-[#D4AF37] uppercase tracking-wide mb-3">
                  {fr ? 'Profil' : 'Profile'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <Info label={fr ? 'Rôle' : 'Role'} value={data.user.role} />
                  <Info label={fr ? 'Téléphone' : 'Phone'} value={data.user.phone} />
                  <Info label={fr ? 'Ville' : 'City'} value={data.user.location} />
                  <Info label={fr ? 'Langue' : 'Language'} value={data.user.language} />
                  <Info label="Mobile Money" value={data.user.mobile_money?.number
                    ? `${data.user.mobile_money.provider || ''} ${data.user.mobile_money.number}` : null} />
                  <Info label={fr ? 'Profil acheteur' : 'Buyer profile'} value={data.user.buyer_profile} />
                  <Info label={fr ? 'Email vérifié' : 'Email verified'}
                    value={data.user.email_verified === true ? '✓' : data.user.email_verified === false ? '✗' : '—'} />
                  <Info label="CGU" value={data.user.cgu_accepted ? '✓' : '✗'} />
                  <Info label={fr ? 'Inscrit le' : 'Joined'} value={fmtDate(data.user.created_at)} />
                  <Info label={fr ? 'Messages chat' : 'Chat messages'} value={String(data.message_count)} />
                </div>
              </section>

              {/* KYC */}
              <section>
                <h3 className="text-sm font-medium text-[#D4AF37] uppercase tracking-wide mb-3">
                  KYC — <span className="normal-case">{data.user.kyc_status}</span>
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {['id_front', 'id_back', 'selfie'].map(key => (
                    data.user.kyc_documents?.[key] ? (
                      <a key={key} href={data.user.kyc_documents[key]} target="_blank" rel="noopener noreferrer"
                        className="btn-outline px-3 py-1.5 rounded-md text-sm">
                        📄 {key.replace('_', ' ')}
                      </a>
                    ) : (
                      <span key={key} className="text-xs text-[#71717A] border border-dashed border-[#2A2A2A] px-3 py-1.5 rounded-md">
                        {key.replace('_', ' ')} : {fr ? 'absent' : 'missing'}
                      </span>
                    )
                  ))}
                  <div className="flex gap-2 ml-auto">
                    {data.user.kyc_status !== 'validated' && (
                      <button onClick={() => updateKyc('validated')} disabled={kycSaving}
                        className="bg-[#22C55E] text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-50">
                        {fr ? 'Valider' : 'Validate'}
                      </button>
                    )}
                    {data.user.kyc_status !== 'rejected' && (
                      <button onClick={() => updateKyc('rejected')} disabled={kycSaving}
                        className="bg-[#EF4444] text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-50">
                        {fr ? 'Rejeter' : 'Reject'}
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Groupages */}
              <section>
                <h3 className="text-sm font-medium text-[#D4AF37] uppercase tracking-wide mb-3">
                  {fr ? 'Groupages rejoints' : 'Joined groupages'} ({data.memberships.length})
                </h3>
                {data.memberships.length === 0 ? (
                  <p className="text-sm text-[#71717A]">{fr ? 'Aucun' : 'None'}</p>
                ) : (
                  <div className="space-y-2">
                    {data.memberships.map(m => (
                      <div key={m.member_id} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-md p-3 text-sm">
                        <div className="flex justify-between gap-2 flex-wrap">
                          <Link to={`/groupages/${m.groupage_id}`} className="font-medium text-[#D4AF37] hover:underline">
                            {m.groupage?.title || m.groupage_id}
                          </Link>
                          <span className="text-[#71717A]">{fmtDate(m.joined_at)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[#A1A1AA]">
                          <span>{m.quantity} {fr ? 'unités' : 'units'} ({m.share_percentage}%)</span>
                          <span>{fcfa(m.total_price_fcfa)}</span>
                          {m.pickup_city && <span>📍 {m.pickup_city}</span>}
                          <span className={m.caution_paid ? 'text-[#22C55E]' : 'text-[#F97316]'}>
                            {fr ? 'Caution' : 'Deposit'}: {m.caution_paid ? '✓' : '✗'}
                          </span>
                          <span className={m.solde_paid ? 'text-[#22C55E]' : 'text-[#F97316]'}>
                            {fr ? 'Solde' : 'Balance'}: {m.solde_paid ? '✓' : '✗'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Propositions */}
              <section>
                <h3 className="text-sm font-medium text-[#D4AF37] uppercase tracking-wide mb-3">
                  {fr ? 'Propositions de produits' : 'Product proposals'} ({data.proposals.length})
                </h3>
                {data.proposals.length === 0 ? (
                  <p className="text-sm text-[#71717A]">{fr ? 'Aucune' : 'None'}</p>
                ) : (
                  <div className="space-y-2">
                    {data.proposals.map(p => (
                      <div key={p.proposal_id} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-md p-3 text-sm flex justify-between gap-2 flex-wrap">
                        <div>
                          <span className="font-medium">{p.title}</span>
                          <span className="text-[#71717A] ml-2">
                            {p.is_creator ? (fr ? '(créateur)' : '(creator)') : (fr ? '(intéressé)' : '(interested)')}
                          </span>
                        </div>
                        <div className="flex gap-3 text-[#A1A1AA]">
                          <span>{p.interested_count || 1} {fr ? 'intéressé(s)' : 'interested'}</span>
                          <span className={`badge-${p.status === 'approved' || p.status === 'featured' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'} px-2 py-0.5 rounded text-xs`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Avis */}
              <section>
                <h3 className="text-sm font-medium text-[#D4AF37] uppercase tracking-wide mb-3">
                  {fr ? 'Avis laissés' : 'Reviews'} ({data.reviews.length})
                </h3>
                {data.reviews.length === 0 ? (
                  <p className="text-sm text-[#71717A]">{fr ? 'Aucun' : 'None'}</p>
                ) : (
                  <div className="space-y-2">
                    {data.reviews.map(r => (
                      <div key={r.review_id} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-md p-3 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{r.groupage_title || r.groupage_id}</span>
                          <span className="text-[#D4AF37]">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        </div>
                        {r.comment && <p className="text-[#A1A1AA] mt-1">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Paiements */}
              <section>
                <h3 className="text-sm font-medium text-[#D4AF37] uppercase tracking-wide mb-3">
                  {fr ? 'Paiements' : 'Payments'} ({data.payments.length})
                </h3>
                {data.payments.length === 0 ? (
                  <p className="text-sm text-[#71717A]">{fr ? 'Aucun' : 'None'}</p>
                ) : (
                  <div className="space-y-1">
                    {data.payments.map(p => (
                      <div key={p.payment_id} className="flex justify-between gap-2 text-sm bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-3 py-2">
                        <span>{p.payment_type} · {p.amount} {p.currency?.toUpperCase()}</span>
                        <span className={p.status === 'completed' ? 'text-[#22C55E]' : 'text-[#F97316]'}>{p.status}</span>
                        <span className="text-[#71717A]">{fmtDate(p.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <p className="text-xs text-[#71717A]">{label}</p>
    <p className="text-[#A1A1AA]">{value || '—'}</p>
  </div>
);

export default AdminPage;
