"""
Script de demarrage pour peupler une base MongoDB Atlas neuve avec les donnees
minimales necessaires pour que le formulaire admin (creation de groupage) et le
site fonctionnent : categories, un transitaire, et la promotion d'un compte en admin.

Utilisation :
  1. Installe les dependances si besoin :  pip install pymongo bcrypt python-dotenv
  2. Renseigne les variables d'environnement MONGO_URL et DB_NAME (les memes que
     celles configurees sur Railway), par exemple :
       export MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net/"
       export DB_NAME="silkroute"
  3. Lance :  python seed_data.py
  4. Inscris-toi normalement sur le site avec ton vrai email, PUIS relance ce
     script une seconde fois avec --promote ton-email@exemple.com pour devenir admin.

Ce script est idempotent : le relancer plusieurs fois ne duplique pas les
categories/transitaires (il verifie leur presence avant d'inserer).
"""
import os
import sys
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL or not DB_NAME:
    print("Erreur : les variables d'environnement MONGO_URL et DB_NAME doivent etre definies.")
    sys.exit(1)

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

CATEGORIES = [
    {"name": "Electronique", "name_en": "Electronics"},
    {"name": "Textiles", "name_en": "Textiles"},
    {"name": "Beaute", "name_en": "Beauty"},
    {"name": "Menager", "name_en": "Household"},
]

# Fiche du transitaire pilote (tarifs de l'affiche TATO CARGO).
# city / country / license_number a completer avec les vraies infos administratives.
TRANSITAIRES = [
    {
        "name": "TATO CARGO",
        "city": "A completer",
        "country": "Chine",
        "license_number": "A completer",
        "contact_phone": "+86 185 8859 5637",
        "contact_email": None,
        "website": "https://www.tatocargo.com",
        # Villes ou les membres peuvent recuperer leur marchandise - A ADAPTER
        "service_cities": ["Douala", "Yaounde"],
        "shipping_options": [
            {
                "option_id": "opt_air_normal",
                "label": "Aerien normal",
                "mode": "air",
                "price_fcfa": 8997,
                "unit": "kg",
                "eta_min_days": 7,
                "eta_max_days": 15,
                "is_active": True,
            },
            {
                "option_id": "opt_air_sensible",
                "label": "Aerien sensible",
                "mode": "air",
                "price_fcfa": 9997,
                "unit": "kg",
                "eta_min_days": 15,
                "eta_max_days": 21,
                "is_active": True,
            },
            {
                "option_id": "opt_air_express",
                "label": "Aerien express",
                "mode": "air",
                "price_fcfa": 10997,
                "unit": "kg",
                "eta_min_days": 2,
                "eta_max_days": 3,
                "is_active": True,
            },
            {
                "option_id": "opt_maritime",
                "label": "Maritime",
                "mode": "sea",
                "price_fcfa": 349500,
                "unit": "cbm",
                "eta_min_days": 45,
                "eta_max_days": 60,
                "is_active": True,
            },
        ],
        "is_active": True,
    }
]


def seed_categories():
    for cat in CATEGORIES:
        existing = db.categories.find_one({"name_en": cat["name_en"]})
        if existing:
            print(f"  - categorie deja presente : {cat['name_en']}")
            continue
        cat_id = f"cat_{uuid.uuid4().hex[:8]}"
        db.categories.insert_one({
            "category_id": cat_id,
            **cat,
            "description": None,
            "icon": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"  + categorie creee : {cat['name_en']} ({cat_id})")


def seed_transitaires():
    for trans in TRANSITAIRES:
        existing = db.transitaires.find_one({"name": trans["name"], "city": trans["city"]})
        if existing:
            print(f"  - transitaire deja present : {trans['name']}")
            continue
        trans_id = f"trans_{uuid.uuid4().hex[:8]}"
        db.transitaires.insert_one({
            "transitaire_id": trans_id,
            **trans,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"  + transitaire cree : {trans['name']} ({trans_id})")


def promote_to_admin(email):
    result = db.users.update_one({"email": email}, {"$set": {"role": "admin"}})
    if result.matched_count == 0:
        print(f"Aucun utilisateur trouve avec l'email {email}. "
              f"Inscris-toi d'abord sur le site avec cet email, puis relance le script.")
    else:
        print(f"Compte {email} promu administrateur.")


if __name__ == "__main__":
    if "--promote" in sys.argv:
        idx = sys.argv.index("--promote")
        email = sys.argv[idx + 1]
        promote_to_admin(email)
    else:
        print("Insertion des categories...")
        seed_categories()
        print("Insertion des transitaires (pense a editer TRANSITAIRES dans ce fichier avec tes vraies infos)...")
        seed_transitaires()
        print("\nFait. Inscris-toi ensuite normalement sur le site, puis relance :")
        print("  python seed_data.py --promote ton-email@exemple.com")
