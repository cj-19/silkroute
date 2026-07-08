# SilkRoute MVP - Product Requirements Document

## Project Overview
**SilkRoute** is a B2B platform facilitating group buying from China for African merchants.

**Version:** 2.1  
**Last Updated:** January 2026

## Pricing Model

### Solo Order
```
Total = (Unit Price × Qty) + 5 USD + (Weight × Qty × Transport/kg)
```

### Groupage Order
```
Total = (Total Order Price × Share %) + 5,000 FCFA
```

### Typical Savings: 10-30% vs Solo, up to 50% vs Local wholesaler

## Features Implemented (v2.1)

### Core Features
- ✅ Bilingual FR/EN with toggle (fixed display)
- ✅ JWT + Google OAuth authentication
- ✅ 5-step onboarding (profile, mobile money, KYC, CGU)
- ✅ Manual KYC validation by admin
- ✅ Categories & buyer profiles management

### Pricing & Simulation
- ✅ Advanced price comparator (Solo vs Groupage vs Local)
- ✅ **Simulation widget on landing page**
- ✅ Dynamic pricing based on quantity

### Transitaires Management
- ✅ **CRUD for transitaires (admin)**
- ✅ **5 cities: Douala (2), Lagos (1), Abidjan (1), Dakar (1)**
- ✅ **Transitaire selection when creating groupage**
- ✅ Shipping price per kg and estimated days per transitaire

### Documents
- ✅ Supplier documents validation (required to publish)
- ✅ Logistics documents for members

### Product Proposals
- ✅ Members and admin can propose product links
- ✅ Admin approves/rejects/features proposals

### Real-time Features
- ✅ WebSocket chat per groupage
- ✅ Admin warnings center

### Payments
- ✅ Stripe integration (test mode)
- ✅ Caution (5,000 FCFA) + Solde

## API Endpoints

### Transitaires (NEW)
- `GET /api/transitaires` - List all active transitaires
- `GET /api/transitaires/{id}` - Get single transitaire
- `POST /api/admin/transitaires` - Create transitaire (admin)
- `PUT /api/admin/transitaires/{id}` - Update transitaire (admin)
- `DELETE /api/admin/transitaires/{id}` - Deactivate transitaire (admin)

### Simulation (NEW)
- `POST /api/simulate` - Public simulation endpoint
  - Input: `{ unit_price_cny, unit_weight_kg, quantity }`
  - Output: Solo price, Groupage estimate, Savings

## Test Accounts
- **Admin:** admin@silkroute.com / password123
- **Member:** test@silkroute.com / password123

## Seeded Data
- **Categories:** 4 (Electronics, Textiles, Beauty, Household)
- **Buyer Profiles:** 3 (Shop Owner, Wholesaler, Online Reseller)
- **Transitaires:** 5 (Douala×2, Lagos, Abidjan, Dakar)
- **Groupages:** 3 with realistic pricing

## Test Results (v2.1)
- Backend: 100% (23/23 tests)
- Frontend: 100% (15/15 tests)

## Next Actions
1. Email notifications (SendGrid)
2. Logistics timeline tracking
3. PDF invoice generation
4. Deploy with real Stripe/Cloudinary keys
