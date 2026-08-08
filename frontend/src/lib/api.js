import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Instance dediee aux appels vers notre propre backend : envoie le cookie httpOnly
// d'authentification automatiquement (withCredentials), sans jamais exposer le
// token en JS. Ne pas utiliser cette instance pour des appels vers des domaines
// tiers (ex: upload direct Cloudinary) : withCredentials ferait echouer le CORS
// puisque ces services ne renvoient pas Access-Control-Allow-Credentials.
export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true
});

/**
 * Extrait un message d'erreur AFFICHABLE d'une reponse API.
 *
 * `detail` est une simple chaine pour la plupart de nos erreurs (HTTPException),
 * mais FastAPI renvoie une LISTE d'objets {type, loc, msg, input, url} des
 * qu'une requete echoue a la validation Pydantic (HTTP 422) - jamais une
 * chaine dans ce cas. Rendre cette liste directement dans du JSX
 * (`{erreur}`) plante toute l'application React ("Objects are not valid as
 * a React child") : c'est ce qui a provoque un ecran noir complet lors d'un
 * paiement carte invalide. Cette fonction garantit de toujours renvoyer une
 * chaine, quelle que soit la forme de l'erreur.
 */
export function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map(d => (typeof d === 'string' ? d : d?.msg)).filter(Boolean).join(' — ') || fallback;
  }
  return fallback;
}
