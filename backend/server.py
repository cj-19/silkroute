from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Body
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
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
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
SILKROUTE_FEE_FCFA = 5000  # Frais SilkRoute fixes
MIN_GROUPAGE_TOTAL_FCFA = 25000  # Total minimum (frais de service inclus) pour pouvoir rejoindre un groupage
SOLO_FEE_USD = 5  # Frais fixes pour commande solo en USD

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
    
    # Prix et poids
    unit_price_cny: float  # Prix unitaire en CNY
    unit_weight_kg: float  # Poids unitaire en kg
    
    # Commande totale
    total_quantity: int  # Quantité totale de la commande groupée
    total_order_price_cny: float  # Prix tout compris de la commande totale
    
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

# Documents logistiques
class LogisticsDocument(BaseModel):
    doc_type: str  # "bl", "packing_list", "invoice", "customs"
    url: str
    uploaded_at: Optional[str] = None

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

def get_transport_price_per_kg_fcfa(groupage: dict) -> float:
    """Prix transport au kg en FCFA. Les nouvelles fiches transitaires stockent
    directement le prix FCFA ; les anciens groupages n'ont qu'un prix CNY, converti."""
    if groupage.get("transport_price_per_kg_fcfa") is not None:
        return groupage["transport_price_per_kg_fcfa"]
    return groupage.get("transport_price_per_kg_cny", 0) * CNY_TO_FCFA

def calculate_solo_price(unit_price_cny: float, unit_weight_kg: float, quantity: int, transport_price_per_kg_fcfa: float) -> dict:
    """
    Calcul prix SEUL: Prix unitaire + 5 USD + (poids unitaire × quantité × prix transport)
    Tout converti en FCFA
    """
    unit_price_fcfa = unit_price_cny * CNY_TO_FCFA
    total_unit_price = unit_price_fcfa * quantity

    solo_fee_fcfa = SOLO_FEE_USD * USD_TO_FCFA

    transport_cost_fcfa = unit_weight_kg * quantity * transport_price_per_kg_fcfa

    total_solo = total_unit_price + solo_fee_fcfa + transport_cost_fcfa
    price_per_unit_solo = total_solo / quantity if quantity > 0 else 0
    
    return {
        "unit_price_fcfa": round(unit_price_fcfa, 0),
        "quantity": quantity,
        "subtotal_fcfa": round(total_unit_price, 0),
        "solo_fee_fcfa": round(solo_fee_fcfa, 0),
        "transport_cost_fcfa": round(transport_cost_fcfa, 0),
        "total_fcfa": round(total_solo, 0),
        "price_per_unit_fcfa": round(price_per_unit_solo, 0)
    }

