from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Body
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import math
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
import socketio
import cloudinary
import cloudinary.utils
import time
import secrets
from difflib import SequenceMatcher
import re
import unicodedata
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
#
# Les variables d'environnement peuvent manquer transitoirement au demarrage du
# conteneur (redeploiement, edition des variables). Sans attente, le processus
# plante avec une KeyError et l'hebergeur redemarre en boucle : c'est exactement
# ce qui a provoque 17 crashs successifs le 30 juillet 2026.
# On patiente donc quelques secondes avant d'abandonner, et l'echec final porte
# un message qui nomme la variable manquante.
def _require_env(names, attempts=6, delay_seconds=2):
    for attempt in range(1, attempts + 1):
        values = {n: os.environ.get(n) for n in names}
        missing = [n for n, v in values.items() if not v]
        if not missing:
            if attempt > 1:
                logging.warning(
                    "Variables d'environnement disponibles apres %s tentative(s).", attempt
                )
            return values
        if attempt < attempts:
            logging.warning(
                "Variable(s) manquante(s) au demarrage : %s — nouvelle tentative dans %ss (%s/%s).",
                ', '.join(missing), delay_seconds, attempt, attempts,
            )
            time.sleep(delay_seconds)
    raise RuntimeError(
        f"Variable(s) d'environnement manquante(s) apres {attempts} tentatives : "
        f"{', '.join(missing)}. Verifiez les Variables du service sur Railway."
    )

_env = _require_env(['MONGO_URL', 'DB_NAME'])
mongo_url = _env['MONGO_URL']
db_name = _env['DB_NAME']

# serverSelectionTimeoutMS : sans cette borne, une base injoignable fait attendre
# 30 s par requete, ce qui sature les workers et fait passer le service pour mort.
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=8000,
    connectTimeoutMS=8000,
    maxPoolSize=20,
    retryWrites=True,
)
db = client[db_name]

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable is required and must not be empty. "
        "Generate one with `openssl rand -hex 32` and set it before starting the app."
    )
JWT_ALGORITHM = "HS256"

import stripe
stripe.api_key = os.environ.get("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
JWT_EXPIRATION_HOURS = 24 * 7

# Constants
USD_TO_FCFA = 615  # Taux de conversion USD -> FCFA
CNY_TO_FCFA = 85   # Taux de conversion CNY -> FCFA
# Frais de service SilkRoute : pourcentage de la part membre (marchandise +
# transport), avec un plancher pour les petites commandes. Le pourcentage est
# reglable PAR GROUPAGE (champ service_fee_percent), dans la limite de
# MAX_SERVICE_FEE_PERCENT ; a defaut, SERVICE_FEE_PERCENT s'applique.
# Jamais exposes tels quels dans l'API : fondus dans le total, pour ne pas
# divulguer notre structure de prix.
SERVICE_FEE_PERCENT = float(os.environ.get("SERVICE_FEE_PERCENT", 5))
SERVICE_FEE_MIN_FCFA = float(os.environ.get("SERVICE_FEE_MIN_FCFA", 2000))
MAX_SERVICE_FEE_PERCENT = float(os.environ.get("MAX_SERVICE_FEE_PERCENT", 20))

def get_service_fee_percent(groupage: dict) -> float:
    """Pourcentage de frais applique a ce groupage, borne a [0, MAX_SERVICE_FEE_PERCENT]."""
    percent = groupage.get("service_fee_percent")
    if percent is None:
        percent = SERVICE_FEE_PERCENT
    return max(0.0, min(MAX_SERVICE_FEE_PERCENT, float(percent)))

def service_fee_fcfa(member_share_fcfa: float, percent: float = None) -> float:
    """Frais de service en FCFA. Un plancher evite que les toutes petites
    commandes ne rapportent rien ; a 0 % il n'y a aucun frais."""
    if percent is None:
        percent = SERVICE_FEE_PERCENT
    if percent <= 0:
        return 0.0
    return max(SERVICE_FEE_MIN_FCFA, member_share_fcfa * percent / 100)

MIN_GROUPAGE_TOTAL_FCFA = float(os.environ.get("MIN_GROUPAGE_TOTAL_FCFA", 25000))  # Total minimum (frais inclus) pour pouvoir rejoindre un groupage

# --- Tara Money (mobile money Cameroun) ---
# Deux endpoints Tara, un par moyen de paiement. Montants en FCFA entier,
# notre devise de reference : aucune conversion n'est necessaire.
#  - /mobilepay : push USSD direct sur le telephone (mobile money MTN/Orange).
#    Le client reste sur notre page. Webhook documente avec precision.
#  - /paymentlinks : genere un lien externe. On n'utilise QUE cardLink (carte
#    bancaire, seul canal utilisable depuis n'importe quel pays - Stripe
#    n'opere pas au Cameroun). Webhook desormais documente lui aussi.
TARA_MOBILEPAY_URL = os.environ.get("TARA_MOBILEPAY_URL", "https://www.dklo.co/api/tara/mobilepay")
TARA_PAYMENTLINKS_URL = os.environ.get("TARA_PAYMENTLINKS_URL", "https://www.dklo.co/api/tara/paymentlinks")
TARA_API_KEY = os.environ.get("TARA_API_KEY")
TARA_BUSINESS_ID = os.environ.get("TARA_BUSINESS_ID")
# La documentation Tara ne decrit AUCUNE signature de webhook. A defaut, le
# secret est place dans le chemin de l'URL de callback : sans lui, l'appel est
# rejete. C'est la seule barriere disponible, d'ou l'exigence d'une valeur
# longue et aleatoire (voir README / variables Railway).
TARA_WEBHOOK_SECRET = os.environ.get("TARA_WEBHOOK_SECRET")
# Taux pris par Tara Money sur chaque transaction. Indicatifs (a reconfirmer
# aupres de Tara) : reglables sans redeployer via ces variables.
TARA_FEE_PERCENT_MOBILE = float(os.environ.get("TARA_FEE_PERCENT_MOBILE", 6))
TARA_FEE_PERCENT_CARD = float(os.environ.get("TARA_FEE_PERCENT_CARD", 10))
# Caution demandee a l'adhesion, en FCFA. Il n'y a PLUS de caution universelle :
# la valeur ci-dessous n'est qu'un defaut pour les groupages qui ne precisent
# rien, et elle vaut 0 (paiement integral en une fois). Chaque groupage peut
# fixer la sienne via le champ caution_fcfa.
DEFAULT_CAUTION_FCFA = float(os.environ.get("DEFAULT_CAUTION_FCFA", 0))

def get_caution_fcfa(groupage: dict) -> float:
    """Caution propre a ce groupage. 0 = aucune caution, le membre regle tout
    en une fois."""
    valeur = groupage.get("caution_fcfa")
    if valeur is None:
        return DEFAULT_CAUTION_FCFA
    return max(0.0, float(valeur))

# Supplement fixe lorsqu'une reservation (nouvelle adhesion ou augmentation
# d'un membre deja present) fait depasser la QUANTITE CIBLE du groupage
# (total_quantity), pas seulement ce qu'il en reste au moment de la demande.
OVERAGE_FEE_FCFA = float(os.environ.get("OVERAGE_FEE_FCFA", 10000))

def compute_overage(groupage: dict, additional_quantity: int) -> dict:
    """Verifie si `additional_quantity` unites supplementaires (nouvelle
    adhesion OU ajout par un membre existant) font depasser total_quantity.

    Les deux cas ajoutent des unites a current_quantity_reserved : cette
    fonction est deliberement agnostique de qui fait la demande.
    """
    reserved = groupage.get("current_quantity_reserved", 0)
    remaining = groupage["total_quantity"] - reserved
    if additional_quantity <= remaining:
        return {
            "is_overage": False,
            "overage_fee_fcfa": 0.0,
            "new_total_quantity": groupage["total_quantity"],
            "remaining": remaining,
        }
    return {
        "is_overage": True,
        "overage_fee_fcfa": OVERAGE_FEE_FCFA,
        "new_total_quantity": reserved + additional_quantity,
        "remaining": remaining,
    }

# Phases d'expedition d'un groupage, dans l'ordre. Mises a jour par le transitaire
# (ou l'admin) et affichees aux membres sur la page du groupage.
SHIPMENT_PHASES = ["preparation", "picked_up", "in_transit", "customs", "arrived", "delivered"]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
sio_user_sessions = {}  # sid -> {user_id, user_name} pour eviter le spoofing d'identite dans le chat
fastapi_app = FastAPI()
api_router = APIRouter(prefix="/api")

# Rate limiting (protege /auth/login et /auth/register contre le brute-force)
limiter = Limiter(key_func=get_remote_address)
fastapi_app.state.limiter = limiter
fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ========================
# MODELS
# ========================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    language: str = "fr"
    buyer_profile: Optional[str] = None  # Profil d'acheteur

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    picture: Optional[str] = None
    language: str = "fr"
    role: str = "member"
    kyc_status: str = "pending"
    buyer_profile: Optional[str] = None
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class KYCUpdate(BaseModel):
    id_front_url: Optional[str] = None
    id_back_url: Optional[str] = None
    selfie_url: Optional[str] = None

# Proposition de produit par membre ou admin
class ProductProposal(BaseModel):
    product_url: str  # Lien Alibaba/1688
    title: str
    description: Optional[str] = None
    estimated_unit_price_cny: Optional[float] = None
    category_id: Optional[str] = None

# Catégorie de produit
class CategoryCreate(BaseModel):
    name: str
    name_en: str
    description: Optional[str] = None
    icon: Optional[str] = None

# Profil d'acheteur
class BuyerProfileCreate(BaseModel):
    name: str
    name_en: str
    description: Optional[str] = None
    typical_categories: List[str] = []

# Option de transport proposee par un transitaire (ex: aerien normal, aerien
# express, maritime). Prix en FCFA, factures au kg (aerien) ou au CBM (maritime).
class ShippingOption(BaseModel):
    label: str  # ex: "Aerien normal", "Aerien express", "Maritime"
    mode: str  # "air" | "sea"
    price_fcfa: float
    unit: str = "kg"  # "kg" | "cbm"
    eta_min_days: int
    eta_max_days: int
    is_active: bool = True

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("air", "sea"):
            raise ValueError("mode must be 'air' or 'sea'")
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v not in ("kg", "cbm"):
            raise ValueError("unit must be 'kg' or 'cbm'")
        return v

# Transitaire
class TransitaireCreate(BaseModel):
    name: str
    city: str
    country: str
    license_number: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    website: Optional[str] = None
    shipping_options: List[ShippingOption] = []
    # Villes ou le transitaire livre / ou les membres peuvent recuperer leur
    # marchandise. Chaque membre choisit SA ville de retrait en rejoignant un
    # groupage (choix definitif), ce qui permet le split de la commande par ville.
    service_cities: List[str] = []
    is_active: bool = True

# Fournisseur (fiche geree par l'admin, liee ensuite aux groupages)
class SupplierCreate(BaseModel):
    name: str
    location: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    rating: float = 4.5
    gold_status: bool = False
    trade_assurance: bool = False
    notes: Optional[str] = None
    is_active: bool = True

# Compte partenaire (transitaire ou fournisseur) cree par l'admin
class PartnerAccountCreate(BaseModel):
    email: EmailStr
    name: str
    role: str  # "transitaire" | "supplier"
    entity_id: str  # transitaire_id ou supplier_id correspondant

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("transitaire", "supplier"):
            raise ValueError("role must be 'transitaire' or 'supplier'")
        return v

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

# Mise a jour de phase d'expedition par le transitaire
class PhaseUpdate(BaseModel):
    phase: str
    note: Optional[str] = None

# Avis post-livraison laisse par un membre
class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("rating must be between 1 and 5")
        return v

class ReviewReply(BaseModel):
    reply: str

# Documents fournisseur (obligatoires pour publier)
class SupplierDocuments(BaseModel):
    business_license_url: str  # Licence commerciale
    export_license_url: Optional[str] = None  # Licence d'export
    product_certifications: List[str] = []  # Certifications produit
    factory_audit_url: Optional[str] = None  # Audit usine

# Création de groupage avec nouveau modèle de prix
class GroupageCreate(BaseModel):
    title: str
    title_en: str
    description: str
    description_en: str
    product_category_id: str
    product_url: str  # Lien vers le produit source (Alibaba/1688)
    product_image_url: Optional[str] = None
    
    # Fournisseur
    supplier_id: Optional[str] = None  # Lien vers une fiche fournisseur (portail)
    supplier_name: str
    supplier_location: str
    supplier_rating: float
    supplier_gold_status: bool = False
    supplier_trade_assurance: bool = False
    supplier_documents: SupplierDocuments  # OBLIGATOIRE

    # Transitaire - maintenant par ID
    transitaire_id: str  # ID du transitaire sélectionné
    shipping_option_id: Optional[str] = None  # Option de transport choisie (nouvelles fiches)
    
    # --- Prix en FCFA, saisis directement (mode recommande) ---
    # Tous HORS TRANSPORT : le transport est calcule a part depuis la fiche
    # transitaire (au kg ou au CBM) et ajoute au total.
    #
    # Prix unitaire de gros reellement obtenu du fournisseur. STRICTEMENT INTERNE :
    # jamais expose par l'API publique. Sert a calculer la marge SilkRoute.
    wholesale_unit_price_fcfa: Optional[float] = None
    # Prix unitaire paye par les membres sur la plateforme. La marge SilkRoute est
    # l'ecart avec wholesale_unit_price_fcfa : aucun frais de service n'est ajoute.
    member_unit_price_fcfa: Optional[float] = None
    # Prix unitaire qu'un acheteur seul paierait (petite quantite, sans palier de gros).
    # Alimente la colonne "commande SEUL" du comparateur.
    solo_unit_price_fcfa: Optional[float] = None

    # Frais de service SilkRoute pour CE groupage, en % de la part membre
    # (marchandise + transport). Vide = valeur par defaut du serveur.
    # Jamais expose par l'API publique : il revelerait notre structure de prix.
    service_fee_percent: Optional[float] = Field(default=None, ge=0, le=MAX_SERVICE_FEE_PERCENT)

    # Caution demandee a l'adhesion, en FCFA. 0 (ou vide) = aucune caution, le
    # membre regle la totalite en une fois. Visible des acheteurs : ils doivent
    # savoir a quoi s'engage leur premier versement.
    caution_fcfa: Optional[float] = Field(default=None, ge=0)

    # --- Prix et poids/volume (ancien mode CNY, conserve pour compatibilite) ---
    unit_price_cny: float  # Prix unitaire DE GROS en CNY (palier atteint avec la quantite cible)
    solo_unit_price_cny: Optional[float] = None
    unit_weight_kg: float  # Poids unitaire en kg
    unit_volume_cbm: Optional[float] = None  # Volume unitaire en m3 (requis si option maritime au CBM)
    
    # Commande totale
    total_quantity: int  # Quantité totale de la commande groupée
    total_order_price_cny: float  # Prix tout compris FACTURE aux membres (marge incluse)
    # Cout reel tout compris apres remises negociees aupres du fournisseur et du
    # transitaire. STRICTEMENT INTERNE (jamais expose par l'API publique) : la
    # difference avec total_order_price_cny constitue la marge SilkRoute.
    internal_cost_cny: Optional[float] = None
    
    # Membres
    min_members: int
    max_members: int
    
    # Dates
    deadline: datetime
    estimated_arrival: datetime
    
    # Comparaison
    local_price_fcfa: float  # Prix chez grossiste local

    # Prix de vente conseille (reference marketplace), utilise notamment dans le
    # message d'invitation "invite tes associes" genere par les membres
    suggested_resale_price_fcfa: Optional[float] = None

class GroupageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    groupage_id: str
    reference: Optional[str] = None  # SR-0001 : identifiant lisible, cote humain
    title: str
    title_en: str
    description: str
    description_en: str
    product_category_id: str
    product_url: str
    product_image_url: Optional[str] = None
    supplier_name: str
    supplier_location: str
    supplier_rating: float
    supplier_gold_status: bool
    supplier_trade_assurance: bool
    supplier_documents_validated: bool
    transitaire_name: str
    transitaire_location: str
    transitaire_license: str
    # Prix directs en FCFA, hors transport (wholesale_unit_price_fcfa reste interne)
    member_unit_price_fcfa: Optional[float] = None
    solo_unit_price_fcfa: Optional[float] = None
    caution_fcfa: Optional[float] = None  # 0/absent = paiement integral en une fois
    unit_price_cny: float
    unit_weight_kg: float
    transport_price_per_kg_fcfa: float
    total_quantity: int
    total_order_price_cny: float
    min_members: int
    max_members: int
    current_members: int
    current_quantity_reserved: int
    deadline: datetime
    estimated_arrival: datetime
    local_price_fcfa: float
    suggested_resale_price_fcfa: Optional[float] = None
    status: str
    created_at: datetime

class JoinGroupage(BaseModel):
    quantity: int
    # Ville de retrait choisie parmi les villes de desserte du transitaire.
    # Ce choix est DEFINITIF (le split de la commande par ville est convenu avec
    # le transitaire) : aucune route ne permet de le modifier apres l'adhesion.
    pickup_city: Optional[str] = None
    # Acceptation explicite d'aller recuperer la marchandise dans cette ville
    accept_pickup: bool = False
    # Confirmation explicite du supplement de depassement (voir compute_overage).
    # Sans elle, une demande qui depasse la quantite cible est refusee (409)
    # plutot que silencieusement acceptee.
    accept_overage: bool = False

class IncreaseQuantity(BaseModel):
    """Un membre DEJA present augmente sa part. Meme mecanisme de depassement
    que l'adhesion : au-dela de la quantite cible du groupage, un supplement
    s'applique et doit etre confirme explicitement."""
    additional_quantity: int
    accept_overage: bool = False

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

class PaymentCreate(BaseModel):
    groupage_id: str
    payment_type: str
    origin_url: str

class TaraMobilePayCreate(BaseModel):
    groupage_id: str
    payment_type: str  # "caution" ou "solde"
    phone_number: str  # avec indicatif pays, ex: "2376XXXXXXXX"

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v):
        digits = re.sub(r"\D", "", v)
        if not (9 <= len(digits) <= 15):
            raise ValueError("Numero de telephone invalide")
        return digits

