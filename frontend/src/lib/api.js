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
