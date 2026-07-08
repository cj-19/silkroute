# Guide de déploiement SilkRoute — hébergement classique

Ce guide t'accompagne pour sortir SilkRoute de l'environnement de prévisualisation Emergent.sh et le déployer sur un hébergement standard, toujours actif (plus de mise en veille).

Stack retenue : MongoDB Atlas (base de données) + Railway (backend FastAPI + WebSocket) + Vercel (frontend React).

---

## 0. Avant de commencer

Le dossier `silkroute/` fourni avec ce guide contient déjà tout le code corrigé (bug de pricing, sécurité chat, formulaire admin, paiement Stripe officiel, etc.). Il ne contient **aucun secret** (`.env` exclus). Tu vas créer tes propres clés à chaque étape.

---

## 1. Créer le dépôt GitHub

1. Crée un nouveau dépôt (public ou privé) sur GitHub, par exemple `silkroute`.
2. En local, dans le dossier `silkroute/` :
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/silkroute.git
   git push -u origin main
   ```
3. Vérifie sur GitHub qu'aucun fichier `.env` n'apparaît dans le dépôt (le `.gitignore` a été corrigé pour ça, mais un contrôle visuel ne coûte rien).

---

## 2. Base de données — MongoDB Atlas (gratuit)

1. Crée un compte sur https://www.mongodb.com/cloud/atlas/register
2. Crée un cluster gratuit (M0).
3. Dans **Database Access**, crée un utilisateur avec mot de passe (note-le).
4. Dans **Network Access**, autorise `0.0.0.0/0` (accès depuis partout — suffisant pour un pilote ; à restreindre plus tard si besoin).
5. Clique **Connect** → **Drivers** → copie la chaîne de connexion, de la forme :
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
   ```
   Remplace `<user>` et `<password>` par les vrais identifiants créés à l'étape 3.
6. Choisis un nom de base, par exemple `silkroute` (ce sera la valeur de `DB_NAME`).

Garde ces deux valeurs (`MONGO_URL`, `DB_NAME`) sous la main pour l'étape 4.

---

## 3. Stockage images — Cloudinary (gratuit)

1. Crée un compte sur https://cloudinary.com/users/register/free
2. Sur le tableau de bord, récupère **Cloud name**, **API Key**, **API Secret**.

---

## 4. Backend — Railway

1. Crée un compte sur https://railway.app (connexion via GitHub recommandée).
2. **New Project** → **Deploy from GitHub repo** → sélectionne ton dépôt `silkroute`.
3. Railway va probablement essayer de builder à la racine — configure le **Root Directory** du service sur `backend`.
4. Dans les **Variables** du service, ajoute (voir `backend/.env.example` pour la liste complète) :
   - `MONGO_URL` (étape 2)
   - `DB_NAME` (étape 2)
   - `JWT_SECRET` → génère une valeur forte, par exemple avec `openssl rand -hex 32` en local, et colle le résultat. **Ne laisse jamais ce champ vide.**
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (étape 3)
   - `CORS_ORIGINS` → laisse vide pour l'instant, on le complètera à l'étape 6 une fois l'URL du frontend connue.
   - `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` → laisse vide pour le pilote (paiement manuel via Mobile Money), à configurer plus tard.
5. Railway détecte `backend/Procfile` (`web: uvicorn server:app --host 0.0.0.0 --port $PORT`) et déploie automatiquement.
6. Une fois déployé, Railway te donne une URL publique du type `https://silkroute-backend-production.up.railway.app`. Note-la.
7. Vérifie que ça répond : ouvre `https://<ton-url-railway>/api/` dans un navigateur, tu dois voir une réponse JSON simple (pas une erreur 502).

---

## 5. Frontend — Vercel

1. Crée un compte sur https://vercel.com (connexion GitHub recommandée).
2. **Add New Project** → sélectionne ton dépôt `silkroute`.
3. Configure **Root Directory** sur `frontend`.
4. Framework preset : Create React App (Vercel le détecte généralement seul).
5. Dans **Environment Variables**, ajoute :
   - `REACT_APP_BACKEND_URL` = l'URL Railway obtenue à l'étape 4.6 (sans `/` final)
6. Déploie. Vercel te donne une URL du type `https://silkroute.vercel.app`. Note-la.

---

## 6. Boucler la boucle CORS

Retourne sur Railway (backend) → Variables → mets à jour `CORS_ORIGINS` avec l'URL Vercel obtenue à l'étape 5.6 (ex: `https://silkroute.vercel.app`). Redéploie le service si Railway ne le fait pas automatiquement.

---

## 7. Peupler la base (catégories, transitaire, compte admin)

En local, avec Python installé :

```
pip install pymongo
export MONGO_URL="<ta chaine Atlas>"
export DB_NAME="silkroute"
cd silkroute/backend
python seed_data.py
```

Ça crée les catégories (Électronique, Textiles, Beauté, Ménager) et un transitaire de base — **édite d'abord la section `TRANSITAIRES` dans `seed_data.py`** avec les vraies coordonnées de ton transitaire pilote avant de lancer le script.

Ensuite :
1. Va sur ton site Vercel, inscris-toi normalement avec ton vrai email (celui que tu utiliseras comme admin).
2. Relance le script pour te promouvoir admin :
   ```
   python seed_data.py --promote ton-email@exemple.com
   ```
3. Reconnecte-toi sur le site — tu devrais maintenant voir les sections admin.

---

## 8. Créer ton groupage pilote

Dans l'espace admin du site (menu Groupages → Créer), utilise le formulaire corrigé : catégorie et transitaire se choisissent maintenant dans des listes déroulantes réelles (celles créées à l'étape 7), avec le lien produit, le lien de licence commerciale du fournisseur, la quantité totale, le prix total de la commande, les dates, et le prix de vente conseillé (optionnel, pour la fonctionnalité "inviter des associés").

---

## 9. Checklist finale avant d'inviter tes 10 testeurs

- [ ] Le site répond sans page "Preview Unavailable" à n'importe quelle heure (plus de mise en veille)
- [ ] Inscription + connexion fonctionnent
- [ ] Le comparateur de prix affiche un montant cohérent (jamais plus cher que "seul") sur ton groupage pilote
- [ ] Le seuil minimum (25 000 FCFA) et le bouton "Rejoindre" se comportent comme attendu
- [ ] KYC : tu arrives à valider un testeur "sans documents" depuis l'admin
- [ ] Le chat du groupage fonctionne et refuse une connexion sans être connecté
- [ ] Tu as un moyen convenu (Orange Money personnel) pour encaisser la caution de 5 000 FCFA hors plateforme, comme décidé

---

## Notes pour plus tard (pas bloquant pour le pilote)

- **Google OAuth** ("Continuer avec Google") ne fonctionnera pas tel quel — il dépendait des serveurs internes d'Emergent. À refaire avec un vrai client Google Cloud avant un lancement public plus large.
- **Stripe** : le code utilise maintenant le SDK officiel, mais reste à activer (`STRIPE_API_KEY`, déclarer le endpoint webhook dans le dashboard Stripe pour obtenir `STRIPE_WEBHOOK_SECRET`) quand tu voudras encaisser directement en carte en plus du Mobile Money.
- **Nom de domaine propre** : Railway et Vercel fournissent tous deux la possibilité de brancher un domaine personnalisé (ex: silkroute.com) une fois que tu en achètes un — pas nécessaire pour le pilote.
