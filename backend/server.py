from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
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
import socketio
import cloudinary
import cloudinary.utils
import time
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

# Transitaire
class TransitaireCreate(BaseModel):
    name: str
    city: str
    country: str
    license_number: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    shipping_price_per_kg_cny: float  # Prix par kg en CNY
    estimated_days: int  # Délai estimé en jours
    is_active: bool = True

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
    supplier_name: str
    supplier_location: str
    supplier_rating: float
    supplier_gold_status: bool = False
    supplier_trade_assurance: bool = False
    supplier_documents: SupplierDocuments  # OBLIGATOIRE
    
    # Transitaire - maintenant par ID
    transitaire_id: str  # ID du transitaire sélectionné
    
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
    transport_price_per_kg_cny: float
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

def calculate_solo_price(unit_price_cny: float, unit_weight_kg: float, quantity: int, transport_price_per_kg_cny: float) -> dict:
    """
    Calcul prix SEUL: Prix unitaire + 5 USD + (poids unitaire × quantité × prix transport)
    Tout converti en FCFA
    """
    unit_price_fcfa = unit_price_cny * CNY_TO_FCFA
    total_unit_price = unit_price_fcfa * quantity
    
    solo_fee_fcfa = SOLO_FEE_USD * USD_TO_FCFA
    
    transport_cost_cny = unit_weight_kg * quantity * transport_price_per_kg_cny
    transport_cost_fcfa = transport_cost_cny * CNY_TO_FCFA
    
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
        groupage["transport_price_per_kg_cny"]
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
        "buyer_profile": user_data.buyer_profile,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)
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

@api_router.post("/admin/transitaires")
async def create_transitaire(transitaire: TransitaireCreate, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    transitaire_id = f"trans_{uuid.uuid4().hex[:8]}"
    transitaire_doc = {
        "transitaire_id": transitaire_id,
        **transitaire.model_dump(),
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transitaires.insert_one(transitaire_doc)
    return {"transitaire_id": transitaire_id, **transitaire.model_dump()}

@api_router.put("/admin/transitaires/{transitaire_id}")
async def update_transitaire(transitaire_id: str, request: Request, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await request.json()
    allowed_fields = ["name", "city", "country", "license_number", "contact_phone", "contact_email", 
                      "shipping_price_per_kg_cny", "estimated_days", "is_active"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
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
    transport_price_per_kg_cny = float(data.get("transport_price_per_kg_cny", 45))  # Default transport price
    
    if unit_price_cny <= 0 or quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid input values")
    
    # Calcul prix Solo
    solo = calculate_solo_price(unit_price_cny, unit_weight_kg, quantity, transport_price_per_kg_cny)
    
    # Estimation Groupage (simulation avec un groupe de 100 personnes)
    # Le prix groupé bénéficie de:
    # 1. Négociation volume sur le prix unitaire (-10%)
    # 2. Réduction transport groupé (-40%)
    estimated_group_size = 100
    share_percentage = (quantity / estimated_group_size) * 100
    
    # Prix négocié en gros (10% de réduction sur le prix unitaire)
    negotiated_unit_price = unit_price_cny * 0.90
    
    # Transport groupé (40% moins cher)
    discounted_transport = transport_price_per_kg_cny * 0.60
    
    # Prix total de la commande groupée
    total_order_price_cny = (negotiated_unit_price * estimated_group_size) + (unit_weight_kg * estimated_group_size * discounted_transport)
    
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
    
    member_doc = {
        "member_id": f"member_{uuid.uuid4().hex[:12]}",
        "groupage_id": groupage_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "quantity": join_data.quantity,
        "share_percentage": pricing["share_percentage"],
        "total_price_fcfa": pricing["total_fcfa"],
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
        "transport_price_per_kg_cny": transitaire["shipping_price_per_kg_cny"],
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
    allowed_fields = ["title", "title_en", "description", "description_en", "status", "product_image_url", "is_featured", "suggested_resale_price_fcfa"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_data:
        await db.groupages.update_one({"groupage_id": groupage_id}, {"$set": update_data})
    
    return {"message": "Groupage updated"}

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
CORS_ORIGINS = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
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
