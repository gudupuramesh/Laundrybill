# Security Fixes Implementation Plan

**Created:** January 29, 2025  
**Status:** Phase 1 Complete  
**Principle:** Fix one issue at a time, verify no regressions, production-safe rollout

---

## User Requirements (Must Preserve)

| Requirement | Status |
|-------------|--------|
| ✅ Staff can update orders | Preserved by Fix 1.1 |
| ✅ Agents can update pickup/delivery status | Preserved by Fix 1.1 |
| ✅ Public tracking works without login (customer link → order) | No changes to read rules |
| ✅ Super Admin – NO CHANGES (too risky) | Phase 4 & MEDIUM-003 skipped |

---

## Phase 1: Orders Update Security ✅ DONE

### Fix 1.1 – [CRITICAL-001] Orders Allow Unauthenticated Update

| Item | Value |
|------|-------|
| **File** | `firestore.rules` |
| **Change** | Replaced `allow update: if true` with `allow update: if isShopMember(shopId) \|\| isShopOwner(shopId)` |
| **Status** | **APPLIED** |
| **Preserves** | Staff, Agents, and Shop owners can still update orders via `isShopMember` (users doc) / `isShopOwner` |
| **Verification** | Deploy with `firebase deploy --only firestore:rules` and test order updates |

---

## Skipped / Deferred (Per User Requirements)

| Fix | Reason |
|-----|--------|
| Phase 3 (CRITICAL-002, HIGH-002) | Would require Cloud Function for public tracking; deferred to avoid risk |
| Phase 4 (HIGH-001, HIGH-003) | Super Admin – no changes |
| Fix 2.1 (MEDIUM-003 Activity Logs) | Super Admin area – no changes |

---

## Phase 5: Documentation & Process (Optional)

### Fix 5.1 – [MEDIUM-001] Public Receipt Route Clarity ✅ DONE

| Item | Value |
|------|-------|
| **Change** | Added comment clarifying URL param is tracking ID, not Firestore doc ID |
| **Status** | **APPLIED** |

### Fix 5.2 – [LOW-003] Ensure .env in .gitignore ✅ DONE

| Item | Value |
|------|-------|
| **Change** | Added `.env`, `.env.*`, `functions/.env` to `.gitignore` |
| **Status** | **APPLIED** |

---

## Verification Checklist (Post-Deploy)

- [ ] Shop owner can update order status
- [ ] Staff can update order status from Staff app
- [ ] Agent can update order status (pickup/delivery)
- [ ] Payment collection works
- [ ] Public tracking page works with valid tracking ID (no login)
- [ ] Public receipt page works