class TaraCardPaymentCreate(BaseModel):
    """Paiement carte : pas de numero de telephone, contrairement au mobile
    money. Modele distinct plutot que de reutiliser TaraMobilePayCreate, dont
    le champ phone_number est obligatoire - le confondre faisait echouer
    toute requete carte en validation (422) avant meme d'atteindre la route."""
    groupage_id: str
    payment_type: str  # "caution" ou "solde"

# Documents logistiques
class LogisticsDocument(BaseModel):
    doc_type: str  # "bl", "packing_list", "invoice", "customs"
    url: str
    uploaded_at: Optional[str] = None

# ========================
# TRESORERIE
# ========================
# Un flux = un mouvement d'argent, entrant ou sortant. Le registre est la source
# unique de verite : les paiements Stripe/Tara y sont pousses automatiquement,
# les versements REasy (pas d'API publique) et les encaissements hors site y
# sont saisis a la main. Tout est ramene en FCFA pour pouvoir additionner.

CASH_FLOW_DIRECTIONS = ["in", "out"]
# Comptes par lesquels l'argent transite reellement
CASH_FLOW_ACCOUNTS = ["tara", "reasy", "stripe", "cash", "bank", "other"]
# A quoi correspond le mouvement. Determine aussi la contrepartie attendue :
# un member_payment est lie a un client, un supplier_payment a un fournisseur.
CASH_FLOW_CATEGORIES = [
    "member_payment",     # entrant : un membre paie sa part (caution ou solde)
    "refund",             # sortant : remboursement d'un membre
    "supplier_payment",   # sortant : paiement du fournisseur chinois (REasy)
    "freight_payment",    # sortant : paiement du transitaire
    "customs_duty",       # sortant : droits de douane
    "operating_expense",  # sortant : frais de fonctionnement (pub, outils...)
    "other_income",       # entrant : divers
]
CASH_FLOW_STATUSES = ["pending", "confirmed", "failed"]

# Taux de conversion vers le FCFA, devise de reference du registre.
FCFA_PER_EUR = 655.957  # parite fixe XAF/EUR
CURRENCY_TO_FCFA = {
    "xaf": 1.0,
    "fcfa": 1.0,
    "eur": FCFA_PER_EUR,
    "usd": float(USD_TO_FCFA),
    "cny": float(CNY_TO_FCFA),
}

class CashFlowCreate(BaseModel):
    direction: str
    amount: float = Field(gt=0)
    currency: str = "XAF"
    account: str
    category: str
    status: str = "confirmed"
    occurred_at: Optional[datetime] = None
    # Dimensions d'analyse : toutes optionnelles, mais plus il y en a, plus le
    # tableau de bord peut ventiler finement.
    groupage_id: Optional[str] = None
    user_id: Optional[str] = None
    supplier_id: Optional[str] = None
    transitaire_id: Optional[str] = None
    reference: Optional[str] = None   # ref externe : id de transaction Tara/REasy
    note: Optional[str] = None
    proof_url: Optional[str] = None
    # Commission prelevee par le prestataire sur CE mouvement (Tara : calculee
    # automatiquement ; REasy : taux variable, saisi a la main a chaque fois).
    platform_fee_fcfa: Optional[float] = Field(default=None, ge=0)
    platform_fee_percent: Optional[float] = Field(default=None, ge=0, le=100)

    @field_validator("direction")
    @classmethod
    def check_direction(cls, v):
        if v not in CASH_FLOW_DIRECTIONS:
            raise ValueError(f"direction must be one of: {', '.join(CASH_FLOW_DIRECTIONS)}")
        return v

    @field_validator("account")
    @classmethod
    def check_account(cls, v):
        if v not in CASH_FLOW_ACCOUNTS:
            raise ValueError(f"account must be one of: {', '.join(CASH_FLOW_ACCOUNTS)}")
        return v

    @field_validator("category")
    @classmethod
    def check_category(cls, v):
        if v not in CASH_FLOW_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(CASH_FLOW_CATEGORIES)}")
        return v

    @field_validator("status")
    @classmethod
    def check_status(cls, v):
        if v not in CASH_FLOW_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(CASH_FLOW_STATUSES)}")
        return v

    @field_validator("currency")
    @classmethod
    def check_currency(cls, v):
        if v.lower() not in CURRENCY_TO_FCFA:
            raise ValueError(f"currency must be one of: {', '.join(CURRENCY_TO_FCFA)}")
        return v.upper()

class CashFlowUpdate(BaseModel):
    """Champs modifiables apres coup. Le montant et la devise restent figes :
    corriger un montant se fait en supprimant le flux et en le ressaisissant,
    pour que l'historique ne mente jamais."""
    status: Optional[str] = None
    category: Optional[str] = None
    groupage_id: Optional[str] = None
    user_id: Optional[str] = None
    supplier_id: Optional[str] = None
    transitaire_id: Optional[str] = None
    reference: Optional[str] = None
    note: Optional[str] = None
    proof_url: Optional[str] = None
    occurred_at: Optional[datetime] = None
    platform_fee_fcfa: Optional[float] = Field(default=None, ge=0)
    platform_fee_percent: Optional[float] = Field(default=None, ge=0, le=100)

# ========================
# HELPERS
# ========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def to_fcfa(amount: float, currency: str) -> float:
    """Convertit vers le FCFA, devise de reference du registre de tresorerie."""
    return float(amount) * CURRENCY_TO_FCFA.get((currency or "XAF").lower(), 1.0)

async def record_cash_flow(**fields) -> dict:
    """Ecrit un mouvement dans le registre.

    Passe par ici TOUT ce qui touche a l'argent (Stripe, Tara, saisie manuelle)
    pour que le tableau de bord n'ait qu'une seule source a lire. `reference`
    sert de garde-fou : deux appels avec la meme reference externe ne creent
    qu'un seul flux, ce qui rend les webhooks rejouables sans double comptage.
    """
    reference = fields.get("reference")
    if reference:
        existing = await db.cash_flows.find_one({"reference": reference}, {"_id": 0})
        if existing:
            return existing

    amount = float(fields.get("amount") or 0)
    currency = (fields.get("currency") or "XAF").upper()
    occurred_at = fields.get("occurred_at") or datetime.now(timezone.utc)
    if isinstance(occurred_at, datetime):
        occurred_at = occurred_at.isoformat()

    flow = {
        "flow_id": f"flow_{uuid.uuid4().hex[:12]}",
        "direction": fields["direction"],
        "amount": round(amount, 2),
        "currency": currency,
        # Montant canonique : c'est lui qu'on additionne, jamais `amount`.
        "amount_fcfa": round(to_fcfa(amount, currency), 0),
        "account": fields.get("account", "other"),
        "category": fields["category"],
        "status": fields.get("status", "confirmed"),
        "groupage_id": fields.get("groupage_id"),
        "user_id": fields.get("user_id"),
        "supplier_id": fields.get("supplier_id"),
        "transitaire_id": fields.get("transitaire_id"),
        "reference": reference,
        "note": fields.get("note"),
        "proof_url": fields.get("proof_url"),
        "platform_fee_fcfa": (
            round(float(fields["platform_fee_fcfa"]), 0)
            if fields.get("platform_fee_fcfa") is not None else None
        ),
        "platform_fee_percent": fields.get("platform_fee_percent"),
        "occurred_at": occurred_at,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": fields.get("created_by"),
    }
    await db.cash_flows.insert_one(dict(flow))
    return flow

