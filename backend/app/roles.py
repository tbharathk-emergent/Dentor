"""Role model and server-side access tiers.

Users (the `users` collection) carry one role. Patients are NOT users: they sign in to
their own account type (`patient_accounts`) and receive a different kind of token, so a
patient token can never satisfy a staff dependency.

Tiers:
- Super Admin   platform owner, acts on a clinic chosen with the X-Clinic-Id header
- Clinic Owner  everything in their clinic, plus owner-only analytics and account control
- Administrator full reception/back-office access and account management (not owner accounts)
- other staff   reception/back-office access (Receptionist, Dentist, Pharmacist, ...)
- Consultant    portal-only: their own schedule, patients and earnings — no generic data access
"""
from fastapi import Depends, HTTPException

from .auth import SUPER_ADMIN_ROLE, get_current_user, is_super_admin

SUPER_ADMIN = SUPER_ADMIN_ROLE
CLINIC_OWNER = "Clinic Owner"
ADMINISTRATOR = "Administrator"
CONSULTANT = "Consultant"

# Roles that may only use their dedicated portal API, never the generic clinic resources.
PORTAL_ONLY_ROLES = {CONSULTANT}
CLINIC_ADMIN_ROLES = {CLINIC_OWNER, ADMINISTRATOR}
# Suggested roles offered when creating a login (any other label is still treated as staff).
STAFF_ROLE_OPTIONS = [CLINIC_OWNER, ADMINISTRATOR, "Receptionist", "Dentist", "Accountant", "Pharmacist", CONSULTANT]

# Groups used by the Clinic app (the designed "Clinic app", formerly the Owner app) and by the
# collections added for it. "Doctor" is the web app's older name for an in-house dentist.
DENTIST_ROLES = {"Dentist", "Doctor"}
CLINICAL_ROLES = CLINIC_ADMIN_ROLES | DENTIST_ROLES
FRONT_DESK_ROLES = CLINICAL_ROLES | {"Receptionist"}
FINANCE_ROLES = CLINIC_ADMIN_ROLES | {"Accountant"}
CLINIC_APP_ROLES = FRONT_DESK_ROLES | {"Accountant"}


def is_staff(user: dict) -> bool:
    return user.get("role") not in PORTAL_ONLY_ROLES


def is_clinic_admin(user: dict) -> bool:
    return is_super_admin(user) or user.get("role") in CLINIC_ADMIN_ROLES


def is_owner(user: dict) -> bool:
    return is_super_admin(user) or user.get("role") == CLINIC_OWNER


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="This area is for clinic staff. Use the Dentor Consultant app.")
    return user


async def require_clinic_admin(user: dict = Depends(get_current_user)) -> dict:
    if not is_clinic_admin(user):
        raise HTTPException(status_code=403, detail="Only the clinic owner or an administrator can do this.")
    return user


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if not is_owner(user):
        raise HTTPException(status_code=403, detail="Clinic owner access required.")
    return user


def has_role(user: dict, roles: set[str]) -> bool:
    """True for a super admin (acting for a clinic) or a user whose role is in `roles`."""
    return is_super_admin(user) or user.get("role") in roles


def require_roles(roles: set[str], message: str = "Your role cannot do this."):
    """Dependency: a clinic login whose role is one of `roles`."""
    async def dependency(user: dict = Depends(get_current_user)) -> dict:
        if not has_role(user, roles):
            raise HTTPException(status_code=403, detail=message)
        return user
    return dependency


async def require_consultant(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != CONSULTANT:
        raise HTTPException(status_code=403, detail="Consultant access required.")
    return user
