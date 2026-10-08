from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from ..auth import create_access_token, get_current_user, hash_password, is_super_admin, verify_password
from ..db import db
from ..rules import check_password_strength, clinic_settings
from ..security import check_login_allowed, clear_login_failures, rate_limit, record_login_failure
from ..tenancy import TenantDB
from ..util import now_iso, serialize, to_object_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Shared throttle for every credential-bearing endpoint in this router.
login_burst_limit = rate_limit("auth", 30, 60)


class LoginBody(BaseModel):
    email: str
    password: str
    remember: bool = True


async def _clinic_of(user: dict) -> dict | None:
    if not user.get("clinic_id"):
        return None
    return await db.clinics.find_one({"_id": to_object_id(user["clinic_id"])})


async def _authenticate(request: Request, identifier: str, password: str) -> dict:
    check_login_allowed(request, identifier)
    user = await db.users.find_one(
        {"$or": [{"email": identifier.lower().strip()}, {"user_id": identifier.strip()}]}
    )
    if not user or not verify_password(password, user.get("password_hash", "")):
        record_login_failure(request, identifier)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    clear_login_failures(request, identifier)
    if user.get("status") == "Inactive":
        raise HTTPException(status_code=403, detail="This account is inactive. Contact your administrator.")
    if not is_super_admin(user):
        clinic = await _clinic_of(user)
        if not clinic:
            raise HTTPException(status_code=403, detail="Your account is not linked to a clinic.")
        if clinic.get("status") == "Suspended":
            raise HTTPException(status_code=403, detail="This clinic is suspended. Contact Dentor support.")
    return user


async def _token_response(user: dict) -> dict:
    # The clinic's "Session timeout" setting shortens the token lifetime to 30 minutes.
    expires = None
    if user.get("clinic_id"):
        settings = await clinic_settings(TenantDB(db, user["clinic_id"]))
        if settings.get("sessionTimeout"):
            expires = 30
    token = create_access_token(user["email"], {"role": user.get("role", "staff")}, expires_minutes=expires)
    safe = serialize({k: v for k, v in user.items() if k != "password_hash"})
    clinic = await _clinic_of(user)
    if clinic:
        safe["clinic"] = {"id": str(clinic["_id"]), "name": clinic.get("name", ""), "code": clinic.get("code", "")}
    return {"access_token": token, "token_type": "bearer", "user": safe}


@router.post("/login", dependencies=[Depends(login_burst_limit)])
async def login(request: Request, body: LoginBody):
    user = await _authenticate(request, body.email, body.password)
    await db.activities.insert_one(
        {"type": "login", "message": f"{user.get('name', user['email'])} signed in", "at": now_iso(),
         "user": user["email"], "clinic_id": user.get("clinic_id")}
    )
    return await _token_response(user)


# OAuth2 form variant so Swagger UI "Authorize" works too
@router.post("/login-form", include_in_schema=False, dependencies=[Depends(login_burst_limit)])
async def login_form(request: Request, form: OAuth2PasswordRequestForm = Depends()):
    user = await _authenticate(request, form.username, form.password)
    return await _token_response(user)


@router.post("/verify-password", dependencies=[Depends(login_burst_limit)])
async def verify_own_password(
    request: Request,
    password: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
):
    """Re-confirm the signed-in user's password (used to unlock masked financials)."""
    check_login_allowed(request, user["email"])
    full = await db.users.find_one({"email": user["email"]})
    if not full or not verify_password(password, full.get("password_hash", "")):
        record_login_failure(request, user["email"])
        raise HTTPException(status_code=401, detail="Incorrect password.")
    clear_login_failures(request, user["email"])
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/change-password", dependencies=[Depends(login_burst_limit)])
async def change_password(
    request: Request,
    current_password: str = Body(...),
    new_password: str = Body(...),
    user: dict = Depends(get_current_user),
):
    check_login_allowed(request, user["email"])
    full = await db.users.find_one({"email": user["email"]})
    if not verify_password(current_password, full.get("password_hash", "")):
        record_login_failure(request, user["email"])
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    clear_login_failures(request, user["email"])
    # Super admins always follow the strong policy; clinic users follow their clinic's setting.
    strong = True
    if user.get("clinic_id"):
        settings = await clinic_settings(TenantDB(db, user["clinic_id"]))
        strong = bool(settings.get("strongPassword", True))
    check_password_strength(new_password, strong)
    await db.users.update_one(
        {"email": user["email"]},
        {"$set": {"password_hash": hash_password(new_password), "password_changed_at": now_iso()}},
    )
    return {"ok": True, "message": "Password changed. Sign in with your new password."}