def get_client_ip(request: Request) -> str:
    """IP du visiteur. Railway/Vercel sont derriere un proxy : la vraie IP est
    dans X-Forwarded-For (premiere valeur de la liste), pas dans request.client."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

async def resolve_ip_location(payment_id: str, ip: str) -> None:
    """Resolution best-effort pays/ville depuis l'IP, EN ARRIERE-PLAN : ne doit
    jamais ralentir ni faire echouer un paiement. Echec silencieux."""
    if not ip or ip in ("unknown", "127.0.0.1", "::1"):
        return
    try:
        async with httpx.AsyncClient(timeout=4) as http_client:
            resp = await http_client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,country,city,regionName"},
            )
            data = resp.json()
        if data.get("status") == "success":
            await db.payment_transactions.update_one(
                {"payment_id": payment_id},
                {"$set": {
                    "ip_country": data.get("country"),
                    "ip_city": data.get("city"),
                    "ip_region": data.get("regionName"),
                }}
            )
    except Exception as exc:
        logger.debug(f"IP location lookup failed for {payment_id}: {exc}")

async def next_groupage_reference() -> str:
    """Reference courte et lisible d'un groupage (SR-0001, SR-0002...).

    Le groupage_id reste l'identifiant technique ; cette reference existe pour
    qu'on puisse distinguer et nommer a l'oral deux groupages portant sur le
    MEME produit ("le SR-0042"). Le compteur est incremente atomiquement en
    base : deux creations simultanees ne peuvent pas obtenir le meme numero.
    """
    counter = await db.counters.find_one_and_update(
        {"_id": "groupage_reference"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"SR-{counter['value']:04d}"

async def backfill_groupage_references() -> int:
    """Attribue une reference aux groupages crees avant l'introduction du champ.
    Idempotent : les groupages qui en ont deja une ne sont pas touches."""
    missing = await db.groupages.find(
        {"$or": [{"reference": {"$exists": False}}, {"reference": None}]},
        {"_id": 0, "groupage_id": 1}
    ).sort("created_at", 1).to_list(1000)

    assigned = 0
    for g in missing:
        reference = await next_groupage_reference()
        # Le filtre re-verifie l'absence de reference : si un autre process en a
        # attribue une entre-temps, on ne l'ecrase pas.
        result = await db.groupages.update_one(
            {"groupage_id": g["groupage_id"],
             "$or": [{"reference": {"$exists": False}}, {"reference": None}]},
            {"$set": {"reference": reference}}
        )
        assigned += result.modified_count
    return assigned

def get_transport_price_per_kg_fcfa(groupage: dict) -> float:
    """Prix transport au kg en FCFA. Les nouvelles fiches transitaires stockent
    directement le prix FCFA ; les anciens groupages n'ont qu'un prix CNY, converti."""
    if groupage.get("transport_price_per_kg_fcfa") is not None:
        return groupage["transport_price_per_kg_fcfa"]
    return groupage.get("transport_price_per_kg_cny", 0) * CNY_TO_FCFA

def get_per_item_transport_fcfa(groupage: dict) -> float:
    """Cout transport FCFA pour UNE unite du produit, selon le mode de facturation
    du transitaire : au poids (kg) ou au volume (CBM). Retro-compatible avec les
    groupages historiques qui n'ont qu'un prix au kg."""
    if groupage.get("transport_unit") == "cbm":
        return (groupage.get("unit_volume_cbm") or 0) * (groupage.get("transport_price_fcfa") or 0)
    price = groupage.get("transport_price_fcfa")
    if price is None:
        price = get_transport_price_per_kg_fcfa(groupage)
    return (groupage.get("unit_weight_kg") or 0) * price

def get_member_unit_price_fcfa(groupage: dict) -> float:
    """Prix unitaire HORS TRANSPORT paye par un membre du groupage, en FCFA.

    Mode direct (nouveaux groupages) : le prix est saisi tel quel a la creation.
    Repli (groupages historiques) : on le derive du prix total tout compris en CNY.
    """
    direct = groupage.get("member_unit_price_fcfa")
    if direct is not None:
        return float(direct)
    total_quantity = groupage.get("total_quantity") or 0
    if total_quantity <= 0:
        return 0.0
    return (groupage.get("total_order_price_cny", 0) * CNY_TO_FCFA) / total_quantity

def get_solo_unit_price_fcfa(groupage: dict) -> float:
    """Prix unitaire HORS TRANSPORT paye par un acheteur seul (petite quantite), en FCFA."""
    direct = groupage.get("solo_unit_price_fcfa")
    if direct is not None:
        return float(direct)
    unit_price_cny = groupage.get("solo_unit_price_cny") or groupage.get("unit_price_cny") or 0
    return unit_price_cny * CNY_TO_FCFA

def calculate_solo_price(unit_price_fcfa: float, quantity: int, per_item_transport_fcfa: float) -> dict:
    """
    Calcul prix SEUL: Prix unitaire + (transport unitaire x quantite).
    Le prix unitaire est attendu en FCFA, hors transport.

    Pas de frais fixe ajoute : le dedouanement est gere par le transitaire,
    pas par un agent distinct que l'acheteur seul paierait en plus.
    """
    total_unit_price = unit_price_fcfa * quantity
    transport_cost_fcfa = per_item_transport_fcfa * quantity

    total_solo = total_unit_price + transport_cost_fcfa
    price_per_unit_solo = total_solo / quantity if quantity > 0 else 0

    return {
        "unit_price_fcfa": round(unit_price_fcfa, 0),
        "quantity": quantity,
        "subtotal_fcfa": round(total_unit_price, 0),
        "transport_cost_fcfa": round(transport_cost_fcfa, 0),
        "total_fcfa": round(total_solo, 0),
        "price_per_unit_fcfa": round(price_per_unit_solo, 0)
    }

def calculate_groupage_price(member_unit_price_fcfa: float, per_item_transport_fcfa: float,
                             total_quantity: int, member_quantity: int,
                             service_fee_percent: float = None) -> dict:
    """
    Calcul prix GROUPAGE: (prix unitaire membre + transport unitaire) × quantite,
    plus les frais de service SilkRoute (pourcentage propre au groupage).

    Les frais ne sont volontairement PAS exposes comme ligne separee : ils sont
    fondus dans total_fcfa pour ne pas divulguer notre structure de prix.

    Un total minimum (MIN_GROUPAGE_TOTAL_FCFA, frais inclus) reste requis pour
    rejoindre un groupage : en dessous, la commande ne justifie pas les couts
    fixes de gestion.
    """
    if total_quantity <= 0:
        return {"error": "Invalid total quantity"}

    if service_fee_percent is None:
        service_fee_percent = SERVICE_FEE_PERCENT
    service_fee_percent = max(0.0, min(MAX_SERVICE_FEE_PERCENT, float(service_fee_percent)))

    # Pourcentage de la commande represente par ce membre
    share_percentage = (member_quantity / total_quantity) * 100

    subtotal_fcfa = member_unit_price_fcfa * member_quantity
    transport_cost_fcfa = per_item_transport_fcfa * member_quantity
    member_share_fcfa = subtotal_fcfa + transport_cost_fcfa
    total_groupage = member_share_fcfa + service_fee_fcfa(member_share_fcfa, service_fee_percent)
    price_per_unit_groupage = total_groupage / member_quantity if member_quantity > 0 else 0

    # Part unitaire hors frais, pour estimer la quantite minimale
    price_per_unit_excl_fee = member_unit_price_fcfa + per_item_transport_fcfa

    meets_minimum = total_groupage >= MIN_GROUPAGE_TOTAL_FCFA
    min_quantity_needed = None
    if not meets_minimum and price_per_unit_excl_fee > 0:
        # Part minimale pour que part + frais >= minimum, selon que le plancher
        # ou le pourcentage s'applique au point de bascule.
        if service_fee_percent <= 0:
            share_needed = MIN_GROUPAGE_TOTAL_FCFA
        else:
            share_needed = MIN_GROUPAGE_TOTAL_FCFA / (1 + service_fee_percent / 100)
            if share_needed * service_fee_percent / 100 < SERVICE_FEE_MIN_FCFA:
                share_needed = MIN_GROUPAGE_TOTAL_FCFA - SERVICE_FEE_MIN_FCFA
        min_quantity_needed = max(1, math.ceil(share_needed / price_per_unit_excl_fee))

    return {
        "share_percentage": round(share_percentage, 2),
        "unit_price_fcfa": round(member_unit_price_fcfa, 0),
        "subtotal_fcfa": round(subtotal_fcfa, 0),
        "transport_cost_fcfa": round(transport_cost_fcfa, 0),
        "total_fcfa": round(total_groupage, 0),
        "price_per_unit_fcfa": round(price_per_unit_groupage, 0),
        "quantity": member_quantity,
        "min_total_required_fcfa": MIN_GROUPAGE_TOTAL_FCFA,
        "meets_minimum": meets_minimum,
        "min_quantity_needed": min_quantity_needed
    }

def calculate_comparison(groupage: dict, quantity: int) -> dict:
    """
    Compare prix SEUL vs GROUPAGE vs Grossiste local
    """
    per_item_transport_fcfa = get_per_item_transport_fcfa(groupage)

    # La colonne "seul" utilise le prix unitaire au detail (petite quantite) ;
    # a defaut (anciens groupages), on retombe sur le prix de gros converti du CNY.
    solo = calculate_solo_price(
        get_solo_unit_price_fcfa(groupage),
        quantity,
        per_item_transport_fcfa
    )

    groupage_price = calculate_groupage_price(
        get_member_unit_price_fcfa(groupage),
        per_item_transport_fcfa,
        groupage["total_quantity"],
        quantity,
        get_service_fee_percent(groupage)
    )

    local_total = groupage["local_price_fcfa"] * quantity
    
    savings_vs_solo = solo["total_fcfa"] - groupage_price["total_fcfa"]
    savings_vs_local = local_total - groupage_price["total_fcfa"]
    savings_percentage_vs_solo = (savings_vs_solo / solo["total_fcfa"]) * 100 if solo["total_fcfa"] > 0 else 0
    savings_percentage_vs_local = (savings_vs_local / local_total) * 100 if local_total > 0 else 0
    
    return {
        "quantity": quantity,
        "solo_price": solo,
        "groupage_price": groupage_price,
        "local_price": {
            "unit_price_fcfa": round(groupage["local_price_fcfa"], 0),
            "total_fcfa": round(local_total, 0)
        },
        "savings": {
            "vs_solo_fcfa": round(savings_vs_solo, 0),
            "vs_solo_percentage": round(savings_percentage_vs_solo, 1),
            "vs_local_fcfa": round(savings_vs_local, 0),
            "vs_local_percentage": round(savings_percentage_vs_local, 1)
        }
    }

# ========================
# AUTH ROUTES
# ========================

def set_auth_cookie(response: Response, token: str) -> None:
    """Pose le JWT comme cookie httpOnly : inaccessible en JS, donc pas volable par une
    injection XSS cote frontend (contrairement a un stockage en localStorage)."""
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_HOURS * 3600
    )

@api_router.post("/auth/register", response_model=TokenResponse)
@limiter.limit("10/hour")
async def register(request: Request, user_data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "phone": user_data.phone,
        "location": user_data.location,
        "picture": None,
        "language": user_data.language,
        "role": "member",
        "kyc_status": "pending",
        "kyc_documents": {},
        "mobile_money": {},
        "cgu_accepted": False,
        "email_verified": False,
        "buyer_profile": user_data.buyer_profile,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)

    # Envoi du lien de verification d'email, sans bloquer l'inscription si
    # l'envoi echoue (Resend pas encore configure, panne, etc.)
    try:
        await create_and_send_verification(user_id, user_data.email)
    except Exception as e:
        logger.error(f"Verification email failed for {user_id}: {e}")

    token = create_token(user_id)
    set_auth_cookie(response, token)
    user_response = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    user_response["created_at"] = datetime.fromisoformat(user_response["created_at"])

    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, credentials: UserLogin, response: Response):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user["user_id"])
    set_auth_cookie(response, token)
    user_response = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    if isinstance(user_response["created_at"], str):
        user_response["created_at"] = datetime.fromisoformat(user_response["created_at"])

    return TokenResponse(access_token=token, user=UserResponse(**user_response))

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "role": user.get("role", "member"),
        "kyc_status": user.get("kyc_status", "pending"),
        "language": user.get("language", "fr"),
        "phone": user.get("phone"),
        "location": user.get("location"),
        "mobile_money": user.get("mobile_money"),
        "cgu_accepted": user.get("cgu_accepted", False),
        "buyer_profile": user.get("buyer_profile"),
        "entity_id": user.get("entity_id"),
        "must_change_password": user.get("must_change_password", False),
        # None pour les comptes crees avant la verification d'email (pas de banniere),
        # False pour les nouveaux comptes non verifies, True une fois verifie.
        "email_verified": user.get("email_verified"),
        # Jeton de courte duree expose au JS uniquement pour l'authentification du
        # websocket (Socket.IO ne peut pas lire le cookie httpOnly dans son handshake).
        # Ne remplace pas le cookie comme mecanisme d'authentification principal.
        "ws_token": create_token(user["user_id"])
    }

@api_router.post("/auth/logout")
async def logout(request: Request):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key="session_token", path="/")
    return response

# ========================
# USER/PROFILE ROUTES
# ========================

@api_router.put("/users/profile")
async def update_profile(request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    allowed_fields = ["name", "phone", "location", "language", "mobile_money", "buyer_profile"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_data:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.put("/users/kyc")
async def update_kyc(kyc_data: KYCUpdate, user: dict = Depends(get_current_user)):
    update_doc = {}
    if kyc_data.id_front_url:
        update_doc["kyc_documents.id_front"] = kyc_data.id_front_url
    if kyc_data.id_back_url:
        update_doc["kyc_documents.id_back"] = kyc_data.id_back_url
    if kyc_data.selfie_url:
        update_doc["kyc_documents.selfie"] = kyc_data.selfie_url
    
    if update_doc:
        update_doc["kyc_status"] = "submitted"
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_doc})
    
    return {"message": "KYC documents uploaded", "status": "submitted"}

@api_router.put("/users/cgu")
async def accept_cgu(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"cgu_accepted": True, "cgu_accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "CGU accepted"}

# ========================
# CATEGORIES & BUYER PROFILES
# ========================

@api_router.get("/categories")
async def list_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    return categories

@api_router.post("/admin/categories")
async def create_category(category: CategoryCreate, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    cat_id = f"cat_{uuid.uuid4().hex[:8]}"
    cat_doc = {
        "category_id": cat_id,
        **category.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(cat_doc)
    return {"category_id": cat_id, **category.model_dump()}

@api_router.get("/buyer-profiles")
async def list_buyer_profiles():
    profiles = await db.buyer_profiles.find({}, {"_id": 0}).to_list(100)
    return profiles

@api_router.post("/admin/buyer-profiles")
async def create_buyer_profile(profile: BuyerProfileCreate, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    profile_id = f"bp_{uuid.uuid4().hex[:8]}"
    profile_doc = {
        "profile_id": profile_id,
        **profile.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.buyer_profiles.insert_one(profile_doc)
    return {"profile_id": profile_id, **profile.model_dump()}

# ========================
# TRANSITAIRES ROUTES
# ========================

@api_router.get("/transitaires")
async def list_transitaires(city: Optional[str] = None, active_only: bool = True):
    """Liste des transitaires disponibles"""
    query = {}
    if active_only:
        query["is_active"] = True
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    transitaires = await db.transitaires.find(query, {"_id": 0}).to_list(100)
    return transitaires

@api_router.get("/transitaires/{transitaire_id}")
async def get_transitaire(transitaire_id: str):
    transitaire = await db.transitaires.find_one({"transitaire_id": transitaire_id}, {"_id": 0})
    if not transitaire:
        raise HTTPException(status_code=404, detail="Transitaire not found")
    return transitaire

def _with_option_ids(options: List[dict]) -> List[dict]:
    """Assigne un option_id stable a chaque option de transport qui n'en a pas
    (necessaire pour la selection lors de la creation d'un groupage)."""
    for opt in options:
        if not opt.get("option_id"):
            opt["option_id"] = f"opt_{uuid.uuid4().hex[:8]}"
    return options

@api_router.post("/admin/transitaires")
async def create_transitaire(transitaire: TransitaireCreate, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    transitaire_id = f"trans_{uuid.uuid4().hex[:8]}"
    doc = transitaire.model_dump()
    doc["shipping_options"] = _with_option_ids(doc.get("shipping_options", []))
    transitaire_doc = {
        "transitaire_id": transitaire_id,
        **doc,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transitaires.insert_one(transitaire_doc)
    return {k: v for k, v in transitaire_doc.items() if k != "_id"}

@api_router.put("/admin/transitaires/{transitaire_id}")
async def update_transitaire(transitaire_id: str, request: Request, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    data = await request.json()
    allowed_fields = ["name", "city", "country", "license_number", "contact_phone", "contact_email",
                      "website", "shipping_options", "service_cities", "is_active"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if "shipping_options" in update_data:
        # Valide chaque option via le modele pydantic, puis regenere les option_id manquants
        validated = []
        for raw in update_data["shipping_options"]:
            option_id = raw.get("option_id")
            opt = ShippingOption(**{k: v for k, v in raw.items() if k != "option_id"}).model_dump()
            if option_id:
                opt["option_id"] = option_id
            validated.append(opt)
        update_data["shipping_options"] = _with_option_ids(validated)

    if update_data:
        await db.transitaires.update_one({"transitaire_id": transitaire_id}, {"$set": update_data})

    return {"message": "Transitaire updated"}

@api_router.delete("/admin/transitaires/{transitaire_id}")
async def delete_transitaire(transitaire_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Soft delete - just deactivate
    await db.transitaires.update_one(
        {"transitaire_id": transitaire_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Transitaire deactivated"}

# ========================
# SUPPLIERS (fiches fournisseurs)
# ========================

@api_router.get("/admin/suppliers")
async def list_suppliers(active_only: bool = False, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    query = {"is_active": True} if active_only else {}
    suppliers = await db.suppliers.find(query, {"_id": 0}).to_list(200)
    return suppliers

@api_router.post("/admin/suppliers")
async def create_supplier(supplier: SupplierCreate, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    supplier_id = f"sup_{uuid.uuid4().hex[:8]}"
    supplier_doc = {
        "supplier_id": supplier_id,
        **supplier.model_dump(),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.suppliers.insert_one(supplier_doc)
    return {k: v for k, v in supplier_doc.items() if k != "_id"}

@api_router.put("/admin/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, request: Request, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    data = await request.json()
    allowed_fields = ["name", "location", "contact_phone", "contact_email", "rating",
                      "gold_status", "trade_assurance", "notes", "is_active"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if update_data:
        await db.suppliers.update_one({"supplier_id": supplier_id}, {"$set": update_data})

    return {"message": "Supplier updated"}

# ========================
# PARTNER ACCOUNTS (comptes transitaire / fournisseur crees par l'admin)
# ========================

@api_router.get("/admin/partner-accounts")
async def list_partner_accounts(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    accounts = await db.users.find(
        {"role": {"$in": ["transitaire", "supplier"]}},
        {"_id": 0, "password_hash": 0}
    ).to_list(200)
    return accounts

@api_router.post("/admin/partner-accounts")
async def create_partner_account(account: PartnerAccountCreate, user: dict = Depends(get_current_user)):
    """Cree un compte transitaire/fournisseur avec un mot de passe provisoire.
    Le mot de passe n'est retourne qu'une seule fois, a l'admin, pour transmission
    au partenaire ; le partenaire devra le changer a sa premiere connexion."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = await db.users.find_one({"email": account.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Verifie que l'entite liee existe
    if account.role == "transitaire":
        entity = await db.transitaires.find_one({"transitaire_id": account.entity_id})
    else:
        entity = await db.suppliers.find_one({"supplier_id": account.entity_id})
    if not entity:
        raise HTTPException(status_code=400, detail=f"No {account.role} found with id {account.entity_id}")

    temp_password = secrets.token_urlsafe(9)
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": account.email,
        "password_hash": hash_password(temp_password),
        "name": account.name,
        "phone": None,
        "location": None,
        "picture": None,
        "language": "fr",
        "role": account.role,
        "entity_id": account.entity_id,
        "must_change_password": True,
        "email_verified": True,  # compte cree et transmis par l'admin
        "kyc_status": "validated",  # les partenaires ne passent pas par le KYC membre
        "kyc_documents": {},
        "mobile_money": {},
        "cgu_accepted": False,
        "buyer_profile": None,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    return {
        "user_id": user_id,
        "email": account.email,
        "role": account.role,
        "entity_id": account.entity_id,
        "temp_password": temp_password,
        "message": "Transmettez ce mot de passe provisoire au partenaire. Il devra le changer a sa premiere connexion."
    }

@api_router.post("/admin/partner-accounts/{user_id}/reset-password")
async def reset_partner_password(user_id: str, admin: dict = Depends(get_current_user)):
    """Regenere un mot de passe provisoire pour un compte partenaire."""
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    target = await db.users.find_one({"user_id": user_id, "role": {"$in": ["transitaire", "supplier"]}})
    if not target:
        raise HTTPException(status_code=404, detail="Partner account not found")

    temp_password = secrets.token_urlsafe(9)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": hash_password(temp_password), "must_change_password": True}}
    )
    return {"user_id": user_id, "temp_password": temp_password}

@api_router.put("/auth/change-password")
async def change_password(payload: ChangePassword, user: dict = Depends(get_current_user)):
    """Changement de mot de passe par l'utilisateur connecte (utilise notamment
    par les partenaires a leur premiere connexion)."""
    if not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False}}
    )
    return {"message": "Password changed"}

# ========================
# PASSWORD RESET (mot de passe oublie, emails via Resend)
# ========================

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM = os.environ.get("RESEND_FROM", "SilkRoute <onboarding@resend.dev>")
RESET_TOKEN_TTL_MINUTES = 60

def _frontend_base_url() -> str:
    """Base URL du frontend pour construire le lien de reinitialisation :
    FRONTEND_URL si definie, sinon la premiere origine CORS configuree."""
    explicit = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    origins = [o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    return origins[0] if origins else ""

async def send_email(to_email: str, subject: str, html: str) -> bool:
    """Envoi d'un email transactionnel via Resend. Best-effort : les echecs sont
    logges mais ne font jamais echouer la requete appelante."""
    if not RESEND_API_KEY:
        logger.error("RESEND_API_KEY is not configured - cannot send email")
        return False
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={
                    "from": RESEND_FROM,
                    "to": [to_email],
                    "subject": subject,
                    "html": html
                },
                timeout=15
            )
        if response.status_code >= 400:
            logger.error(f"Resend API error {response.status_code}: {response.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

def _email_button_html(title: str, body: str, button_label: str, link: str, footer: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#0A0A0A">SilkRoute — {title}</h2>
      <p>{body}</p>
      <p style="margin:24px 0">
        <a href="{link}" style="background:#D4AF37;color:#0A0A0A;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          {button_label}
        </a>
      </p>
      <p style="color:#666;font-size:13px">{footer}</p>
    </div>
    """

async def send_reset_email(to_email: str, reset_link: str) -> bool:
    return await send_email(
        to_email,
        "SilkRoute — Réinitialisation de votre mot de passe",
        _email_button_html(
            "Réinitialisation du mot de passe",
            "Vous avez demandé la réinitialisation de votre mot de passe.",
            "Choisir un nouveau mot de passe",
            reset_link,
            f"Ce lien expire dans {RESET_TOKEN_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine "
            "de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé."
        )
    )

VERIFY_TOKEN_TTL_HOURS = 48

async def create_and_send_verification(user_id: str, email: str) -> bool:
    """Genere un jeton de verification d'email (hash en base) et envoie le lien."""
    token = secrets.token_urlsafe(32)
    await db.email_verifications.insert_one({
        "user_id": user_id,
        "token_hash": hash_password(token),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_TTL_HOURS)).isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    verify_link = f"{_frontend_base_url()}/verify-email?token={token}"
    return await send_email(
        email,
        "SilkRoute — Vérifiez votre adresse email",
        _email_button_html(
            "Vérification de votre email",
            "Bienvenue sur SilkRoute ! Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.",
            "Vérifier mon email",
            verify_link,
            f"Ce lien expire dans {VERIFY_TOKEN_TTL_HOURS} heures. Si vous n'avez pas créé de compte "
            "SilkRoute, ignorez cet email."
        )
    )

@api_router.post("/auth/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(request: Request, payload: ForgotPassword):
    """Envoie un lien de reinitialisation par email. Repond toujours pareil, que
    l'email existe ou non, pour ne pas permettre d'enumerer les comptes."""
    generic_response = {"message": "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."}

    user = await db.users.find_one({"email": payload.email})
    if not user:
        return generic_response

    # Jeton a usage unique : seul son hash est stocke en base, comme un mot de passe
    token = secrets.token_urlsafe(32)
    await db.password_resets.insert_one({
        "user_id": user["user_id"],
        "token_hash": hash_password(token),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    base_url = _frontend_base_url()
    reset_link = f"{base_url}/reset-password?token={token}"
    sent = await send_reset_email(payload.email, reset_link)
    if not sent:
        logger.error(f"Reset email could not be sent to user {user['user_id']}")

    return generic_response

@api_router.post("/auth/verify-email")
@limiter.limit("20/hour")
async def verify_email(request: Request, payload: dict = Body(...)):
    """Valide le jeton recu par email a l'inscription et marque l'email verifie."""
    token = payload.get("token", "")
    if not token:
        raise HTTPException(status_code=400, detail="Token manquant")

    now = datetime.now(timezone.utc)
    candidates = await db.email_verifications.find({"used": False}).sort("created_at", -1).to_list(200)

    matched = None
    for candidate in candidates:
        expires_at = datetime.fromisoformat(candidate["expires_at"])
        if expires_at < now:
            continue
        if verify_password(token, candidate["token_hash"]):
            matched = candidate
            break

    if not matched:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré. Redemandez un email de vérification depuis votre profil.")

    await db.users.update_one(
        {"user_id": matched["user_id"]},
        {"$set": {"email_verified": True, "email_verified_at": now.isoformat()}}
    )
    await db.email_verifications.update_one(
        {"_id": matched["_id"]},
        {"$set": {"used": True, "used_at": now.isoformat()}}
    )
    return {"message": "Email vérifié. Merci !"}

@api_router.post("/auth/resend-verification")
@limiter.limit("3/hour")
async def resend_verification(request: Request, user: dict = Depends(get_current_user)):
    """Renvoie l'email de verification a l'utilisateur connecte."""
    if user.get("email_verified"):
        return {"message": "Email déjà vérifié"}
    sent = await create_and_send_verification(user["user_id"], user["email"])
    if not sent:
        raise HTTPException(status_code=502, detail="L'email n'a pas pu être envoyé. Réessayez plus tard.")
    return {"message": "Email de vérification renvoyé"}

@api_router.post("/auth/reset-password")
@limiter.limit("10/hour")
async def reset_password(request: Request, payload: ResetPassword):
    """Valide le jeton recu par email et applique le nouveau mot de passe."""
    now = datetime.now(timezone.utc)
    candidates = await db.password_resets.find({"used": False}).sort("created_at", -1).to_list(200)

    matched = None
    for candidate in candidates:
        expires_at = datetime.fromisoformat(candidate["expires_at"])
        if expires_at < now:
            continue
        if verify_password(payload.token, candidate["token_hash"]):
            matched = candidate
            break

    if not matched:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré. Refaites une demande de réinitialisation.")

    await db.users.update_one(
        {"user_id": matched["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False}}
    )
    await db.password_resets.update_one(
        {"_id": matched["_id"]},
        {"$set": {"used": True, "used_at": now.isoformat()}}
    )
    return {"message": "Mot de passe réinitialisé. Vous pouvez maintenant vous connecter."}

# ========================
# PARTNER PORTAL (transitaire & fournisseur)
# ========================

async def require_partner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("transitaire", "supplier"):
        raise HTTPException(status_code=403, detail="Partner access required")
    if not user.get("entity_id"):
        raise HTTPException(status_code=403, detail="No entity linked to this account")
    return user

def _partner_groupage_query(user: dict) -> dict:
    if user["role"] == "transitaire":
        return {"transitaire_id": user["entity_id"]}
    return {"supplier_id": user["entity_id"]}

@api_router.get("/partner/groupages")
async def partner_groupages(user: dict = Depends(require_partner)):
    """Groupages assignes au partenaire connecte (par sa fiche transitaire/fournisseur).
    Le cout interne et la marge SilkRoute ne sont jamais visibles des partenaires."""
    groupages = await db.groupages.find(
        _partner_groupage_query(user),
        {"_id": 0, "internal_cost_cny": 0, "wholesale_unit_price_fcfa": 0,
         "service_fee_percent": 0, "supplier_documents": 0}
    ).sort("created_at", -1).to_list(200)
    return groupages

@api_router.put("/partner/groupages/{groupage_id}/phase")
async def update_shipment_phase(groupage_id: str, update: PhaseUpdate, user: dict = Depends(require_partner)):
    """Le transitaire met a jour la phase d'expedition de SON groupage."""
    if user["role"] != "transitaire":
        raise HTTPException(status_code=403, detail="Only the transitaire can update shipment phases")

    if update.phase not in SHIPMENT_PHASES:
        raise HTTPException(status_code=400, detail=f"Invalid phase. Must be one of: {', '.join(SHIPMENT_PHASES)}")

    groupage = await db.groupages.find_one({"groupage_id": groupage_id, "transitaire_id": user["entity_id"]})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found or not assigned to you")

    timeline_entry = {
        "phase": update.phase,
        "note": update.note,
        "updated_by": user["user_id"],
        "updated_by_name": user["name"],
        "at": datetime.now(timezone.utc).isoformat()
    }
    await db.groupages.update_one(
        {"groupage_id": groupage_id},
        {"$set": {"shipment_status": update.phase}, "$push": {"shipment_timeline": timeline_entry}}
    )
    return {"message": "Phase updated", "shipment_status": update.phase, "timeline_entry": timeline_entry}

@api_router.post("/partner/groupages/{groupage_id}/documents")
async def partner_add_document(groupage_id: str, doc: LogisticsDocument, user: dict = Depends(require_partner)):
    """Le partenaire ajoute un document a SON groupage : documents logistiques pour
    le transitaire, documents fournisseur pour le fournisseur."""
    groupage = await db.groupages.find_one({"groupage_id": groupage_id, **_partner_groupage_query(user)})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found or not assigned to you")

    doc_data = doc.model_dump()
    doc_data["uploaded_at"] = datetime.now(timezone.utc).isoformat()
    doc_data["uploaded_by"] = user["user_id"]
    doc_data["uploaded_by_role"] = user["role"]

    target_field = "logistics_documents" if user["role"] == "transitaire" else "supplier_extra_documents"
    await db.groupages.update_one(
        {"groupage_id": groupage_id},
        {"$push": {target_field: doc_data}}
    )
    return {"message": "Document added"}

# ========================
# REVIEWS (avis post-livraison)
# ========================

@api_router.post("/groupages/{groupage_id}/reviews")
async def create_review(groupage_id: str, review: ReviewCreate, user: dict = Depends(get_current_user)):
    """Un membre du groupage laisse un avis une fois la marchandise livree."""
    groupage = await db.groupages.find_one({"groupage_id": groupage_id})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    if groupage.get("shipment_status") != "delivered":
        raise HTTPException(status_code=400, detail="Les avis ne sont possibles qu'apres livraison")

    membership = await db.groupage_members.find_one({"groupage_id": groupage_id, "user_id": user["user_id"]})
    if not membership:
        raise HTTPException(status_code=403, detail="Only groupage members can leave a review")

    existing = await db.groupage_reviews.find_one({"groupage_id": groupage_id, "user_id": user["user_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this groupage")

    review_doc = {
        "review_id": f"rev_{uuid.uuid4().hex[:12]}",
        "groupage_id": groupage_id,
        "supplier_id": groupage.get("supplier_id"),
        "user_id": user["user_id"],
        "user_name": user["name"],
        "rating": review.rating,
        "comment": review.comment,
        "supplier_reply": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.groupage_reviews.insert_one(review_doc)
    return {k: v for k, v in review_doc.items() if k != "_id"}

@api_router.get("/groupages/{groupage_id}/reviews")
async def list_reviews(groupage_id: str, user: dict = Depends(get_current_user)):
    reviews = await db.groupage_reviews.find({"groupage_id": groupage_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reviews

@api_router.post("/partner/reviews/{review_id}/reply")
async def reply_to_review(review_id: str, payload: ReviewReply, user: dict = Depends(require_partner)):
    """Le fournisseur repond a un avis laisse sur un de ses groupages."""
    if user["role"] != "supplier":
        raise HTTPException(status_code=403, detail="Only suppliers can reply to reviews")

    review = await db.groupage_reviews.find_one({"review_id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.get("supplier_id") != user["entity_id"]:
        raise HTTPException(status_code=403, detail="This review does not concern your groupages")

    await db.groupage_reviews.update_one(
        {"review_id": review_id},
        {"$set": {
            "supplier_reply": payload.reply,
            "supplier_reply_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Reply saved"}

# ========================
# PRODUCT IMAGE SCRAPING (admin)
# ========================

class ScrapeImageRequest(BaseModel):
    url: str

_PRIVATE_HOST_RE = re.compile(
    r"^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[?::1)",
    re.IGNORECASE
)

@api_router.post("/admin/scrape-product-image")
async def scrape_product_image(payload: ScrapeImageRequest, admin: dict = Depends(get_current_user)):
    """Recupere l'image principale d'une page produit (Alibaba/1688/...) via ses
    meta tags og:image / twitter:image. Reserve a l'admin ; garde anti-SSRF basique."""
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    url = payload.url.strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL invalide (http/https uniquement)")

    from urllib.parse import urlparse
    hostname = (urlparse(url).hostname or "")
    if not hostname or "." not in hostname or _PRIVATE_HOST_RE.match(hostname):
        raise HTTPException(status_code=400, detail="Hote non autorise")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr,en;q=0.8,zh;q=0.6",
    }
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as http_client:
            response = await http_client.get(url, headers=headers)
    except Exception as e:
        logger.warning(f"Scrape failed for {url}: {e}")
        raise HTTPException(status_code=502, detail="Impossible de charger la page produit")

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"La page produit repond avec une erreur ({response.status_code})")

    html = response.text[:800_000]  # borne la taille analysee

    # og:image / twitter:image, dans les deux ordres d'attributs
    patterns = [
        r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)(?::src)?["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)(?::src)?["\']',
        # fallback frequent sur les pages produit chinoises
        r'"(?:imageUrl|mainImageUrl|imgUrl)"\s*:\s*"(https?:[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"',
    ]
    image_url = None
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            image_url = match.group(1)
            break

    if not image_url:
        raise HTTPException(
            status_code=404,
            detail="Aucune image trouvee sur cette page. Collez l'URL de l'image manuellement."
        )

    # Normalisation : URLs protocole-relatives (//img.alicdn.com/...) et echappees
    image_url = image_url.replace("\\u002F", "/").replace("\\/", "/")
    if image_url.startswith("//"):
        image_url = "https:" + image_url

    return {"image_url": image_url}

# ========================
# SIMULATION ROUTE (Public)
# ========================

@api_router.post("/simulate")
async def simulate_pricing(request: Request):
    """
    Simulation publique pour le widget landing page
    Entrée: prix unitaire CNY, poids kg, quantité
    Sortie: comparaison Solo vs Groupage estimé
    """
    data = await request.json()
    
    unit_price_cny = float(data.get("unit_price_cny", 0))
    unit_weight_kg = float(data.get("unit_weight_kg", 0.5))
    quantity = int(data.get("quantity", 1))
    # Prix transport indicatif au kg en FCFA (ordre de grandeur aerien normal)
    transport_price_per_kg_fcfa = float(data.get("transport_price_per_kg_fcfa", 9000))

    if unit_price_cny <= 0 or quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid input values")

    # Calcul prix Solo
    solo = calculate_solo_price(
        unit_price_cny * CNY_TO_FCFA,
        quantity,
        unit_weight_kg * transport_price_per_kg_fcfa
    )

    # Estimation Groupage (simulation avec un groupe de 100 personnes)
    # Le prix groupé bénéficie de:
    # 1. Négociation volume sur le prix unitaire (-10%)
    # 2. Réduction transport groupé (-40%)
    estimated_group_size = 100

    negotiated_unit_price_fcfa = unit_price_cny * 0.90 * CNY_TO_FCFA
    discounted_transport_fcfa = unit_weight_kg * transport_price_per_kg_fcfa * 0.60

    groupage = calculate_groupage_price(
        negotiated_unit_price_fcfa,
        discounted_transport_fcfa,
        estimated_group_size,
        quantity
    )

    savings_fcfa = solo["total_fcfa"] - groupage["total_fcfa"]
    savings_percentage = (savings_fcfa / solo["total_fcfa"]) * 100 if solo["total_fcfa"] > 0 else 0
    
    # Reponse publique volontairement simplifiee : on ne renvoie pas le detail
    # des hypotheses (taille de groupe, taux de negociation, frais internes)
    # pour ne pas exposer notre modele de pricing a des tiers non authentifies.
    savings_pct_banded = round(max(0, savings_percentage) / 5) * 5  # arrondi par tranche de 5%
    savings_amount_banded = round(max(0, savings_fcfa) / 500) * 500  # arrondi par tranche de 500 FCFA
    return {
        "estimated_solo_price_fcfa": round(solo["total_fcfa"] / 100) * 100,
        "estimated_groupage_price_fcfa": round(groupage["total_fcfa"] / 100) * 100,
        "savings_amount_fcfa": savings_amount_banded,
        "savings_percentage": savings_pct_banded,
        "note": "Estimation indicative. Les economies reelles dependent du groupage rejoint."
    }

# ========================
# PRODUCT PROPOSALS
# ========================

def _normalize_url(url: str) -> str:
    return re.sub(r'^https?://(www\.)?', '', url.strip().lower()).rstrip('/')

def _titles_similar(a: str, b: str) -> bool:
    return SequenceMatcher(None, a.strip().lower(), b.strip().lower()).ratio() >= 0.8

async def find_similar_proposal(product_url: str, title: str) -> Optional[dict]:
    """Cherche une proposition existante (non rejetee) pour le meme produit :
    meme lien produit (normalise) ou titre tres proche. Sert a regrouper l'interet
    des membres au lieu de multiplier les doublons."""
    candidates = await db.product_proposals.find(
        {"status": {"$in": ["pending", "approved", "featured"]}}, {"_id": 0}
    ).to_list(500)

    target_url = _normalize_url(product_url)
    for candidate in candidates:
        if _normalize_url(candidate["product_url"]) == target_url:
            return candidate
        if _titles_similar(candidate["title"], title):
            return candidate
    return None

@api_router.post("/proposals")
async def create_proposal(proposal: ProductProposal, user: dict = Depends(get_current_user)):
    """Membre ou admin propose un produit. Si une proposition similaire existe deja
    (meme lien ou titre proche), l'utilisateur est simplement ajoute comme "interesse"
    dessus plutot que de creer un doublon."""
    existing = await find_similar_proposal(proposal.product_url, proposal.title)
    if existing:
        interested = existing.get("interested_user_ids", [])
        if user["user_id"] not in interested:
            await db.product_proposals.update_one(
                {"proposal_id": existing["proposal_id"]},
                {
                    "$addToSet": {"interested_user_ids": user["user_id"]},
                    "$inc": {"interested_count": 1}
                }
            )
            interested_count = existing.get("interested_count", 1) + 1
        else:
            interested_count = existing.get("interested_count", 1)
        return {
            "proposal_id": existing["proposal_id"],
            "status": existing["status"],
            "merged": True,
            "interested_count": interested_count,
            "message": "Une proposition similaire existe deja, votre interet y a ete ajoute."
        }

    proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
    proposal_doc = {
        "proposal_id": proposal_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "user_role": user.get("role", "member"),
        **proposal.model_dump(),
        "status": "pending",  # pending, approved, rejected, featured
        "interested_user_ids": [user["user_id"]],
        "interested_count": 1,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.product_proposals.insert_one(proposal_doc)
    return {"proposal_id": proposal_id, "status": "pending", "merged": False, "interested_count": 1}

@api_router.get("/proposals")
async def list_proposals(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Liste les propositions (admin voit tout, membre voit celles qu'il a creees ou
    pour lesquelles il a exprime de l'interet)"""
    query = {}
    if user.get("role") != "admin":
        query["interested_user_ids"] = user["user_id"]
    if status:
        query["status"] = status

    proposals = await db.product_proposals.find(query, {"_id": 0}).sort("interested_count", -1).to_list(100)
    return proposals

@api_router.put("/admin/proposals/{proposal_id}")
async def update_proposal_status(proposal_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Admin approuve/rejette/met en avant une proposition"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    new_status = data.get("status")
    
    if new_status not in ["approved", "rejected", "featured"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.product_proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {"status": new_status, "reviewed_by": user["user_id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Proposal {new_status}"}

# ========================
# CLOUDINARY ROUTES
# ========================

@api_router.get("/cloudinary/signature")
async def get_cloudinary_signature(folder: str = "uploads", user: dict = Depends(get_current_user)):
    ALLOWED_FOLDERS = ("kyc/", "groupages/", "uploads/", "supplier_docs/", "logistics_docs/")
    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    
    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": folder}
    
    signature = cloudinary.utils.api_sign_request(
        params,
        os.environ.get("CLOUDINARY_API_SECRET")
    )
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder
    }

# ========================
# GROUPAGE ROUTES
# ========================

# Champs sensibles jamais exposes dans les reponses publiques de groupage :
# les documents fournisseur revelent l'identite legale du fournisseur (risque de
# contournement) ; internal_cost_cny et wholesale_unit_price_fcfa revelent la
# marge SilkRoute.
PUBLIC_GROUPAGE_PROJECTION = {
    "_id": 0,
    "supplier_documents": 0,
    "supplier_extra_documents": 0,
    "internal_cost_cny": 0,
    "wholesale_unit_price_fcfa": 0,
    "service_fee_percent": 0,
}

@api_router.get("/groupages")
async def list_groupages(status: Optional[str] = None, category_id: Optional[str] = None, featured: bool = False, limit: int = 20):
    query = {}
    if status:
        query["status"] = status
    if category_id:
        query["product_category_id"] = category_id
    if featured:
        query["is_featured"] = True

    groupages = await db.groupages.find(query, PUBLIC_GROUPAGE_PROJECTION).sort("created_at", -1).limit(limit).to_list(limit)

    for g in groupages:
        for field in ["created_at", "deadline", "estimated_arrival"]:
            if isinstance(g.get(field), str):
                g[field] = datetime.fromisoformat(g[field])

    return groupages

@api_router.get("/groupages/{groupage_id}")
async def get_groupage(groupage_id: str):
    groupage = await db.groupages.find_one({"groupage_id": groupage_id}, PUBLIC_GROUPAGE_PROJECTION)
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    for field in ["created_at", "deadline", "estimated_arrival"]:
        if isinstance(groupage.get(field), str):
            groupage[field] = datetime.fromisoformat(groupage[field])

    return groupage

@api_router.get("/groupages/{groupage_id}/pricing")
async def get_groupage_pricing(groupage_id: str, quantity: int = 1, user: dict = Depends(get_current_user)):
    """Calcul comparatif des prix pour une quantité donnée (reserve aux utilisateurs connectes,
    pour eviter que le detail de notre modele de prix soit librement consultable par des tiers)"""
    groupage = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")
    
    comparison = calculate_comparison(groupage, quantity)
    return comparison

@api_router.get("/groupages/{groupage_id}/documents")
async def get_groupage_documents(groupage_id: str, user: dict = Depends(get_current_user)):
    """Documents d'un groupage. Les documents logistiques (BL, packing list...)
    sont visibles par les membres ; les documents fournisseur (licence commerciale,
    identite legale du fournisseur) sont reserves a l'admin pour empecher le
    contournement de la plateforme."""
    groupage = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    is_admin = user.get("role") == "admin"
    membership = await db.groupage_members.find_one({
        "groupage_id": groupage_id,
        "user_id": user["user_id"]
    })

    if not membership and not is_admin:
        raise HTTPException(status_code=403, detail="You must be a member to view documents")

    return {
        "supplier_documents": groupage.get("supplier_documents", {}) if is_admin else {},
        "supplier_documents_validated": groupage.get("supplier_documents_validated", False),
        "logistics_documents": groupage.get("logistics_documents", [])
    }

@api_router.post("/groupages/{groupage_id}/join")
async def join_groupage(groupage_id: str, join_data: JoinGroupage, user: dict = Depends(get_current_user)):
    if user.get("kyc_status") != "validated":
        raise HTTPException(status_code=403, detail="KYC validation required to join groupages")
    
    groupage = await db.groupages.find_one({"groupage_id": groupage_id})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")
    
    if groupage["status"] != "open":
        raise HTTPException(status_code=400, detail="Groupage is not open for joining")
    
    existing = await db.groupage_members.find_one({
        "groupage_id": groupage_id,
        "user_id": user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already joined this groupage")

    # Depassement de la quantite CIBLE (pas seulement ce qu'il en reste) : un
    # supplement s'applique et doit etre confirme explicitement (409, pas
    # silencieusement accepte, pas non plus bloquant comme avant).
    overage = compute_overage(groupage, join_data.quantity)
    if overage["is_overage"] and not join_data.accept_overage:
        raise HTTPException(status_code=409, detail={
            "code": "overage_confirmation_required",
            "remaining": overage["remaining"],
            "requested": join_data.quantity,
            "overage_fee_fcfa": overage["overage_fee_fcfa"],
        })

    # Calculer le prix pour ce membre, sur la quantite cible EVENTUELLEMENT
    # relevee pour absorber le depassement.
    pricing = calculate_groupage_price(
        get_member_unit_price_fcfa(groupage),
        get_per_item_transport_fcfa(groupage),
        overage["new_total_quantity"],
        join_data.quantity,
        get_service_fee_percent(groupage)
    )
    if overage["is_overage"]:
        pricing["total_fcfa"] += overage["overage_fee_fcfa"]
        pricing["overage_fee_fcfa"] = overage["overage_fee_fcfa"]

    if not pricing.get("meets_minimum", True):
        raise HTTPException(
            status_code=400,
            detail=f"Total minimum de {MIN_GROUPAGE_TOTAL_FCFA} FCFA non atteint. "
                   f"Quantite minimale requise : {pricing.get('min_quantity_needed')}."
        )

    # Ville de retrait : obligatoire des que le groupage a des villes de desserte.
    # Le membre doit accepter EXPLICITEMENT d'aller recuperer sa marchandise dans
    # la ville choisie, et ce choix est definitif (aucune route ne le modifie).
    pickup_cities = groupage.get("pickup_cities") or []
    pickup_city = None
    if pickup_cities:
        if not join_data.pickup_city:
            raise HTTPException(
                status_code=400,
                detail=f"Choisissez votre ville de retrait parmi : {', '.join(pickup_cities)}"
            )
        matched = next((c for c in pickup_cities if c.strip().lower() == join_data.pickup_city.strip().lower()), None)
        if not matched:
            raise HTTPException(
                status_code=400,
                detail=f"Ville de retrait invalide. Villes desservies : {', '.join(pickup_cities)}"
            )
        if not join_data.accept_pickup:
            raise HTTPException(
                status_code=400,
                detail="Vous devez accepter explicitement d'aller recuperer votre marchandise dans la ville choisie. Ce choix est definitif."
            )
        pickup_city = matched

    member_doc = {
        "member_id": f"member_{uuid.uuid4().hex[:12]}",
        "groupage_id": groupage_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "user_location": user.get("location"),
        "quantity": join_data.quantity,
        "share_percentage": pricing["share_percentage"],
        "total_price_fcfa": pricing["total_fcfa"],
        # Cumul des supplements de depassement payes par ce membre (adhesion +
        # augmentations ulterieures). Distinct du prix normal, pour tracer
        # separement ce que rapportent les depassements.
        "overage_fee_fcfa": overage["overage_fee_fcfa"] if overage["is_overage"] else 0,
        "pickup_city": pickup_city,
        "pickup_accepted_at": datetime.now(timezone.utc).isoformat() if pickup_city else None,
        "caution_paid": False,
        "solde_paid": False,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }

    await db.groupage_members.insert_one(member_doc)
    groupage_update = {"$inc": {"current_members": 1, "current_quantity_reserved": join_data.quantity}}
    if overage["is_overage"]:
        # La quantite cible affichee a tous doit refleter le depassement
        # accepte, sinon la barre de progression et les futurs calculs de
        # part redeviennent incoherents pour les autres membres.
        groupage_update["$set"] = {"total_quantity": overage["new_total_quantity"]}
    await db.groupages.update_one({"groupage_id": groupage_id}, groupage_update)
    
    return {
        "message": "Successfully joined groupage",
        "member_id": member_doc["member_id"],
        "pricing": pricing
    }

@api_router.post("/groupages/{groupage_id}/increase-quantity")
async def increase_quantity(groupage_id: str, data: IncreaseQuantity, user: dict = Depends(get_current_user)):
    """Un membre DEJA present dans le groupage augmente sa part. Meme logique
    de depassement que l'adhesion (voir compute_overage) : au-dela de la
    quantite cible du groupage, un supplement de OVERAGE_FEE_FCFA s'applique
    et doit etre confirme explicitement (accept_overage).

    Le supplement du prix (unites en plus + eventuel supplement de
    depassement) est du immediatement : il passe par le meme circuit de
    paiement Tara que la caution/le solde, avec payment_type="addition".
    """
    if data.additional_quantity <= 0:
        raise HTTPException(status_code=400, detail="additional_quantity must be positive")

    groupage = await db.groupages.find_one({"groupage_id": groupage_id})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    membership = await db.groupage_members.find_one({"groupage_id": groupage_id, "user_id": user["user_id"]})
    if not membership:
        raise HTTPException(status_code=404, detail="You are not a member of this groupage")

    overage = compute_overage(groupage, data.additional_quantity)
    if overage["is_overage"] and not data.accept_overage:
        raise HTTPException(status_code=409, detail={
            "code": "overage_confirmation_required",
            "remaining": overage["remaining"],
            "requested": data.additional_quantity,
            "overage_fee_fcfa": overage["overage_fee_fcfa"],
        })

    new_quantity = membership["quantity"] + data.additional_quantity
    new_pricing = calculate_groupage_price(
        get_member_unit_price_fcfa(groupage),
        get_per_item_transport_fcfa(groupage),
        overage["new_total_quantity"],
        new_quantity,
        get_service_fee_percent(groupage)
    )
    # Le supplement du est la difference entre le nouveau total (a la
    # quantite augmentee) et ce que le membre devait avant, plus le
    # supplement de depassement le cas echeant. Le service fee etant deja
    # inclus dans les deux totaux, la difference reste correcte.
    montant_supplementaire = new_pricing["total_fcfa"] - membership["total_price_fcfa"]
    if overage["is_overage"]:
        montant_supplementaire += overage["overage_fee_fcfa"]

    await db.groupage_members.update_one(
        {"member_id": membership["member_id"]},
        {"$set": {
            "quantity": new_quantity,
            "share_percentage": new_pricing["share_percentage"],
            "total_price_fcfa": new_pricing["total_fcfa"] + (
                membership.get("overage_fee_fcfa", 0) + (overage["overage_fee_fcfa"] if overage["is_overage"] else 0)
            ),
            "overage_fee_fcfa": membership.get("overage_fee_fcfa", 0) + (overage["overage_fee_fcfa"] if overage["is_overage"] else 0),
            # Montant a payer pour CETTE augmentation precisement : le circuit
            # de paiement (payment_type="addition") s'appuie dessus.
            "pending_addition_fcfa": round(montant_supplementaire, 0),
            "addition_paid": False,
        }}
    )

    groupage_update = {"$inc": {"current_quantity_reserved": data.additional_quantity}}
    if overage["is_overage"]:
        groupage_update["$set"] = {"total_quantity": overage["new_total_quantity"]}
    await db.groupages.update_one({"groupage_id": groupage_id}, groupage_update)

    return {
        "message": "Quantity increased",
        "new_quantity": new_quantity,
        "pending_addition_fcfa": round(montant_supplementaire, 0),
        "overage_applied": overage["is_overage"],
        "overage_fee_fcfa": overage["overage_fee_fcfa"] if overage["is_overage"] else 0,
    }

@api_router.get("/groupages/{groupage_id}/members")
async def get_groupage_members(groupage_id: str, user: dict = Depends(get_current_user)):
    members = await db.groupage_members.find({"groupage_id": groupage_id}, {"_id": 0}).to_list(100)
    return members

@api_router.get("/groupages/{groupage_id}/messages")
async def get_groupage_messages(groupage_id: str, limit: int = 50, user: dict = Depends(get_current_user)):
    messages = await db.messages.find(
        {"groupage_id": groupage_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return list(reversed(messages))

@api_router.get("/user/groupages")
async def get_user_groupages(user: dict = Depends(get_current_user)):
    memberships = await db.groupage_members.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    groupage_ids = [m["groupage_id"] for m in memberships]

    groupages = await db.groupages.find({"groupage_id": {"$in": groupage_ids}}, PUBLIC_GROUPAGE_PROJECTION).to_list(100)
    
    for g in groupages:
        for field in ["created_at", "deadline", "estimated_arrival"]:
            if isinstance(g.get(field), str):
                g[field] = datetime.fromisoformat(g[field])
        
        membership = next((m for m in memberships if m["groupage_id"] == g["groupage_id"]), None)
        if membership:
            g["membership"] = membership
    
    return groupages

# ========================
# PAYMENT ROUTES
# ========================

@api_router.post("/payments/checkout")
async def create_checkout(payment_data: PaymentCreate, request: Request, user: dict = Depends(get_current_user)):
    groupage = await db.groupages.find_one({"groupage_id": payment_data.groupage_id})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    # Le montant du est calcule au meme endroit que pour Tara, pour que les deux
    # moyens de paiement ne puissent pas diverger (le controle d'adhesion y est
    # inclus). Stripe facture en EUR.
    montant_fcfa = await _member_amount_due_fcfa(
        payment_data.groupage_id, user["user_id"], payment_data.payment_type
    )
    amount = montant_fcfa / FCFA_PER_EUR

    host_url = payment_data.origin_url
    amount_cents = int(round(amount, 2) * 100)  # Stripe attend un montant en plus petite unite (centimes)
    
    success_url = f"{host_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/groupages/{payment_data.groupage_id}"
    
    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {"name": f"SilkRoute - {payment_data.payment_type}"},
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "groupage_id": payment_data.groupage_id,
            "payment_type": payment_data.payment_type
        }
    )
    
    payment_doc = {
        "payment_id": f"pay_{uuid.uuid4().hex[:12]}",
        "session_id": session.id,
        "user_id": user["user_id"],
        "groupage_id": payment_data.groupage_id,
        "payment_type": payment_data.payment_type,
        "amount": round(amount, 2),
        "currency": "eur",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(payment_doc)
    
    return {"url": session.url, "session_id": session.id}

# ========================
# PAIEMENT TARA MONEY
# ========================

def _backend_base_url(request: Request) -> str:
    """URL publique du backend, pour construire l'URL de webhook envoyee a Tara.

    request.base_url ne reflete le bon schema (https) que si uvicorn tourne
    avec --proxy-headers (voir Procfile) : Railway termine le TLS a sa
    frontiere et relaie en clair vers le conteneur, donc sans cette option
    la requete parait venir en HTTP. Une URL de webhook en http:// a deja
    ete rejetee par Tara ("ONLY_HTTPS_LINKKS_ALLOWED").
    """
    explicit = os.environ.get("BACKEND_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    return str(request.base_url).rstrip("/")

async def mark_membership_paid(groupage_id: str, user_id: str, payment_type: str) -> None:
    """Met a jour les drapeaux de paiement de l'adhesion.

    Sans caution sur le groupage, l'unique versement couvre la totalite : on
    solde donc les deux drapeaux d'un coup, sinon l'interface reclamerait
    indefiniment un solde deja paye.
    """
    if payment_type == "addition":
        await db.groupage_members.update_one(
            {"user_id": user_id, "groupage_id": groupage_id},
            {"$set": {"addition_paid": True}}
        )
        return

    groupage = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0, "caution_fcfa": 1})
    sans_caution = get_caution_fcfa(groupage or {}) <= 0

    if sans_caution or payment_type == "solde":
        champs = {"caution_paid": True, "solde_paid": True}
    else:
        champs = {"caution_paid": True}

    await db.groupage_members.update_one(
        {"user_id": user_id, "groupage_id": groupage_id},
        {"$set": champs}
    )

async def _member_amount_due_fcfa(groupage_id: str, user_id: str, payment_type: str) -> float:
    """Montant a payer, en FCFA.

    Sans caution (cas par defaut), il n'y a qu'un seul versement : le total.
    Avec caution, le membre verse d'abord ce montant, puis le reste.
    """
    membership = await db.groupage_members.find_one({"groupage_id": groupage_id, "user_id": user_id})
    if not membership:
        raise HTTPException(status_code=400, detail="You must join the groupage first")

    # "addition" est independant du cycle caution/solde : un membre peut avoir
    # deja tout paye et vouloir payer un supplement de quantite ensuite.
    if payment_type == "addition":
        if membership.get("addition_paid", True):
            raise HTTPException(status_code=400, detail="Nothing pending to pay on this groupage")
        montant = float(membership.get("pending_addition_fcfa") or 0)
        if montant <= 0:
            raise HTTPException(status_code=400, detail="Nothing pending to pay on this groupage")
        return montant

    groupage = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0, "caution_fcfa": 1})
    caution = get_caution_fcfa(groupage or {})
    total = float(membership.get("total_price_fcfa") or 0)

    # Rien de plus a reclamer une fois l'adhesion soldee : sans ce garde-fou, un
    # membre pourrait relancer un paiement deja regle.
    if membership.get("solde_paid"):
        raise HTTPException(status_code=400, detail="Cette commande est deja entierement payee")

    if payment_type == "caution":
        if membership.get("caution_paid"):
            raise HTTPException(status_code=400, detail="Ce versement a deja ete effectue")
        if caution <= 0:
            # Pas de caution sur ce groupage : le "premier" paiement est le total.
            return total
        return min(caution, total)

    # Sans caution il n'existe pas de solde separe : le total a ete demande en
    # une fois. Accepter un "solde" ici refacturerait la totalite.
    if caution <= 0:
        raise HTTPException(status_code=400, detail="Ce groupage se regle en une seule fois")

    reste = total - caution
    if reste <= 0:
        raise HTTPException(status_code=400, detail="Nothing left to pay on this groupage")
    return reste

def _tara_safe_text(text: str) -> str:
    """Translittere en ASCII pur pour le nom/la description envoyes a Tara.

    Constate en test reel : les accents et le tiret cadratin ressortent en
    mojibake sur leur page de paiement ("television" -> "tÃ©lÃ©vision",
    tiret -> cases vides illisibles). Le probleme est cote Tara (encodage
    mal gere quelque part dans leur chaine), pas dans ce qu'on leur envoie -
    mais un client qui voit du charabia sur l'ecran de paiement perd
    confiance, donc on neutralise a la source plutot que d'attendre un
    correctif de leur part.
    """
    text = text.replace('—', '-').replace('–', '-').replace(''', "'").replace(''', "'")
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')

async def _start_payment_attempt(data, request: Request, user: dict, method: str) -> dict:
    """Prepare et JOURNALISE une tentative de paiement, avant tout appel a Tara.

    Le paiement est ecrit en base des ici (statut 'initiated') pour que meme
    une tentative refusee par Tara (numero invalide, etc.) reste visible dans
    le suivi - c'est le point demande : savoir qui a essaye de payer, par quel
    moyen, quand et d'ou, pas seulement ce qui a abouti.
    """
    if data.payment_type not in ("caution", "solde", "addition"):
        raise HTTPException(status_code=400, detail="payment_type must be 'caution', 'solde' or 'addition'")

    groupage = await db.groupages.find_one({"groupage_id": data.groupage_id}, PUBLIC_GROUPAGE_PROJECTION)
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    montant = await _member_amount_due_fcfa(data.groupage_id, user["user_id"], data.payment_type)
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    ip = get_client_ip(request)

    doc = {
        "payment_id": payment_id,
        "provider": "tara",
        "payment_method": method,  # "mobile_money" ou "card"
        "user_id": user["user_id"],
        "groupage_id": data.groupage_id,
        "payment_type": data.payment_type,
        "amount": round(montant, 2),
        "currency": "XAF",
        "status": "initiated",
        "ip_address": ip,
        "user_agent": (request.headers.get("user-agent") or "")[:300],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if hasattr(data, "phone_number"):
        doc["phone_number"] = data.phone_number
    await db.payment_transactions.insert_one(doc)
    asyncio.create_task(resolve_ip_location(payment_id, ip))

    return {"payment_id": payment_id, "montant": montant, "groupage": groupage}

async def _mark_attempt_failed(payment_id: str, reason: str) -> None:
    await db.payment_transactions.update_one(
        {"payment_id": payment_id},
        {"$set": {"status": "failed", "failure_reason": reason[:300]}}
    )

@api_router.post("/payments/tara/mobilepay")
async def create_tara_mobilepay(data: TaraMobilePayCreate, request: Request,
                                user: dict = Depends(get_current_user)):
    """Declenche un push de paiement mobile money (USSD) sur le telephone du
    membre. Contrairement aux liens de paiement, le membre ne quitte pas notre
    page : il compose le code recu, la confirmation arrive par webhook.

    Le succes de cet appel signifie seulement que la demande a ete transmise a
    l'operateur (MTN/Orange) - pas que le paiement est confirme.
    """
    if not TARA_API_KEY or not TARA_BUSINESS_ID:
        raise HTTPException(status_code=503, detail="Tara Money n'est pas configure sur ce serveur")
    if not TARA_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Le webhook Tara n'est pas configure sur ce serveur")

    attempt = await _start_payment_attempt(data, request, user, "mobile_money")
    payment_id, montant, groupage = attempt["payment_id"], attempt["montant"], attempt["groupage"]
    libelle = "Caution" if data.payment_type == "caution" else "Solde"
    reference = groupage.get("reference") or groupage["groupage_id"]

    # payment_id est encode DANS l'URL du webhook : ni la reponse immediate ni
    # le webhook /mobilepay ne renvoient notre productId, c'est donc la seule
    # correlation fiable dont on dispose.
    webhook_url = f"{_backend_base_url(request)}/api/webhook/tara/{TARA_WEBHOOK_SECRET}/{payment_id}"
    payload = {
        "apiKey": TARA_API_KEY,
        "businessId": TARA_BUSINESS_ID,
        "productId": payment_id,
        "productName": _tara_safe_text(f"{libelle} - {reference}"[:80]),
        "network": "",
        "productPrice": int(round(montant)),  # Tara attend un entier en FCFA
        "phoneNumber": data.phone_number,
        "webHookUrl": webhook_url,
    }

    try:
        async with httpx.AsyncClient(timeout=20) as http_client:
            response = await http_client.post(TARA_MOBILEPAY_URL, json=payload)
            response.raise_for_status()
            tara = response.json()
    except httpx.HTTPError as exc:
        logger.error(f"Tara mobilepay request failed: {exc}")
        await _mark_attempt_failed(payment_id, f"network_error: {exc}")
        raise HTTPException(status_code=502, detail="Impossible de lancer le paiement")

    # Comparaison tolerante (voir _tara_status_is_success) : la reponse reelle
    # de Tara a deja diverge de sa propre documentation sur la casse du champ
    # status ("API_ORDER_SUCESSFULL" a ete rejete par une comparaison stricte
    # a "SUCCESS" alors que c'etait un succes).
    if _tara_status_is_success(tara) is not True:
        logger.warning(f"Tara mobilepay refused the request: {tara}")
        await _mark_attempt_failed(payment_id, tara.get("message") or "refused_by_tara")
        raise HTTPException(status_code=502, detail=tara.get("message") or "Tara a refuse la demande")

    await db.payment_transactions.update_one(
        {"payment_id": payment_id}, {"$set": {"status": "pending"}}
    )

    return {
        "payment_id": payment_id,
        "amount_fcfa": int(round(montant)),
        "vendor": tara.get("vendor"),  # "ORANGE_CAMEROON" ou "MTN_CAMEROON"
    }

@api_router.post("/payments/tara/card")
async def create_tara_card_payment(data: TaraCardPaymentCreate, request: Request,
                                   user: dict = Depends(get_current_user)):
    """Genere un lien de paiement carte (Visa/Mastercard) via Tara, seul canal
    utilisable depuis un pays quelconque - Stripe n'opere pas au Cameroun.

    Le webhook /paymentlinks est documente : {businessId, status, amount,
    paymentId, productId, collectionId, creationDate, changeDate}. payment_id
    reste toutefois tire de l'URL plutot que de productId, pour garder une
    correlation identique quel que soit le moyen de paiement.
    """
    if not TARA_API_KEY or not TARA_BUSINESS_ID:
        raise HTTPException(status_code=503, detail="Tara Money n'est pas configure sur ce serveur")
    if not TARA_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Le webhook Tara n'est pas configure sur ce serveur")

    attempt = await _start_payment_attempt(data, request, user, "card")
    payment_id, montant, groupage = attempt["payment_id"], attempt["montant"], attempt["groupage"]
    libelle = "Caution" if data.payment_type == "caution" else "Solde"
    reference = groupage.get("reference") or groupage["groupage_id"]

    webhook_url = f"{_backend_base_url(request)}/api/webhook/tara/{TARA_WEBHOOK_SECRET}/{payment_id}"
    payload = {
        "apiKey": TARA_API_KEY,
        "businessId": TARA_BUSINESS_ID,
        "productId": payment_id,
        "productName": _tara_safe_text(f"{libelle} - {reference}"[:80]),
        "productPrice": int(round(montant)),
        "productDescription": _tara_safe_text(f"{libelle} groupage {reference} - {groupage.get('title', '')}"[:200]),
        "webHookUrl": webhook_url,
    }
    if groupage.get("product_image_url"):
        payload["productPictureUrl"] = groupage["product_image_url"]
    frontend = _frontend_base_url()
    if frontend:
        payload["returnUrl"] = f"{frontend}/payment/success?payment_id={payment_id}"

    try:
        async with httpx.AsyncClient(timeout=20) as http_client:
            response = await http_client.post(TARA_PAYMENTLINKS_URL, json=payload)
            response.raise_for_status()
            tara = response.json()
    except httpx.HTTPError as exc:
        logger.error(f"Tara paymentlinks request failed: {exc}")
        await _mark_attempt_failed(payment_id, f"network_error: {exc}")
        raise HTTPException(status_code=502, detail="Impossible de generer le lien de paiement")

    card_link = tara.get("cardLink")
    if _tara_status_is_success(tara) is not True or not card_link:
        logger.warning(f"Tara paymentlinks did not return a card link: {tara}")
        await _mark_attempt_failed(payment_id, tara.get("message") or "no_card_link")
        raise HTTPException(status_code=502, detail=tara.get("message") or "Tara a refuse la demande")

    await db.payment_transactions.update_one(
        {"payment_id": payment_id}, {"$set": {"status": "pending"}}
    )

    return {"payment_id": payment_id, "amount_fcfa": int(round(montant)), "card_link": card_link}

@api_router.get("/payments/tara/status/{payment_id}")
async def get_tara_payment_status(payment_id: str, user: dict = Depends(get_current_user)):
    """Le frontend interroge cette route en boucle apres le push USSD, le temps
    que le membre compose son code. On lit notre propre enregistrement (mis a
    jour par le webhook), pas une API Tara - on reste maitre de la verite."""
    payment = await db.payment_transactions.find_one(
        {"payment_id": payment_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    # failure_code (ex: solde insuffisant) est transmis au frontend, qui le
    # traduit en message actionnable au lieu d'un "reessayez" muet.
    return {"status": payment["status"], "failure_code": payment.get("failure_code")}

def _tara_status_is_success(payload: dict) -> Optional[bool]:
    """Lit le statut renvoye par Tara. /mobilepay est documente avec precision
    (status: SUCCESS|FAILURE) ; /paymentlinks ne l'est pas, d'ou une lecture
    tolerante a plusieurs noms/casses de champ en repli. None = statut illisible,
    a traiter en echec par prudence (jamais confirmer un paiement au hasard)."""
    for key in ("status", "paymentStatus", "state", "transactionStatus"):
        if payload.get(key) not in (None, ""):
            valeur = str(payload[key]).strip().lower()
            if valeur in ("success", "successful", "paid", "completed", "confirmed"):
                return True
            if valeur in ("failure", "failed", "cancelled", "canceled", "declined"):
                return False
            return None  # valeur presente mais non reconnue : prudence
    return None

@api_router.post("/webhook/tara/{secret}/{payment_id}")
async def tara_webhook(secret: str, payment_id: str, request: Request):
    """Confirmation de paiement envoyee par Tara, pour /mobilepay ET
    /paymentlinks (carte). Les deux formats sont desormais documentes :
      - mobilepay : {businessId, paymentId, collectionId, phoneNumber,
        creationDate, changeDate, status}
      - carte     : {businessId, status, amount, paymentId, productId,
        collectionId, creationDate, changeDate}
    Seul le webhook carte renvoie productId - c'est pourquoi payment_id reste
    tire de l'URL (fiable dans les deux cas), productId n'etant verifie qu'a
    titre de recoupement supplementaire quand il est present.

    ATTENTION : aucun mecanisme de signature confirme a ce jour. Le secret
    dans l'URL est donc l'authentification principale, comparee en temps
    constant.
    """
    if not TARA_WEBHOOK_SECRET or not secrets.compare_digest(secret, TARA_WEBHOOK_SECRET):
        raise HTTPException(status_code=404, detail="Not found")

    try:
        payload = await request.json()
    except Exception:
        payload = {}
    logger.info(f"Tara webhook for {payment_id}: {payload}")

    payment = await db.payment_transactions.find_one({"payment_id": payment_id, "provider": "tara"})
    if not payment:
        logger.error(f"Tara webhook for an unknown payment: {payment_id}")
        return {"received": True, "handled": False}

    if payment.get("status") == "completed":
        return {"received": True, "handled": True, "settled": True}  # deja traite

    succes = _tara_status_is_success(payload)
    if succes is not True:
        await db.payment_transactions.update_one(
            {"payment_id": payment_id},
            {"$set": {
                "status": "failed",
                "provider_status": str(payload.get("status") or "unknown"),
                # Code precis de l'operateur mobile money (ex: solde insuffisant),
                # transmis au client via /payments/tara/status pour qu'il sache
                # QUOI corriger plutot qu'un "reessayez" muet.
                "failure_code": payload.get("transactionCode"),
            }}
        )
        logger.warning(f"Tara reported a non-successful payment {payment_id}: {payload}")
        return {"received": True, "handled": True, "settled": False}

    # Le webhook carte (documente) renvoie amount et productId : on les
    # verifie quand ils sont presents. Le webhook mobile money ne les fournit
    # pas - dans ce cas on se fie a payment_id, deja garanti par le secret
    # dans l'URL.
    montant_annonce = payload.get("amount")
    if montant_annonce not in (None, ""):
        try:
            if abs(float(montant_annonce) - float(payment["amount"])) > 1:
                logger.error(
                    f"Tara webhook amount mismatch for {payment_id}: "
                    f"annonce={montant_annonce} attendu={payment['amount']}"
                )
                return {"received": True, "handled": False, "reason": "amount_mismatch"}
        except (TypeError, ValueError):
            pass  # montant illisible : on ignore plutot que de bloquer un vrai paiement

    product_id = payload.get("productId")
    if product_id and product_id != payment_id:
        # Ne bloque pas le paiement (l'URL a deja fait foi) mais un ecart ici
        # serait anormal et merite d'etre regarde.
        logger.warning(f"Tara webhook productId ({product_id}) != payment_id ({payment_id}) in URL")

    await db.payment_transactions.update_one(
        {"payment_id": payment_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "tara_payment_id": payload.get("paymentId"),
            "tara_collection_id": payload.get("collectionId"),
        }}
    )

    await mark_membership_paid(
        payment["groupage_id"], payment["user_id"], payment["payment_type"]
    )

    # Commission Tara : mobile money et carte n'ont pas le meme taux. A titre
    # informatif dans le registre - ne change pas ce que le membre a paye.
    methode = payment.get("payment_method", "mobile_money")
    taux = TARA_FEE_PERCENT_CARD if methode == "card" else TARA_FEE_PERCENT_MOBILE
    frais_fcfa = round(payment["amount"] * taux / 100, 0)

    await record_cash_flow(
        direction="in",
        amount=payment["amount"],
        currency=payment.get("currency", "XAF"),
        account="tara",
        category="member_payment",
        status="confirmed",
        groupage_id=payment.get("groupage_id"),
        user_id=payment.get("user_id"),
        reference=f"tara:{payment_id}",
        note=f"Tara Money ({methode}) — {payment.get('payment_type')}",
        platform_fee_fcfa=frais_fcfa,
        platform_fee_percent=taux,
    )

    return {"received": True, "handled": True, "settled": True}

async def settle_paid_session(session_id: str) -> None:
    """Marque un paiement Stripe comme encaisse, met a jour l'adhesion, et
    inscrit le mouvement au registre de tresorerie.

    Appelee depuis DEUX endroits (le retour navigateur et le webhook), d'ou le
    garde-fou sur le statut : le premier des deux fait le travail, le second ne
    fait rien. Cote registre, `reference` porte le session_id, ce qui empeche
    tout double comptage meme si Stripe rejoue l'evenement.
    """
    payment = await db.payment_transactions.find_one({"session_id": session_id})
    if not payment or payment.get("status") == "completed":
        return

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )

    await mark_membership_paid(
        payment["groupage_id"], payment["user_id"], payment["payment_type"]
    )

    await record_cash_flow(
        direction="in",
        amount=payment["amount"],
        currency=payment.get("currency", "eur"),
        account="stripe",
        category="member_payment",
        status="confirmed",
        groupage_id=payment.get("groupage_id"),
        user_id=payment.get("user_id"),
        reference=f"stripe:{session_id}",
        note=f"Stripe — {payment.get('payment_type')}",
    )

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(get_current_user)):
    status = stripe.checkout.Session.retrieve(session_id)

    if status.payment_status == "paid":
        await settle_paid_session(session_id)

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET is not configured")

    # Verification de signature isolee : un echec ici doit remonter en 400 pour que
    # Stripe le journalise/retente et qu'on soit alerte d'un probleme de config,
    # plutot que d'etre avale silencieusement derriere un 200 "received".
    try:
        event = stripe.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.error(f"Stripe webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        session_id = session_obj["id"]
        payment_status = session_obj.get("payment_status")

        if payment_status == "paid":
            await settle_paid_session(session_id)

    return {"received": True}

# ========================
# ADMIN ROUTES
# ========================

async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def resolve_transport(transitaire: dict, shipping_option_id: Optional[str],
                      unit_weight_kg: Optional[float], unit_volume_cbm: Optional[float]) -> dict:
    """Resout l'option de transport d'un transitaire et verifie que la mesure
    correspondante (poids pour /kg, volume pour /CBM) est renseignee.
    Retourne l'option et les champs de tarification a stocker sur le groupage."""
    options = transitaire.get("shipping_options") or []
    if shipping_option_id:
        option = next((o for o in options if o.get("option_id") == shipping_option_id), None)
        if not option:
            raise HTTPException(status_code=400, detail="Shipping option not found for this transitaire")
        if option.get("unit") == "cbm" and not unit_volume_cbm:
            raise HTTPException(
                status_code=400,
                detail="Cette option est facturee au volume : renseignez le volume unitaire (CBM) du produit."
            )
        if option.get("unit") == "kg" and not unit_weight_kg:
            raise HTTPException(
                status_code=400,
                detail="Cette option est facturee au poids : renseignez le poids unitaire (kg) du produit."
            )
        return {
            "option": option,
            "fields": {
                "shipping_option_id": option["option_id"],
                "shipping_option_label": option.get("label"),
                "transport_unit": option.get("unit", "kg"),
                "transport_price_fcfa": option["price_fcfa"],
                "transport_price_per_kg_fcfa": option["price_fcfa"] if option.get("unit") == "kg" else None,
            }
        }
    if transitaire.get("shipping_price_per_kg_cny") is not None:
        price_fcfa = transitaire["shipping_price_per_kg_cny"] * CNY_TO_FCFA
        return {
            "option": None,
            "fields": {
                "shipping_option_id": None,
                "shipping_option_label": None,
                "transport_unit": "kg",
                "transport_price_fcfa": price_fcfa,
                "transport_price_per_kg_fcfa": price_fcfa,
            }
        }
    raise HTTPException(status_code=400, detail="Selectionnez une option de transport pour ce transitaire")

def estimate_order_totals(unit_price_cny: float, total_quantity: int,
                          transport_unit: str, transport_price_fcfa: float,
                          unit_weight_kg: Optional[float], unit_volume_cbm: Optional[float]) -> dict:
    """Estimation du prix tout compris de la commande groupee selon la formule du
    transitaire : marchandise + transport (mesure unitaire x quantite cible x tarif)."""
    measure = unit_volume_cbm if transport_unit == "cbm" else unit_weight_kg
    measure = measure or 0
    merchandise_cny = unit_price_cny * total_quantity
    transport_total_fcfa = measure * total_quantity * transport_price_fcfa
    transport_total_cny = transport_total_fcfa / CNY_TO_FCFA
    total_cny = merchandise_cny + transport_total_cny
    return {
        "merchandise_cny": round(merchandise_cny, 2),
        "merchandise_fcfa": round(merchandise_cny * CNY_TO_FCFA, 0),
        "transport_total_fcfa": round(transport_total_fcfa, 0),
        "transport_total_cny": round(transport_total_cny, 2),
        "total_order_price_cny": round(total_cny, 2),
        "total_order_price_fcfa": round(total_cny * CNY_TO_FCFA, 0),
        "transport_unit": transport_unit,
        "unit_measure": measure,
        "total_quantity": total_quantity,
    }

@api_router.post("/admin/groupages/estimate")
async def estimate_groupage_pricing(request: Request, admin: dict = Depends(require_admin)):
    """Calcule le prix total estime de la commande selon la formule du transitaire
    choisi (poids ou volume unitaire x quantite cible x tarif de l'option)."""
    data = await request.json()
    transitaire = await db.transitaires.find_one({"transitaire_id": data.get("transitaire_id")}, {"_id": 0})
    if not transitaire:
        raise HTTPException(status_code=400, detail="Transitaire not found")

    unit_weight_kg = float(data.get("unit_weight_kg") or 0) or None
    unit_volume_cbm = float(data.get("unit_volume_cbm") or 0) or None
    transport = resolve_transport(transitaire, data.get("shipping_option_id"), unit_weight_kg, unit_volume_cbm)

    unit_price_cny = float(data.get("unit_price_cny") or 0)
    total_quantity = int(data.get("total_quantity") or 0)
    if unit_price_cny <= 0 or total_quantity <= 0:
        raise HTTPException(status_code=400, detail="unit_price_cny et total_quantity doivent etre positifs")

    result = estimate_order_totals(
        unit_price_cny, total_quantity,
        transport["fields"]["transport_unit"], transport["fields"]["transport_price_fcfa"],
        unit_weight_kg, unit_volume_cbm
    )

    # Marge SilkRoute (spread) : le total calcule ci-dessus est considere comme le
    # COUT REEL negocie ; le prix facture aux membres = cout x (1 + marge%).
    margin_percent = float(data.get("margin_percent") or 0)
    result["internal_cost_cny"] = result["total_order_price_cny"]
    result["margin_percent"] = margin_percent
    result["billed_total_order_price_cny"] = round(result["total_order_price_cny"] * (1 + margin_percent / 100), 2)
    result["billed_total_order_price_fcfa"] = round(result["billed_total_order_price_cny"] * CNY_TO_FCFA, 0)
    result["margin_fcfa"] = round(result["billed_total_order_price_fcfa"] - result["total_order_price_fcfa"], 0)
    return result

@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    pending_kyc = await db.users.count_documents({"kyc_status": "submitted"})
    active_groupages = await db.groupages.count_documents({"status": "open"})
    pending_proposals = await db.product_proposals.count_documents({"status": "pending"})
    total_revenue = await db.payment_transactions.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    return {
        "total_users": total_users,
        "pending_kyc": pending_kyc,
        "active_groupages": active_groupages,
        "pending_proposals": pending_proposals,
        "total_revenue": total_revenue[0]["total"] if total_revenue else 0
    }

# ========================
# TRESORERIE — registre des flux
# ========================

def _cash_flow_query(groupage_id=None, user_id=None, supplier_id=None,
                     transitaire_id=None, account=None, category=None,
                     direction=None, status=None, date_from=None, date_to=None) -> dict:
    """Construit le filtre Mongo commun a la liste et aux agregats, pour que
    les totaux affiches correspondent toujours exactement aux lignes listees."""
    query = {}
    for field, value in (
        ("groupage_id", groupage_id), ("user_id", user_id),
        ("supplier_id", supplier_id), ("transitaire_id", transitaire_id),
        ("account", account), ("category", category),
        ("direction", direction), ("status", status),
    ):
        if value:
            query[field] = value

    if date_from or date_to:
        # occurred_at est stocke en ISO 8601 : la comparaison lexicographique
        # sur ces chaines equivaut a une comparaison chronologique.
        bounds = {}
        if date_from:
            bounds["$gte"] = date_from
        if date_to:
            bounds["$lte"] = date_to + "T23:59:59.999999+00:00" if len(date_to) == 10 else date_to
        query["occurred_at"] = bounds
    return query

@api_router.post("/admin/cash-flows")
async def create_cash_flow(flow: CashFlowCreate, user: dict = Depends(require_admin)):
    """Saisie manuelle d'un mouvement : versement REasy vers un fournisseur,
    encaissement Tara recu hors du site, frais de fonctionnement..."""
    created = await record_cash_flow(**flow.model_dump(), created_by=user["user_id"])
    return created

@api_router.get("/admin/cash-flows")
async def list_cash_flows(
    groupage_id: Optional[str] = None, user_id: Optional[str] = None,
    supplier_id: Optional[str] = None, transitaire_id: Optional[str] = None,
    account: Optional[str] = None, category: Optional[str] = None,
    direction: Optional[str] = None, status: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    limit: int = 200, admin: dict = Depends(require_admin)
):
    query = _cash_flow_query(groupage_id, user_id, supplier_id, transitaire_id,
                             account, category, direction, status, date_from, date_to)
    flows = await db.cash_flows.find(query, {"_id": 0}).sort("occurred_at", -1).limit(limit).to_list(limit)

    # Totaux calcules sur TOUT le perimetre filtre, pas seulement la page
    # renvoyee : sinon les cartes de synthese mentiraient des que limit mord.
    totals = await db.cash_flows.aggregate([
        {"$match": query},
        {"$group": {"_id": {"direction": "$direction", "status": "$status"},
                    "total": {"$sum": "$amount_fcfa"}, "count": {"$sum": 1}}}
    ]).to_list(20)

    resume = {"in_confirmed": 0.0, "out_confirmed": 0.0, "in_pending": 0.0, "out_pending": 0.0, "count": 0}
    for row in totals:
        direction_, status_ = row["_id"]["direction"], row["_id"]["status"]
        resume["count"] += row["count"]
        if status_ == "confirmed":
            resume[f"{direction_}_confirmed"] += row["total"]
        elif status_ == "pending":
            resume[f"{direction_}_pending"] += row["total"]

    resume["net_confirmed"] = resume["in_confirmed"] - resume["out_confirmed"]
    return {"flows": flows, "summary": {k: round(v, 0) if isinstance(v, float) else v
                                        for k, v in resume.items()}}

@api_router.put("/admin/cash-flows/{flow_id}")
async def update_cash_flow(flow_id: str, update: CashFlowUpdate, admin: dict = Depends(require_admin)):
    data = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update")

    for field, allowed in (("status", CASH_FLOW_STATUSES), ("category", CASH_FLOW_CATEGORIES)):
        if field in data and data[field] not in allowed:
            raise HTTPException(status_code=400, detail=f"{field} must be one of: {', '.join(allowed)}")

    if isinstance(data.get("occurred_at"), datetime):
        data["occurred_at"] = data["occurred_at"].isoformat()

    result = await db.cash_flows.update_one({"flow_id": flow_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cash flow not found")
    return await db.cash_flows.find_one({"flow_id": flow_id}, {"_id": 0})

@api_router.delete("/admin/cash-flows/{flow_id}")
async def delete_cash_flow(flow_id: str, admin: dict = Depends(require_admin)):
    """Supprime un mouvement saisi par erreur. Les flux issus d'un paiement
    reel (Stripe/Tara) devraient plutot etre passes en 'failed' pour garder
    la trace de ce qui s'est passe."""
    result = await db.cash_flows.delete_one({"flow_id": flow_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cash flow not found")
    return {"message": "Cash flow deleted"}

@api_router.get("/admin/payment-attempts")
async def list_payment_attempts(status: Optional[str] = None, payment_method: Optional[str] = None,
                                groupage_id: Optional[str] = None, limit: int = 200,
                                admin: dict = Depends(require_admin)):
    """Toute tentative de paiement Tara, aboutie ou non : qui, par quel moyen,
    quand, et d'ou (best-effort, resolu en arriere-plan a partir de l'IP).

    Indispensable des que le volume grossit - une transaction confirmee ne
    raconte pas les echecs et abandons, qui sont pourtant le signal le plus
    utile pour reperer un probleme (numero mal saisi, operateur en panne,
    tentative frauduleuse).
    """
    query: Dict[str, Any] = {"provider": "tara"}
    if status:
        query["status"] = status
    if payment_method:
        query["payment_method"] = payment_method
    if groupage_id:
        query["groupage_id"] = groupage_id

    attempts = await db.payment_transactions.find(query, {"_id": 0}) \
        .sort("created_at", -1).limit(min(limit, 500)).to_list(500)

    user_ids = {a["user_id"] for a in attempts if a.get("user_id")}
    users = await db.users.find({"user_id": {"$in": list(user_ids)}}, {"_id": 0, "user_id": 1, "name": 1}) \
        .to_list(len(user_ids) or 1)
    noms = {u["user_id"]: u["name"] for u in users}
    for a in attempts:
        a["user_name"] = noms.get(a.get("user_id"))

    return attempts

@api_router.get("/admin/treasury/summary")
async def treasury_summary(date_from: Optional[str] = None, date_to: Optional[str] = None,
                           admin: dict = Depends(require_admin)):
    """Vue d'ensemble : soldes par compte, ventilation par categorie, et serie
    mensuelle des entrees/sorties."""
    base = _cash_flow_query(date_from=date_from, date_to=date_to)

    async def group_by(field: str):
        rows = await db.cash_flows.aggregate([
            {"$match": {**base, "status": "confirmed"}},
            {"$group": {"_id": {"key": f"${field}", "direction": "$direction"},
                        "total": {"$sum": "$amount_fcfa"}, "count": {"$sum": 1}}}
        ]).to_list(200)
        out = {}
        for r in rows:
            key = r["_id"]["key"] or "—"
            entry = out.setdefault(key, {"in": 0.0, "out": 0.0, "count": 0})
            entry[r["_id"]["direction"]] += r["total"]
            entry["count"] += r["count"]
        for entry in out.values():
            entry["net"] = round(entry["in"] - entry["out"], 0)
            entry["in"] = round(entry["in"], 0)
            entry["out"] = round(entry["out"], 0)
        return out

    par_compte = await group_by("account")
    par_categorie = await group_by("category")

    # Serie mensuelle : occurred_at est une chaine ISO, les 7 premiers
    # caracteres donnent directement "AAAA-MM".
    mensuel_rows = await db.cash_flows.aggregate([
        {"$match": {**base, "status": "confirmed"}},
        {"$group": {"_id": {"mois": {"$substr": ["$occurred_at", 0, 7]}, "direction": "$direction"},
                    "total": {"$sum": "$amount_fcfa"}}},
        {"$sort": {"_id.mois": 1}}
    ]).to_list(200)
    mensuel = {}
    for r in mensuel_rows:
        mois = mensuel.setdefault(r["_id"]["mois"], {"month": r["_id"]["mois"], "in": 0.0, "out": 0.0})
        mois[r["_id"]["direction"]] += r["total"]
    serie = []
    for mois in sorted(mensuel.values(), key=lambda m: m["month"]):
        mois["in"], mois["out"] = round(mois["in"], 0), round(mois["out"], 0)
        mois["net"] = round(mois["in"] - mois["out"], 0)
        serie.append(mois)

    en_attente = await db.cash_flows.aggregate([
        {"$match": {**base, "status": "pending"}},
        {"$group": {"_id": "$direction", "total": {"$sum": "$amount_fcfa"}, "count": {"$sum": 1}}}
    ]).to_list(10)

    return {
        "by_account": par_compte,
        "by_category": par_categorie,
        "monthly": serie,
        "pending": {r["_id"]: {"total": round(r["total"], 0), "count": r["count"]} for r in en_attente},
    }

@api_router.get("/admin/treasury/groupages")
async def treasury_by_groupage(admin: dict = Depends(require_admin)):
    """Position financiere de chaque groupage : ce qui est entre, ce qui est
    sorti, et ce qui dort encore en caisse.

    L'argent 'dormant' est la difference entre ce que les membres ont verse et
    ce qui a effectivement ete depense pour eux (fournisseur, transitaire,
    douane). C'est le montant dont on est comptable tant que la marchandise
    n'est pas livree.
    """
    rows = await db.cash_flows.aggregate([
        {"$match": {"status": "confirmed", "groupage_id": {"$ne": None}}},
        {"$group": {"_id": {"groupage_id": "$groupage_id", "category": "$category"},
                    "total": {"$sum": "$amount_fcfa"}}}
    ]).to_list(1000)

    par_groupage = {}
    for r in rows:
        gid = r["_id"]["groupage_id"]
        par_groupage.setdefault(gid, {})[r["_id"]["category"]] = round(r["total"], 0)

    groupages = await db.groupages.find(
        {"groupage_id": {"$in": list(par_groupage.keys())}} if par_groupage else {},
        {"_id": 0, "groupage_id": 1, "reference": 1, "title": 1, "status": 1,
         "shipment_status": 1, "current_members": 1}
    ).to_list(500)

    resultat = []
    for g in groupages:
        cats = par_groupage.get(g["groupage_id"], {})
        encaisse = cats.get("member_payment", 0)
        rembourse = cats.get("refund", 0)
        fournisseur = cats.get("supplier_payment", 0)
        transitaire = cats.get("freight_payment", 0)
        douane = cats.get("customs_duty", 0)
        depense = fournisseur + transitaire + douane + rembourse
        resultat.append({
            **g,
            "collected_fcfa": encaisse,
            "refunded_fcfa": rembourse,
            "supplier_paid_fcfa": fournisseur,
            "freight_paid_fcfa": transitaire,
            "customs_paid_fcfa": douane,
            "spent_fcfa": depense,
            # Positif : de l'argent encaisse pas encore depense (il dort).
            # Negatif : on a avance de l'argent qui n'est pas encore couvert.
            "idle_fcfa": round(encaisse - depense, 0),
        })

    resultat.sort(key=lambda r: r["idle_fcfa"], reverse=True)
    return resultat

@api_router.get("/admin/treasury/members")
async def treasury_by_member(groupage_id: Optional[str] = None, admin: dict = Depends(require_admin)):
    """Ce que chaque client a verse, et ce qu'il lui reste a payer.

    Le du provient de l'adhesion au groupage (total_price_fcfa), le verse du
    registre : l'ecart est ce qu'on doit encore lui reclamer.
    """
    query = {"groupage_id": groupage_id} if groupage_id else {}
    memberships = await db.groupage_members.find(query, {"_id": 0}).to_list(1000)
    if not memberships:
        return []

    paid_rows = await db.cash_flows.aggregate([
        {"$match": {"status": "confirmed", "category": {"$in": ["member_payment", "refund"]},
                    **({"groupage_id": groupage_id} if groupage_id else {})}},
        {"$group": {"_id": {"user_id": "$user_id", "groupage_id": "$groupage_id",
                            "direction": "$direction"},
                    "total": {"$sum": "$amount_fcfa"}}}
    ]).to_list(2000)

    verse = {}
    for r in paid_rows:
        key = (r["_id"]["user_id"], r["_id"]["groupage_id"])
        signe = 1 if r["_id"]["direction"] == "in" else -1
        verse[key] = verse.get(key, 0) + signe * r["total"]

    user_ids = list({m["user_id"] for m in memberships})
    users = await db.users.find({"user_id": {"$in": user_ids}},
                                {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1}).to_list(1000)
    par_user = {u["user_id"]: u for u in users}

    groupage_ids = list({m["groupage_id"] for m in memberships})
    groupages = await db.groupages.find({"groupage_id": {"$in": groupage_ids}},
                                        {"_id": 0, "groupage_id": 1, "reference": 1, "title": 1}).to_list(500)
    par_groupage = {g["groupage_id"]: g for g in groupages}

    lignes = []
    for m in memberships:
        du = float(m.get("total_price_fcfa") or 0)
        paye = round(verse.get((m["user_id"], m["groupage_id"]), 0), 0)
        u = par_user.get(m["user_id"], {})
        g = par_groupage.get(m["groupage_id"], {})
        lignes.append({
            "user_id": m["user_id"],
            "name": u.get("name"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "groupage_id": m["groupage_id"],
            "reference": g.get("reference"),
            "groupage_title": g.get("title"),
            "quantity": m.get("quantity"),
            "due_fcfa": round(du, 0),
            "paid_fcfa": paye,
            "outstanding_fcfa": round(du - paye, 0),
        })

    lignes.sort(key=lambda r: r["outstanding_fcfa"], reverse=True)
    return lignes

@api_router.get("/admin/users")
async def admin_list_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    kyc_status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    admin: dict = Depends(require_admin)
):
    """Liste paginee de tous les utilisateurs, avec recherche (nom, email,
    telephone, ville) et filtres par role / statut KYC."""
    query = {}
    if search:
        regex = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"name": regex}, {"email": regex}, {"phone": regex}, {"location": regex}]
    if role:
        query["role"] = role
    if kyc_status:
        query["kyc_status"] = kyc_status

    limit = max(1, min(limit, 100))
    total = await db.users.count_documents(query)
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}) \
        .sort("created_at", -1).skip(max(0, skip)).limit(limit).to_list(limit)
    return {"total": total, "users": users}

@api_router.get("/admin/users/{user_id}/details")
async def admin_user_details(user_id: str, admin: dict = Depends(require_admin)):
    """Vue 360 d'un utilisateur : profil complet, adhesions aux groupages avec
    paiements, propositions de produits, avis laisses, activite chat."""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Adhesions + infos du groupage correspondant
    memberships = await db.groupage_members.find({"user_id": user_id}, {"_id": 0}).sort("joined_at", -1).to_list(200)
    groupage_ids = [m["groupage_id"] for m in memberships]
    groupages = await db.groupages.find(
        {"groupage_id": {"$in": groupage_ids}},
        {"_id": 0, "groupage_id": 1, "title": 1, "status": 1, "shipment_status": 1, "deadline": 1}
    ).to_list(200)
    groupage_map = {g["groupage_id"]: g for g in groupages}
    for m in memberships:
        m["groupage"] = groupage_map.get(m["groupage_id"])

    # Paiements
    payments = await db.payment_transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)

    # Propositions creees ou soutenues
    proposals = await db.product_proposals.find(
        {"$or": [{"user_id": user_id}, {"interested_user_ids": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for p in proposals:
        p["is_creator"] = p.get("user_id") == user_id

    # Avis laisses
    reviews = await db.groupage_reviews.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in reviews:
        g = groupage_map.get(r["groupage_id"])
        if not g:
            g = await db.groupages.find_one({"groupage_id": r["groupage_id"]}, {"_id": 0, "title": 1})
        r["groupage_title"] = (g or {}).get("title")

    # Activite chat (volume seulement)
    message_count = await db.messages.count_documents({"user_id": user_id})

    return {
        "user": user,
        "memberships": memberships,
        "payments": payments,
        "proposals": proposals,
        "reviews": reviews,
        "message_count": message_count
    }

@api_router.get("/admin/kyc/queue")
async def get_kyc_queue(user: dict = Depends(require_admin)):
    # Inclut aussi les utilisateurs "pending" (pas encore de documents soumis) pour
    # permettre une validation manuelle rapide en phase pilote, sans exiger l'upload.
    users = await db.users.find(
        {"kyc_status": {"$in": ["submitted", "pending"]}},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    return users

@api_router.put("/admin/kyc/{user_id}")
async def update_kyc_status(user_id: str, request: Request, admin: dict = Depends(require_admin)):
    data = await request.json()
    new_status = data.get("status")
    
    if new_status not in ["validated", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"kyc_status": new_status, "kyc_reviewed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"KYC status updated to {new_status}"}

@api_router.post("/admin/groupages")
async def create_groupage(groupage_data: GroupageCreate, user: dict = Depends(require_admin)):
    """Créer un groupage - Documents fournisseur obligatoires"""
    
    # Vérifier que les documents fournisseur sont fournis
    if not groupage_data.supplier_documents.business_license_url:
        raise HTTPException(status_code=400, detail="Supplier business license is required")
    
    # Récupérer le transitaire sélectionné
    transitaire = await db.transitaires.find_one({"transitaire_id": groupage_data.transitaire_id}, {"_id": 0})
    if not transitaire:
        raise HTTPException(status_code=400, detail="Transitaire not found")

    if not transitaire.get("is_active", True):
        raise HTTPException(status_code=400, detail="Transitaire is not active")

    transport = resolve_transport(
        transitaire,
        groupage_data.shipping_option_id,
        groupage_data.unit_weight_kg,
        groupage_data.unit_volume_cbm
    )
    shipping_option = transport["option"]

    # Fournisseur lie (facultatif) : verifie qu'il existe si fourni
    if groupage_data.supplier_id:
        supplier = await db.suppliers.find_one({"supplier_id": groupage_data.supplier_id})
        if not supplier:
            raise HTTPException(status_code=400, detail="Supplier not found")

    groupage_id = f"grp_{uuid.uuid4().hex[:12]}"

    groupage_doc = {
        "groupage_id": groupage_id,
        # Reference courte affichee partout : distingue deux groupages portant
        # sur le meme produit. Attribuee une fois, jamais modifiee ensuite.
        "reference": await next_groupage_reference(),
        "title": groupage_data.title,
        "title_en": groupage_data.title_en,
        "description": groupage_data.description,
        "description_en": groupage_data.description_en,
        "product_category_id": groupage_data.product_category_id,
        "product_url": groupage_data.product_url,
        "product_image_url": groupage_data.product_image_url,
        "supplier_id": groupage_data.supplier_id,
        "supplier_name": groupage_data.supplier_name,
        "supplier_location": groupage_data.supplier_location,
        "supplier_rating": groupage_data.supplier_rating,
        "supplier_gold_status": groupage_data.supplier_gold_status,
        "supplier_trade_assurance": groupage_data.supplier_trade_assurance,
        "supplier_documents": groupage_data.supplier_documents.model_dump(),
        "supplier_documents_validated": True,
        # Transitaire info from database
        "transitaire_id": transitaire["transitaire_id"],
        "transitaire_name": transitaire["name"],
        "transitaire_location": f"{transitaire['city']}, {transitaire['country']}",
        "transitaire_license": transitaire["license_number"],
        **transport["fields"],
        # Statut du transitaire sur ce groupage : "recommended" tant que la commande
        # n'est pas validee, puis "confirmed" ("Votre transitaire") une fois tout OK.
        "transitaire_status": "recommended",
        # Villes de retrait possibles, figees a la creation (snapshot des villes de
        # desserte du transitaire) : chaque membre en choisit une en rejoignant.
        "pickup_cities": transitaire.get("service_cities") or [],
        # Suivi d'expedition
        "shipment_status": "preparation",
        "shipment_timeline": [],
        # Pricing direct en FCFA (hors transport)
        "wholesale_unit_price_fcfa": groupage_data.wholesale_unit_price_fcfa,
        "member_unit_price_fcfa": groupage_data.member_unit_price_fcfa,
        "solo_unit_price_fcfa": groupage_data.solo_unit_price_fcfa,
        "service_fee_percent": groupage_data.service_fee_percent,
        "caution_fcfa": groupage_data.caution_fcfa,
        # Pricing historique en CNY (repli)
        "unit_price_cny": groupage_data.unit_price_cny,
        "solo_unit_price_cny": groupage_data.solo_unit_price_cny,
        "unit_weight_kg": groupage_data.unit_weight_kg,
        "unit_volume_cbm": groupage_data.unit_volume_cbm,
        "total_quantity": groupage_data.total_quantity,
        "total_order_price_cny": groupage_data.total_order_price_cny,
        "internal_cost_cny": groupage_data.internal_cost_cny,
        "min_members": groupage_data.min_members,
        "max_members": groupage_data.max_members,
        "current_members": 0,
        "current_quantity_reserved": 0,
        "deadline": groupage_data.deadline.isoformat(),
        "estimated_arrival": groupage_data.estimated_arrival.isoformat(),
        "local_price_fcfa": groupage_data.local_price_fcfa,
        "suggested_resale_price_fcfa": groupage_data.suggested_resale_price_fcfa,
        "logistics_documents": [],
        "status": "open",
        "is_featured": False,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.groupages.insert_one(groupage_doc)
    
    created = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0})
    for field in ["created_at", "deadline", "estimated_arrival"]:
        if isinstance(created.get(field), str):
            created[field] = datetime.fromisoformat(created[field])
    
    return created

@api_router.put("/admin/groupages/{groupage_id}")
async def update_groupage(groupage_id: str, request: Request, user: dict = Depends(require_admin)):
    """Edition complete d'un groupage. Si le transitaire ou l'option de transport
    change, les infos snapshotees (nom, tarif, villes de retrait) sont resolues a
    nouveau pour que les calculs de prix restent coherents."""
    groupage = await db.groupages.find_one({"groupage_id": groupage_id})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    data = await request.json()
    allowed_fields = ["title", "title_en", "description", "description_en", "status", "product_image_url",
                      "is_featured", "suggested_resale_price_fcfa", "transitaire_status", "product_url",
                      "wholesale_unit_price_fcfa", "member_unit_price_fcfa", "solo_unit_price_fcfa",
                      "service_fee_percent", "caution_fcfa",
                      "unit_price_cny", "solo_unit_price_cny", "unit_weight_kg", "unit_volume_cbm",
                      "total_quantity", "total_order_price_cny", "internal_cost_cny",
                      "min_members", "max_members",
                      "deadline", "estimated_arrival", "local_price_fcfa"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if "transitaire_status" in update_data and update_data["transitaire_status"] not in ("recommended", "confirmed"):
        raise HTTPException(status_code=400, detail="transitaire_status must be 'recommended' or 'confirmed'")

    # Cette route ne passe pas par un modele Pydantic : la borne des frais de
    # service doit donc etre verifiee explicitement ici.
    if update_data.get("service_fee_percent") is not None:
        try:
            percent = float(update_data["service_fee_percent"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="service_fee_percent must be a number")
        if not (0 <= percent <= MAX_SERVICE_FEE_PERCENT):
            raise HTTPException(
                status_code=400,
                detail=f"service_fee_percent must be between 0 and {MAX_SERVICE_FEE_PERCENT}"
            )
        update_data["service_fee_percent"] = percent

    # La quantite cible ne peut pas descendre sous ce qui est deja reserve
    if "total_quantity" in update_data:
        reserved = groupage.get("current_quantity_reserved", 0)
        if int(update_data["total_quantity"]) < reserved:
            raise HTTPException(
                status_code=400,
                detail=f"Quantite cible trop basse : {reserved} unites sont deja reservees par les membres."
            )

    # Changement de transitaire et/ou d'option de transport : re-resolution complete
    new_transitaire_id = data.get("transitaire_id")
    new_option_id = data.get("shipping_option_id")
    if new_transitaire_id or new_option_id:
        transitaire_id = new_transitaire_id or groupage["transitaire_id"]
        transitaire = await db.transitaires.find_one({"transitaire_id": transitaire_id}, {"_id": 0})
        if not transitaire:
            raise HTTPException(status_code=400, detail="Transitaire not found")
        if not transitaire.get("is_active", True):
            raise HTTPException(status_code=400, detail="Transitaire is not active")

        unit_weight_kg = update_data.get("unit_weight_kg", groupage.get("unit_weight_kg"))
        unit_volume_cbm = update_data.get("unit_volume_cbm", groupage.get("unit_volume_cbm"))
        transport = resolve_transport(transitaire, new_option_id, unit_weight_kg, unit_volume_cbm)

        update_data.update({
            "transitaire_id": transitaire["transitaire_id"],
            "transitaire_name": transitaire["name"],
            "transitaire_location": f"{transitaire['city']}, {transitaire['country']}",
            "transitaire_license": transitaire["license_number"],
            "pickup_cities": transitaire.get("service_cities") or [],
            **transport["fields"],
        })

    if update_data:
        await db.groupages.update_one({"groupage_id": groupage_id}, {"$set": update_data})

    updated = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0})
    return updated

@api_router.get("/admin/groupages/{groupage_id}/pickup-summary")
async def pickup_summary(groupage_id: str, user: dict = Depends(require_admin)):
    """Repartition des membres par ville de retrait — sert a organiser le split
    de la commande groupee avec le transitaire."""
    members = await db.groupage_members.find({"groupage_id": groupage_id}, {"_id": 0}).to_list(500)
    summary = {}
    for m in members:
        city = m.get("pickup_city") or "Non renseignee"
        if city not in summary:
            summary[city] = {"members": 0, "quantity": 0}
        summary[city]["members"] += 1
        summary[city]["quantity"] += m.get("quantity", 0)
    return {"groupage_id": groupage_id, "by_city": summary}

@api_router.post("/admin/groupages/{groupage_id}/logistics-docs")
async def add_logistics_document(groupage_id: str, doc: LogisticsDocument, user: dict = Depends(require_admin)):
    """Ajouter un document logistique (BL, Packing List, etc.)"""
    doc_data = doc.model_dump()
    doc_data["uploaded_at"] = datetime.now(timezone.utc).isoformat()
    doc_data["uploaded_by"] = user["user_id"]

    await db.groupages.update_one(
        {"groupage_id": groupage_id},
        {"$push": {"logistics_documents": doc_data}}
    )

    return {"message": "Document added"}

@api_router.put("/admin/groupages/{groupage_id}/phase")
async def admin_update_shipment_phase(groupage_id: str, update: PhaseUpdate,
                                      user: dict = Depends(require_admin)):
    """L'admin fait avancer la phase d'expedition de n'importe quel groupage.

    Le transitaire dispose de la meme possibilite sur SES groupages
    (/partner/groupages/{id}/phase) ; l'admin n'est pas limite par cette
    appartenance, mais l'historique enregistre qui a fait la mise a jour.
    """
    if update.phase not in SHIPMENT_PHASES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phase. Must be one of: {', '.join(SHIPMENT_PHASES)}"
        )

    groupage = await db.groupages.find_one({"groupage_id": groupage_id})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")

    timeline_entry = {
        "phase": update.phase,
        "note": update.note,
        "updated_by": user["user_id"],
        "updated_by_name": user.get("name", "Admin"),
        "updated_by_role": "admin",
        "at": datetime.now(timezone.utc).isoformat()
    }
    await db.groupages.update_one(
        {"groupage_id": groupage_id},
        {"$set": {"shipment_status": update.phase}, "$push": {"shipment_timeline": timeline_entry}}
    )
    return {"message": "Phase updated", "shipment_status": update.phase, "timeline_entry": timeline_entry}

@api_router.delete("/admin/groupages/{groupage_id}/documents")
async def admin_delete_logistics_document(groupage_id: str, url: str,
                                          user: dict = Depends(require_admin)):
    """Retire un document logistique, identifie par son URL.

    Necessaire pour corriger un mauvais envoi : sans cela un document errone
    resterait visible des membres pour toujours.
    """
    result = await db.groupages.update_one(
        {"groupage_id": groupage_id},
        {"$pull": {"logistics_documents": {"url": url}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Groupage not found")
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found on this groupage")
    return {"message": "Document removed"}

@api_router.get("/admin/warnings")
async def get_warnings(user: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    warnings = []
    
    groupages = await db.groupages.find({"status": "open"}, {"_id": 0}).to_list(100)
    
    for g in groupages:
        deadline = datetime.fromisoformat(g["deadline"]) if isinstance(g["deadline"], str) else g["deadline"]
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        
        days_left = (deadline - now).days
        
        if days_left <= 3 and g["current_members"] < g["min_members"]:
            warnings.append({
                "type": "low_members",
                "severity": "high" if days_left <= 1 else "medium",
                "groupage_id": g["groupage_id"],
                "title": g["title"],
                "message": f"Only {g['current_members']}/{g['min_members']} members with {days_left} days left"
            })
    
    pending_kyc = await db.users.count_documents({"kyc_status": "submitted"})
    if pending_kyc > 0:
        warnings.append({
            "type": "pending_kyc",
            "severity": "medium",
            "message": f"{pending_kyc} KYC reviews pending"
        })
    
    pending_proposals = await db.product_proposals.count_documents({"status": "pending"})
    if pending_proposals > 0:
        warnings.append({
            "type": "pending_proposals",
            "severity": "low",
            "message": f"{pending_proposals} product proposals pending review"
        })
    
    return warnings

# ========================
# SOCKET.IO EVENTS
# ========================

@sio.event
async def connect(sid, environ, auth):
    """Authentifie la connexion websocket via le token JWT envoye par le client
    (auth={token}). Sans token valide, la connexion est refusee : evite qu'un
    tiers non authentifie puisse rejoindre un salon ou usurper une identite."""
    token = (auth or {}).get("token")
    if not token:
        raise ConnectionRefusedError("authentication required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise ConnectionRefusedError("user not found")
    except jwt.PyJWTError:
        raise ConnectionRefusedError("invalid token")
    
    sio_user_sessions[sid] = {"user_id": user["user_id"], "user_name": user["name"]}
    logger.info(f"Client connected: {sid} (user {user['user_id']})")

@sio.event
async def disconnect(sid):
    sio_user_sessions.pop(sid, None)
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_room(sid, data):
    session = sio_user_sessions.get(sid)
    room_id = data.get("room_id")
    if not room_id or not session:
        return
    
    # Verifie que l'utilisateur est bien membre de ce groupage avant de le laisser
    # rejoindre le salon de discussion correspondant.
    membership = await db.groupage_members.find_one({
        "groupage_id": room_id,
        "user_id": session["user_id"]
    })
    if not membership:
        logger.warning(f"User {session['user_id']} tried to join chat room {room_id} without membership")
        return
    
    await sio.enter_room(sid, room_id)
    logger.info(f"Client {sid} joined room {room_id}")

@sio.event
async def send_message(sid, data):
    session = sio_user_sessions.get(sid)
    room_id = data.get("room_id")
    content = data.get("content")
    
    if not room_id or not content or not session:
        return
    
    # user_id / user_name proviennent de la session authentifiee, jamais des
    # donnees envoyees par le client, pour empecher toute usurpation d'identite.
    message_doc = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "groupage_id": room_id,
        "user_id": session["user_id"],
        "user_name": session["user_name"],
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message_doc)
    
    broadcast_data = {k: v for k, v in message_doc.items() if k != "_id"}
    await sio.emit("new_message", broadcast_data, room=room_id)

# ========================
# CONTENU EDITORIAL (FAQ + guides) — gere depuis l'espace admin
# ========================
#
# Le contenu est stocke en base et sert deux usages :
#   1. l'affichage dans l'application React (pages /faq et /guides/<slug>) ;
#   2. le prerendu au moment du build, qui interroge les routes publiques
#      ci-dessous pour ecrire des pages HTML statiques lisibles par les robots
#      qui n'executent pas JavaScript (assistants IA, apercus WhatsApp).
#
# Publier depuis l'admin ne suffit donc pas a rendre une page visible des
# robots : il faut un nouveau build. La route /admin/content/rebuild declenche
# ce build via le hook de deploiement Vercel (VERCEL_DEPLOY_HOOK_URL).

CONTENT_TYPES = ("faq", "guide")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

class ContentCreate(BaseModel):
    type: str
    slug: str
    title: str
    meta_description: str = ""
    # Champs FAQ
    question: Optional[str] = None
    answer: Optional[str] = None
    # Champs guide (corps en markdown simplifie : ##, -, **gras**)
    body: Optional[str] = None
    cluster: Optional[str] = None
    published: bool = False
    order: int = 0

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in CONTENT_TYPES:
            raise ValueError(f"type must be one of: {', '.join(CONTENT_TYPES)}")
        return v

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not SLUG_RE.match(v):
            raise ValueError(
                "Le slug ne peut contenir que des minuscules, des chiffres et des tirets "
                "(ex: fret-aerien-chine-cameroun)"
            )
        return v

def _public_content(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in ("_id", "created_by")}

@api_router.get("/content")
async def list_content(type: Optional[str] = None):
    """Contenu publie, accessible publiquement (alimente la FAQ, les guides
    et le prerendu au build)."""
    query = {"published": True}
    if type:
        if type not in CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Invalid content type")
        query["type"] = type
    entries = await db.content_entries.find(query, {"_id": 0, "created_by": 0}) \
        .sort([("order", 1), ("created_at", 1)]).to_list(500)
    return entries

@api_router.get("/content/{slug}")
async def get_content(slug: str):
    entry = await db.content_entries.find_one(
        {"slug": slug, "published": True}, {"_id": 0, "created_by": 0}
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Content not found")
    return entry

@api_router.get("/admin/content")
async def admin_list_content(type: Optional[str] = None, admin: dict = Depends(require_admin)):
    """Tout le contenu, brouillons inclus."""
    query = {}
    if type:
        query["type"] = type
    entries = await db.content_entries.find(query, {"_id": 0}) \
        .sort([("type", 1), ("order", 1), ("created_at", 1)]).to_list(500)
    return entries

@api_router.post("/admin/content")
async def create_content(entry: ContentCreate, admin: dict = Depends(require_admin)):
    existing = await db.content_entries.find_one({"slug": entry.slug})
    if existing:
        raise HTTPException(status_code=400, detail=f"Le slug « {entry.slug} » est déjà utilisé")

    doc = {
        "content_id": f"cnt_{uuid.uuid4().hex[:12]}",
        **entry.model_dump(),
        "created_by": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.content_entries.insert_one(doc)
    return _public_content(doc)

@api_router.put("/admin/content/{content_id}")
async def update_content(content_id: str, request: Request, admin: dict = Depends(require_admin)):
    existing = await db.content_entries.find_one({"content_id": content_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Content not found")

    data = await request.json()
    allowed = ["title", "meta_description", "question", "answer", "body",
               "cluster", "published", "order", "slug"]
    update_data = {k: v for k, v in data.items() if k in allowed}

    if "slug" in update_data:
        slug = str(update_data["slug"]).strip().lower()
        if not SLUG_RE.match(slug):
            raise HTTPException(status_code=400, detail="Slug invalide (minuscules, chiffres, tirets)")
        clash = await db.content_entries.find_one({"slug": slug, "content_id": {"$ne": content_id}})
        if clash:
            raise HTTPException(status_code=400, detail=f"Le slug « {slug} » est déjà utilisé")
        update_data["slug"] = slug

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.content_entries.update_one({"content_id": content_id}, {"$set": update_data})
    updated = await db.content_entries.find_one({"content_id": content_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/content/{content_id}")
async def delete_content(content_id: str, admin: dict = Depends(require_admin)):
    result = await db.content_entries.delete_one({"content_id": content_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"message": "Content deleted"}

@api_router.post("/admin/content/rebuild")
async def rebuild_site(admin: dict = Depends(require_admin)):
    """Declenche un nouveau build du frontend pour que le contenu publie soit
    integre aux pages statiques (et donc visible des robots sans JavaScript)."""
    hook = os.environ.get("VERCEL_DEPLOY_HOOK_URL", "").strip()
    if not hook:
        raise HTTPException(
            status_code=503,
            detail="VERCEL_DEPLOY_HOOK_URL n'est pas configuré. Ajoutez cette variable "
                   "sur Railway (Vercel > Settings > Git > Deploy Hooks) pour publier "
                   "sans passer par un déploiement manuel."
        )
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(hook, timeout=20)
        if response.status_code >= 400:
            logger.error(f"Deploy hook error {response.status_code}: {response.text[:200]}")
            raise HTTPException(status_code=502, detail="Le déclenchement du build a échoué")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deploy hook failed: {e}")
        raise HTTPException(status_code=502, detail="Le déclenchement du build a échoué")

    return {"message": "Build lancé. Les pages statiques seront à jour dans 2 à 3 minutes."}

# ========================
# ROOT ROUTE
# ========================

@api_router.get("/")
async def root():
    return {"message": "SilkRoute API v1.1", "status": "running"}

@api_router.get("/health")
async def health():
    """Etat du service et de ses dependances. Permet de distinguer une
    application morte (aucune reponse) d'une base injoignable (reponse 503)."""
    checks = {}
    healthy = True

    started = time.time()
    try:
        await client.admin.command("ping")
        checks["database"] = {"status": "ok", "latency_ms": round((time.time() - started) * 1000)}
    except Exception as e:
        healthy = False
        checks["database"] = {"status": "error", "detail": str(e)[:200]}

    checks["config"] = {
        "cors_origins": len(CORS_ORIGINS),
        "jwt_secret": bool(JWT_SECRET),
        "resend": bool(os.environ.get("RESEND_API_KEY")),
        "cloudinary": bool(os.environ.get("CLOUDINARY_API_SECRET")),
        "deploy_hook": bool(os.environ.get("VERCEL_DEPLOY_HOOK_URL")),
        # Diagnostic sans faire de vrai paiement : juste "la variable est vue
        # par ce processus", jamais sa valeur.
        "tara_api_key": bool(TARA_API_KEY),
        "tara_business_id": bool(TARA_BUSINESS_ID),
        "tara_webhook_secret": bool(TARA_WEBHOOK_SECRET),
    }
    checks["websocket_sessions"] = len(sio_user_sessions)

    payload = {"status": "healthy" if healthy else "degraded", "checks": checks}
    return JSONResponse(status_code=200 if healthy else 503, content=payload)

fastapi_app.include_router(api_router)

_cors_origins_env = os.environ.get('CORS_ORIGINS', '')
# .rstrip('/') : le header Origin du navigateur n'a jamais de slash final, donc on
# normalise pour eviter qu'un "https://site.app/" colle dans la config casse le CORS.
CORS_ORIGINS = [o.strip().rstrip('/') for o in _cors_origins_env.split(',') if o.strip()]
if not CORS_ORIGINS:
    logger.warning(
        "CORS_ORIGINS is not set - no cross-origin browser requests will be allowed. "
        "Set it to your frontend URL(s), comma-separated."
    )

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@fastapi_app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

socket_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path='/api/socket.io')
app = socket_app

@fastapi_app.on_event("startup")
async def assign_missing_references():
    """Attribue une reference SR-xxxx aux groupages anterieurs a ce champ.
    Idempotent : au deuxieme demarrage il n'y a plus rien a faire."""
    try:
        assigned = await backfill_groupage_references()
        if assigned:
            logger.info(f"References attribuees a {assigned} groupage(s) existant(s)")
    except Exception as exc:
        # Ne jamais empecher le demarrage pour un backfill cosmetique
        logger.warning(f"Backfill des references impossible : {exc}")

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
