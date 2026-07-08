import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { 
  Package, FileText, Clock, CheckCircle, AlertCircle,
  ChevronRight, Download, CreditCard
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardPage = () => {
  const { t, i18n } = useTranslation();
  const { user, token } = useAuth();
  const [groupages, setGroupages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('groupages');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API}/user/groupages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroupages(response.data);
      } catch (error) {
        console.error('Error fetching user groupages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

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
            {['groupages', 'history', 'documents'].map(tab => (
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
                {t(`dashboard.${tab === 'groupages' ? 'myGroupages' : tab}`)}
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

export default DashboardPage;
