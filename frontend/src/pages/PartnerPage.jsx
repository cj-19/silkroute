import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import {
  Package, Truck, FileText, Upload, Loader2, CheckCircle,
  MessageSquare, Star, Send, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { api } from '@/lib/api';

// Phases d'expedition, alignees sur SHIPMENT_PHASES cote backend.
const PHASES = ['preparation', 'picked_up', 'in_transit', 'customs', 'arrived', 'delivered'];

const PHASE_LABELS = {
  fr: {
    preparation: 'Préparation fournisseur',
    picked_up: 'Enlevé en Chine',
    in_transit: 'En transit',
    customs: 'Dédouanement',
    arrived: 'Arrivé au pays',
    delivered: 'Livré / Disponible'
  },
  en: {
    preparation: 'Supplier preparation',
    picked_up: 'Picked up in China',
    in_transit: 'In transit',
    customs: 'Customs clearance',
    arrived: 'Arrived in country',
    delivered: 'Delivered / Available'
  }
};

export const phaseLabel = (phase, lang) => (PHASE_LABELS[lang === 'fr' ? 'fr' : 'en'][phase] || phase);

// Portail partenaire : le transitaire met a jour les phases et pousse les documents
// logistiques ; le fournisseur pousse ses documents et repond aux avis post-livraison.
const PartnerPage = () => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [groupages, setGroupages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fr = i18n.language === 'fr';
  const isTransitaire = user?.role === 'transitaire';

  const fetchGroupages = async () => {
    try {
      const response = await api.get('/partner/groupages');
      setGroupages(response.data);
    } catch (error) {
      console.error('Error fetching partner groupages:', error);
      toast.error(fr ? 'Erreur de chargement' : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout showFooter={false}>
      <div className="min-h-screen bg-[#0A0A0A] pt-8 pb-16" data-testid="partner-page">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            {isTransitaire ? <Truck className="w-8 h-8 text-[#D4AF37]" /> : <Package className="w-8 h-8 text-[#D4AF37]" />}
            <h1 className="font-['Bebas_Neue'] text-4xl">
              {isTransitaire
                ? (fr ? 'Espace Transitaire' : 'Forwarder Space')
                : (fr ? 'Espace Fournisseur' : 'Supplier Space')}
            </h1>
          </div>
          <p className="text-[#A1A1AA] mb-8">
            {fr ? `Bonjour, ${user?.name}` : `Hello, ${user?.name}`} —{' '}
            {isTransitaire
              ? (fr ? 'mettez à jour les phases de livraison et les documents logistiques de vos groupages.'
                    : 'update delivery phases and logistics documents for your groupages.')
              : (fr ? 'gérez vos documents et répondez aux avis des acheteurs.'
                    : 'manage your documents and reply to buyer reviews.')}
          </p>

          {loading ? (
            <div className="text-center py-16">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D4AF37]" />
            </div>
          ) : groupages.length === 0 ? (
            <div className="text-center py-16 bg-[#141414] rounded-lg border border-[#2A2A2A]">
              <Package className="w-16 h-16 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#A1A1AA]">
                {fr ? 'Aucun groupage ne vous est assigné pour le moment.' : 'No groupage assigned to you yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupages.map(g => (
                <PartnerGroupageCard
                  key={g.groupage_id}
                  groupage={g}
                  isTransitaire={isTransitaire}
                  fr={fr}
                  onUpdated={fetchGroupages}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

const PartnerGroupageCard = ({ groupage, isTransitaire, fr, onUpdated }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] rounded-lg overflow-hidden" data-testid={`partner-groupage-${groupage.groupage_id}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between gap-4 hover:bg-[#1A1A1A] transition-colors text-left"
      >
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{groupage.title}</h3>
          <p className="text-sm text-[#71717A]">
            {groupage.current_members} {fr ? 'membres' : 'members'} · {groupage.total_quantity} {fr ? 'unités' : 'units'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="badge-gold px-3 py-1 rounded-full text-xs">
            {phaseLabel(groupage.shipment_status || 'preparation', fr ? 'fr' : 'en')}
          </span>
          {expanded ? <ChevronUp className="w-5 h-5 text-[#71717A]" /> : <ChevronDown className="w-5 h-5 text-[#71717A]" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2A2A] p-4 space-y-6">
          {isTransitaire && <PhaseUpdateSection groupage={groupage} fr={fr} onUpdated={onUpdated} />}
          <DocumentUploadSection groupage={groupage} isTransitaire={isTransitaire} fr={fr} onUpdated={onUpdated} />
          {!isTransitaire && <SupplierReviewsSection groupage={groupage} fr={fr} />}
        </div>
      )}
    </div>
  );
};

// --- Transitaire : mise a jour de phase ---
const PhaseUpdateSection = ({ groupage, fr, onUpdated }) => {
  const currentIdx = PHASES.indexOf(groupage.shipment_status || 'preparation');
  const [phase, setPhase] = useState(groupage.shipment_status || 'preparation');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await api.put(`/partner/groupages/${groupage.groupage_id}/phase`, { phase, note: note || null });
      toast.success(fr ? 'Phase mise à jour!' : 'Phase updated!');
      setNote('');
      onUpdated();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <Truck className="w-5 h-5 text-[#D4AF37]" />
        {fr ? 'Phase de livraison' : 'Delivery phase'}
      </h4>

      {/* Stepper visuel */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
        {PHASES.map((p, idx) => (
          <React.Fragment key={p}>
            <div className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
              idx < currentIdx ? 'bg-[#22C55E]/20 text-[#22C55E]'
              : idx === currentIdx ? 'bg-[#D4AF37] text-[#0A0A0A] font-semibold'
              : 'bg-[#1A1A1A] text-[#71717A]'
            }`}>
              {phaseLabel(p, fr ? 'fr' : 'en')}
            </div>
            {idx < PHASES.length - 1 && <div className="w-4 h-0.5 bg-[#2A2A2A] shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="input-dark px-4 py-2 rounded-md"
          data-testid="phase-select"
        >
          {PHASES.map(p => (
            <option key={p} value={p}>{phaseLabel(p, fr ? 'fr' : 'en')}</option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={fr ? 'Note (optionnel), ex: n° de vol/conteneur' : 'Note (optional), e.g. flight/container no.'}
          className="input-dark px-4 py-2 rounded-md"
        />
        <button
          onClick={handleUpdate}
          disabled={saving}
          className="btn-gold px-4 py-2 rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="update-phase-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {fr ? 'Mettre à jour' : 'Update'}
        </button>
      </div>

      {/* Historique */}
      {groupage.shipment_timeline?.length > 0 && (
        <div className="mt-4 space-y-2">
          {[...groupage.shipment_timeline].reverse().map((entry, idx) => (
            <div key={idx} className="text-xs text-[#71717A] flex items-center gap-2">
              <span className="text-[#D4AF37]">{phaseLabel(entry.phase, fr ? 'fr' : 'en')}</span>
              <span>· {new Date(entry.at).toLocaleString(fr ? 'fr-FR' : 'en-US')}</span>
              {entry.note && <span>· {entry.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Upload de documents (transitaire: logistiques / fournisseur: fournisseur) ---
const DOC_TYPES_TRANSITAIRE = ['bl', 'packing_list', 'invoice', 'customs'];
const DOC_TYPES_SUPPLIER = ['invoice', 'certificate', 'quality_report', 'other'];

const DocumentUploadSection = ({ groupage, isTransitaire, fr, onUpdated }) => {
  const [docType, setDocType] = useState(isTransitaire ? 'bl' : 'invoice');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const docTypes = isTransitaire ? DOC_TYPES_TRANSITAIRE : DOC_TYPES_SUPPLIER;
  const existingDocs = isTransitaire
    ? (groupage.logistics_documents || [])
    : (groupage.supplier_extra_documents || []);

  const handleUpload = async () => {
    if (!file) {
      toast.error(fr ? 'Sélectionnez un fichier' : 'Select a file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(fr ? 'Fichier trop volumineux (max 10MB)' : 'File too large (max 10MB)');
      return;
    }

    setUploading(true);
    try {
      const folder = isTransitaire ? `logistics_docs/${groupage.groupage_id}` : `supplier_docs/${groupage.groupage_id}`;
      const sigResponse = await api.get(`/cloudinary/signature?folder=${folder}`);
      const sig = sigResponse.data;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sig.api_key);
      formData.append('timestamp', sig.timestamp);
      formData.append('signature', sig.signature);
      formData.append('folder', sig.folder);

      // "auto" pour accepter images ET pdf
      const uploadResponse = await axios.post(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/auto/upload`,
        formData
      );

      await api.post(`/partner/groupages/${groupage.groupage_id}/documents`, {
        doc_type: docType,
        url: uploadResponse.data.secure_url
      });

      toast.success(fr ? 'Document ajouté!' : 'Document added!');
      setFile(null);
      onUpdated();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || (fr ? "Échec de l'envoi" : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#D4AF37]" />
        {fr ? 'Documents' : 'Documents'}
      </h4>

      {existingDocs.length > 0 && (
        <div className="grid md:grid-cols-2 gap-2 mb-4">
          {existingDocs.map((doc, idx) => (
            <a
              key={idx}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-md px-3 py-2 text-sm hover:border-[#D4AF37] transition-colors"
            >
              <FileText className="w-4 h-4 text-[#D4AF37]" />
              <span className="uppercase">{doc.doc_type}</span>
              <span className="text-xs text-[#71717A] ml-auto">
                {doc.uploaded_at && new Date(doc.uploaded_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US')}
              </span>
            </a>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="input-dark px-4 py-2 rounded-md"
        >
          {docTypes.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
        <label className="input-dark px-4 py-2 rounded-md cursor-pointer flex items-center gap-2 overflow-hidden">
          <Upload className="w-4 h-4 text-[#71717A] shrink-0" />
          <span className="text-sm truncate">
            {file ? file.name : (fr ? 'Choisir un fichier' : 'Choose file')}
          </span>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files[0] || null)}
            className="hidden"
          />
        </label>
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="btn-outline px-4 py-2 rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="upload-doc-btn"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {fr ? 'Envoyer' : 'Upload'}
        </button>
      </div>
    </div>
  );
};

// --- Fournisseur : avis post-livraison et reponses ---
const SupplierReviewsSection = ({ groupage, fr }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [sendingId, setSendingId] = useState(null);

  const fetchReviews = async () => {
    try {
      const response = await api.get(`/groupages/${groupage.groupage_id}/reviews`);
      setReviews(response.data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReply = async (reviewId) => {
    const reply = (replyDrafts[reviewId] || '').trim();
    if (!reply) return;

    setSendingId(reviewId);
    try {
      await api.post(`/partner/reviews/${reviewId}/reply`, { reply });
      toast.success(fr ? 'Réponse envoyée!' : 'Reply sent!');
      setReplyDrafts(prev => ({ ...prev, [reviewId]: '' }));
      fetchReviews();
    } catch (error) {
      toast.error(error.response?.data?.detail || (fr ? 'Erreur' : 'Error'));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      <h4 className="font-medium mb-3 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-[#D4AF37]" />
        {fr ? 'Avis des acheteurs' : 'Buyer reviews'}
      </h4>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#71717A]" />
      ) : reviews.length === 0 ? (
        <p className="text-sm text-[#71717A]">
          {fr ? 'Aucun avis pour le moment (les avis sont possibles après livraison).' : 'No reviews yet (reviews open after delivery).'}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.review_id} className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{review.user_name}</span>
                <span className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= review.rating ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-[#2A2A2A]'}`} />
                  ))}
                </span>
              </div>
              {review.comment && <p className="text-sm text-[#A1A1AA]">{review.comment}</p>}

              {review.supplier_reply ? (
                <div className="mt-2 pl-3 border-l-2 border-[#D4AF37]/40">
                  <p className="text-xs text-[#D4AF37] mb-0.5">{fr ? 'Votre réponse' : 'Your reply'}</p>
                  <p className="text-sm text-[#A1A1AA]">{review.supplier_reply}</p>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={replyDrafts[review.review_id] || ''}
                    onChange={(e) => setReplyDrafts(prev => ({ ...prev, [review.review_id]: e.target.value }))}
                    placeholder={fr ? 'Répondre à cet avis...' : 'Reply to this review...'}
                    className="input-dark flex-1 px-3 py-1.5 rounded-md text-sm"
                  />
                  <button
                    onClick={() => handleReply(review.review_id)}
                    disabled={sendingId === review.review_id}
                    className="btn-gold px-3 py-1.5 rounded-md disabled:opacity-50"
                  >
                    {sendingId === review.review_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartnerPage;