def calculate_groupage_price(total_order_price_cny: float, total_quantity: int, member_quantity: int) -> dict:
    """
    Calcul prix GROUPAGE: (Prix tout compris × % de votre part) + 5000 FCFA

    Un total minimum (MIN_GROUPAGE_TOTAL_FCFA, frais de service inclus) est requis
    pour rejoindre un groupage : en dessous, les frais fixes representent une part
    trop importante du prix et cassent l'interet du groupage.
    """
    if total_quantity <= 0:
        return {"error": "Invalid total quantity"}
    
    # Pourcentage de la commande
    share_percentage = (member_quantity / total_quantity) * 100
    
    # Prix tout compris en FCFA
    total_order_price_fcfa = total_order_price_cny * CNY_TO_FCFA
    
    # Prix unitaire (hors frais), utilise aussi pour estimer la quantite minimale
    price_per_unit_excl_fee = total_order_price_fcfa / total_quantity if total_quantity > 0 else 0
    
    # Part du membre
    member_share_fcfa = (share_percentage / 100) * total_order_price_fcfa
    
    # Total avec frais SilkRoute
    total_groupage = member_share_fcfa + SILKROUTE_FEE_FCFA
    price_per_unit_groupage = total_groupage / member_quantity if member_quantity > 0 else 0
    
    meets_minimum = total_groupage >= MIN_GROUPAGE_TOTAL_FCFA
    min_quantity_needed = None
    if not meets_minimum and price_per_unit_excl_fee > 0:
        min_quantity_needed = math.ceil((MIN_GROUPAGE_TOTAL_FCFA - SILKROUTE_FEE_FCFA) / price_per_unit_excl_fee)
    
    return {
        "share_percentage": round(share_percentage, 2),
        "total_order_price_fcfa": round(total_order_price_fcfa, 0),
        "member_share_fcfa": round(member_share_fcfa, 0),
        "silkroute_fee_fcfa": SILKROUTE_FEE_FCFA,
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
    solo = calculate_solo_price(
        groupage["unit_price_cny"],
        groupage["unit_weight_kg"],
        quantity,
        get_transport_price_per_kg_fcfa(groupage)
    )
    
    groupage_price = calculate_groupage_price(
        groupage["total_order_price_cny"],
        groupage["total_quantity"],
        quantity
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
    """Groupages assignes au partenaire connecte (par sa fiche transitaire/fournisseur)."""
    groupages = await db.groupages.find(_partner_groupage_query(user), {"_id": 0}).sort("created_at", -1).to_list(200)
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
    solo = calculate_solo_price(unit_price_cny, unit_weight_kg, quantity, transport_price_per_kg_fcfa)

    # Estimation Groupage (simulation avec un groupe de 100 personnes)
    # Le prix groupé bénéficie de:
    # 1. Négociation volume sur le prix unitaire (-10%)
    # 2. Réduction transport groupé (-40%)
    estimated_group_size = 100
    share_percentage = (quantity / estimated_group_size) * 100

    # Prix négocié en gros (10% de réduction sur le prix unitaire)
    negotiated_unit_price = unit_price_cny * 0.90

    # Transport groupé (40% moins cher), reconverti en CNY pour rester homogene
    # avec total_order_price_cny attendu par calculate_groupage_price
    discounted_transport_cny = (transport_price_per_kg_fcfa * 0.60) / CNY_TO_FCFA

    # Prix total de la commande groupée
    total_order_price_cny = (negotiated_unit_price * estimated_group_size) + (unit_weight_kg * estimated_group_size * discounted_transport_cny)
    
    groupage = calculate_groupage_price(total_order_price_cny, estimated_group_size, quantity)
    
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

@api_router.get("/groupages")
async def list_groupages(status: Optional[str] = None, category_id: Optional[str] = None, featured: bool = False, limit: int = 20):
    query = {}
    if status:
        query["status"] = status
    if category_id:
        query["product_category_id"] = category_id
    if featured:
        query["is_featured"] = True
    
    groupages = await db.groupages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for g in groupages:
        for field in ["created_at", "deadline", "estimated_arrival"]:
            if isinstance(g.get(field), str):
                g[field] = datetime.fromisoformat(g[field])
    
    return groupages

@api_router.get("/groupages/{groupage_id}")
async def get_groupage(groupage_id: str):
    groupage = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0})
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
    """Récupère les documents logistiques d'un groupage"""
    groupage = await db.groupages.find_one({"groupage_id": groupage_id}, {"_id": 0})
    if not groupage:
        raise HTTPException(status_code=404, detail="Groupage not found")
    
    # Vérifier si l'utilisateur est membre
    membership = await db.groupage_members.find_one({
        "groupage_id": groupage_id,
        "user_id": user["user_id"]
    })
    
    if not membership and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="You must be a member to view documents")
    
    return {
        "supplier_documents": groupage.get("supplier_documents", {}),
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
    
    # Vérifier la quantité disponible
    remaining_quantity = groupage["total_quantity"] - groupage.get("current_quantity_reserved", 0)
    if join_data.quantity > remaining_quantity:
        raise HTTPException(status_code=400, detail=f"Only {remaining_quantity} units available")
    
    existing = await db.groupage_members.find_one({
        "groupage_id": groupage_id,
        "user_id": user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already joined this groupage")
    
    # Calculer le prix pour ce membre
    pricing = calculate_groupage_price(
        groupage["total_order_price_cny"],
        groupage["total_quantity"],
        join_data.quantity
    )
    
    if not pricing.get("meets_minimum", True):
        raise HTTPException(
            status_code=400,
            detail=f"Total minimum de {MIN_GROUPAGE_TOTAL_FCFA} FCFA (frais de service inclus) non atteint. "
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
        "pickup_city": pickup_city,
        "pickup_accepted_at": datetime.now(timezone.utc).isoformat() if pickup_city else None,
        "caution_paid": False,
        "solde_paid": False,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.groupage_members.insert_one(member_doc)
    await db.groupages.update_one(
        {"groupage_id": groupage_id},
        {
            "$inc": {
                "current_members": 1,
                "current_quantity_reserved": join_data.quantity
            }
        }
    )
    
    return {
        "message": "Successfully joined groupage",
        "member_id": member_doc["member_id"],
        "pricing": pricing
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
    
    groupages = await db.groupages.find({"groupage_id": {"$in": groupage_ids}}, {"_id": 0}).to_list(100)
    
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
    
    membership = await db.groupage_members.find_one({
        "groupage_id": payment_data.groupage_id,
        "user_id": user["user_id"]
    })
    
    if payment_data.payment_type == "caution":
        amount = 5000.0 / 655.957  # 5000 FCFA en EUR
    else:
        if not membership:
            raise HTTPException(status_code=400, detail="You must join the groupage first")
        amount = (membership["total_price_fcfa"] - 5000) / 655.957  # Solde en EUR
    
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

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, user: dict = Depends(get_current_user)):
    status = stripe.checkout.Session.retrieve(session_id)
    
    if status.payment_status == "paid":
        payment = await db.payment_transactions.find_one({"session_id": session_id})
        if payment and payment["status"] != "completed":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            if payment["payment_type"] == "caution":
                await db.groupage_members.update_one(
                    {"user_id": payment["user_id"], "groupage_id": payment["groupage_id"]},
                    {"$set": {"caution_paid": True}}
                )
            else:
                await db.groupage_members.update_one(
                    {"user_id": payment["user_id"], "groupage_id": payment["groupage_id"]},
                    {"$set": {"solde_paid": True}}
                )
    
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
            payment = await db.payment_transactions.find_one({"session_id": session_id})
            if payment and payment["status"] != "completed":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
                )
                if payment["payment_type"] == "caution":
                    await db.groupage_members.update_one(
                        {"user_id": payment["user_id"], "groupage_id": payment["groupage_id"]},
                        {"$set": {"caution_paid": True}}
                    )
                else:
                    await db.groupage_members.update_one(
                        {"user_id": payment["user_id"], "groupage_id": payment["groupage_id"]},
                        {"$set": {"solde_paid": True}}
                    )

    return {"received": True}

# ========================
# ADMIN ROUTES
# ========================

async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

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

    # Resoudre le prix transport au kg (FCFA) : soit via l'option choisie sur les
    # nouvelles fiches, soit via l'ancien champ CNY des fiches historiques.
    transport_price_per_kg_fcfa = None
    shipping_option = None
    options = transitaire.get("shipping_options") or []
    if groupage_data.shipping_option_id:
        shipping_option = next((o for o in options if o.get("option_id") == groupage_data.shipping_option_id), None)
        if not shipping_option:
            raise HTTPException(status_code=400, detail="Shipping option not found for this transitaire")
        if shipping_option.get("unit") != "kg":
            raise HTTPException(
                status_code=400,
                detail="Le comparateur de prix necessite une option facturee au kg (les options au CBM ne sont pas encore supportees pour les groupages)"
            )
        transport_price_per_kg_fcfa = shipping_option["price_fcfa"]
    elif transitaire.get("shipping_price_per_kg_cny") is not None:
        transport_price_per_kg_fcfa = transitaire["shipping_price_per_kg_cny"] * CNY_TO_FCFA
    else:
        raise HTTPException(status_code=400, detail="Selectionnez une option de transport pour ce transitaire")

    # Fournisseur lie (facultatif) : verifie qu'il existe si fourni
    if groupage_data.supplier_id:
        supplier = await db.suppliers.find_one({"supplier_id": groupage_data.supplier_id})
        if not supplier:
            raise HTTPException(status_code=400, detail="Supplier not found")

    groupage_id = f"grp_{uuid.uuid4().hex[:12]}"

    groupage_doc = {
        "groupage_id": groupage_id,
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
        "transport_price_per_kg_fcfa": transport_price_per_kg_fcfa,
        "shipping_option_id": groupage_data.shipping_option_id,
        "shipping_option_label": shipping_option.get("label") if shipping_option else None,
        # Statut du transitaire sur ce groupage : "recommended" tant que la commande
        # n'est pas validee, puis "confirmed" ("Votre transitaire") une fois tout OK.
        "transitaire_status": "recommended",
        # Villes de retrait possibles, figees a la creation (snapshot des villes de
        # desserte du transitaire) : chaque membre en choisit une en rejoignant.
        "pickup_cities": transitaire.get("service_cities") or [],
        # Suivi d'expedition
        "shipment_status": "preparation",
        "shipment_timeline": [],
        # Pricing
        "unit_price_cny": groupage_data.unit_price_cny,
        "unit_weight_kg": groupage_data.unit_weight_kg,
        "total_quantity": groupage_data.total_quantity,
        "total_order_price_cny": groupage_data.total_order_price_cny,
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
    data = await request.json()
    allowed_fields = ["title", "title_en", "description", "description_en", "status", "product_image_url",
                      "is_featured", "suggested_resale_price_fcfa", "transitaire_status"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if "transitaire_status" in update_data and update_data["transitaire_status"] not in ("recommended", "confirmed"):
        raise HTTPException(status_code=400, detail="transitaire_status must be 'recommended' or 'confirmed'")

    if update_data:
        await db.groupages.update_one({"groupage_id": groupage_id}, {"$set": update_data})

    return {"message": "Groupage updated"}

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
# ROOT ROUTE
# ========================

@api_router.get("/")
async def root():
    return {"message": "SilkRoute API v1.1", "status": "running"}

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

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
