import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { motion } from 'framer-motion';
import { Package, Clock, Users, Search, Filter } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GroupagesPage = () => {
  const { t, i18n } = useTranslation();
  const [groupages, setGroupages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchGroupages = async () => {
      try {
        const params = filter !== 'all' ? `?status=${filter}` : '';
        const response = await axios.get(`${API}/groupages${params}`);
        setGroupages(response.data);
      } catch (error) {
        console.error('Error fetching groupages:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroupages();
  }, [filter]);

  const getLocalizedText = (item, field) => {
    return i18n.language === 'en' ? item[`${field}_en`] || item[field] : item[field];
  };

  const filteredGroupages = groupages.filter(g => {
    if (!search) return true;
    const title = getLocalizedText(g, 'title').toLowerCase();
    return title.includes(search.toLowerCase());
  });

  return (
    <Layout>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16" data-testid="groupages-page">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-['Bebas_Neue'] text-4xl md:text-5xl mb-2">{t('groupages.title')}</h1>
            <p className="text-[#A1A1AA]">
              {i18n.language === 'fr' 
                ? 'Rejoignez un groupe et économisez sur vos importations'
                : 'Join a group and save on your imports'
              }
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#71717A]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search') + '...'}
                className="input-dark w-full pl-10 pr-4 py-3 rounded-md"
                data-testid="search-input"
              />
            </div>
            
            <div className="flex gap-2">
              {['all', 'open', 'closed', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    filter === status 
                      ? 'bg-[#D4AF37] text-[#0A0A0A]' 
                      : 'bg-[#1A1A1A] text-[#A1A1AA] hover:bg-[#2A2A2A]'
                  }`}
                  data-testid={`filter-${status}`}
                >
                  {status === 'all' ? t('common.all') : t(`groupages.status.${status}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Groupages Grid */}
          {loading ? (
            <div className="text-center py-16 text-[#A1A1AA]">
              {t('common.loading')}
            </div>
          ) : filteredGroupages.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#A1A1AA]">{t('groupages.empty')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredGroupages.map((groupage, index) => (
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
      </div>
    </Layout>
  );
};

const GroupageCard = ({ groupage, index, getLocalizedText }) => {
  const { t, i18n } = useTranslation();
  
  const deadline = new Date(groupage.deadline);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
  // La jauge suit la quantite reservee par rapport a la quantite cible de la
  // commande groupee (pas le nombre de personnes)
  const reserved = groupage.current_quantity_reserved || 0;
  const unitsLeft = Math.max(0, (groupage.total_quantity || 0) - reserved);
  const progress = groupage.total_quantity ? (reserved / groupage.total_quantity) * 100 : 0;

  const statusColors = {
    open: 'badge-success',
    closed: 'badge-warning',
    completed: 'badge-gold'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
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
          <span className={`${statusColors[groupage.status]} px-3 py-1 rounded-full text-xs font-medium`}>
            {t(`groupages.status.${groupage.status}`)}
          </span>
        </div>

        {/* Category Badge */}
        <div className="absolute bottom-4 left-4">
          <span className="bg-[#0A0A0A]/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white">
            {groupage.product_category}
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

        {/* Supplier Info */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-[#71717A]">{t('groupage.supplier')}:</span>
          <span className="text-white">{groupage.supplier_name}</span>
          {groupage.supplier_gold_status && (
            <span className="badge-gold px-2 py-0.5 rounded text-xs">Gold</span>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#A1A1AA]">
              {reserved}/{groupage.total_quantity} {i18n.language === 'fr' ? 'unités réservées' : 'units reserved'}
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
          <div className="flex items-center gap-1 text-[#22C55E]">
            <Users className="w-4 h-4" />
            <span>{unitsLeft} {i18n.language === 'fr' ? 'unités restantes' : 'units left'}</span>
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

export default GroupagesPage;
