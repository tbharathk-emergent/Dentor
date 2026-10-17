from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from ..auth import (
    create_access_token, get_current_user, hash_password, is_super_admin, optional_bearer, session_id_of,
    verify_password,
)
from .. import device_credentials
from ..account_deletion import soft_delete_staff
from ..db import db
from ..patient_auth import issue_patient_tokens, list_profiles, load_profile, public_account
from ..roles import CLINIC_APP_ROLES, CLINIC_OWNER, CONSULTANT, PORTAL_ONLY_ROLES
from ..rules import check_password_strength, clinic_settings
from ..security import check_login_allowed, clear_login_failures, rate_limit, record_login_failure
from ..sessions import (
    consume_refresh_token, end_session, end_session_of_refresh_token, issue_refresh_token, new_session_id,
    revoke_all_sessions,
)
from ..tenancy import TenantDB
from ..util import now_iso, serialize, to_object_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Shared throttle for every credential-bearing endpoint in this router.
login_burst_limit = rate_limit("auth", 30, 60)


class LoginBody(BaseModel):
    email: str
    password: str
    remember: bool = True
    # Which client is signing in: "web" (reception / super admin), "owner" or "consultant".
    app: str = "web"
    device: str = ""


class RefreshBody(BaseModel):
    refresh_token: str


class LogoutBody(BaseModel):
    refresh_token: str = ""


def check_app_access(user: dict, app: str) -> None:
    """Each client only accepts the roles it is built for (the APIs enforce roles again)."""
    role = user.get("role")
    if app == "web":
        if role in PORTAL_ONLY_ROLES:
            raise HTTPException(status_code=403, detail="Consultant accounts sign in through the Dentor Consultant app.")
    elif app == "owner":
        # The Dentor Clinic app (built as the "owner" app): the roles that run the practice.
        if role not in CLINIC_APP_ROLES:
            raise HTTPException(status_code=403, detail="This login cannot use the Dentor Clinic app. Use the reception web app.")
    elif app == "consultant":
        if role != CONSULTANT:
            raise HTTPException(status_code=403, detail="This login is not a consultant account.")
    else:
        raise HTTPException(status_code=400, detail="Unknown app.")


async def _clinic_of(user: dict) -> dict | None:
    if not user.get("clinic_id"):
        return None
    return await db.clinics.find_one({"_id": to_object_id(user["clinic_id"])})


async def _authenticate(request: Request, identifier: str, password: str) -> dict:
    check_login_allowed(request, identifier)
    user = await db.users.find_one(
        {"$or": [{"email": identifier.lower().strip()}, {"user_id": identifier.strip()}]}
    )
    if not user:
        # Someone who applied to join (sign-up with approval) is told where their application stands,
        # but only with the password they applied with, so this reveals nothing to anyone else.
        application = await db.signup_applications.find_one({"email": identifier.lower().strip(), "status": {"$in": ["Pending", "Rejected"]}},
                                                            sort=[("created_at", -1)])
        if application and verify_password(password, application.get("password_hash", "")):
            if application["status"] == "Pending":
                raise HTTPException(status_code=403, detail="Your application is being reviewed. You can sign in once Dentor approves it.")
            raise HTTPException(status_code=403, detail=f"Your application was not approved: {application.get('reason') or 'contact Dentor support'}.")
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


async def _token_response(user: dict, family: str | None = None, device: str = "") -> dict:
    # The clinic's "Session timeout" setting shortens the token lifetime to 30 minutes.
    expires = None
    if user.get("clinic_id"):
        settings = await clinic_settings(TenantDB(db, user["clinic_id"]))
        if settings.get("sessionTimeout"):
            expires = 30
    # One session per sign-in: the access token names it (`sid`) so signing out can end it.
    session_id = family or new_session_id()
    token = create_access_token(
        user["email"], {"role": user.get("role", "staff"), "sid": session_id}, expires_minutes=expires
    )
    refresh = await issue_refresh_token(db, "user", user["email"], family=session_id, device=device)
    safe = serialize({k: v for k, v in user.items() if k not in ("password_hash", "sessions_valid_from")})
    clinic = await _clinic_of(user)
    if clinic:
        safe["clinic"] = {"id": str(clinic["_id"]), "name": clinic.get("name", ""), "code": clinic.get("code", "")}
    return {"access_token": token, "refresh_token": refresh, "token_type": "bearer", "user": safe}


@router.post("/login", dependencies=[Depends(login_burst_limit)])
async def login(request: Request, body: LoginBody):
    user = await _authenticate(request, body.email, body.password)
    check_app_access(user, body.app)
    await db.activities.insert_one(
        {"type": "login", "message": f"{user.get('name', user['email'])} signed in", "at": now_iso(),
         "user": user["email"], "clinic_id": user.get("clinic_id")}
    )
    return await _token_response(user, device=body.device)


class DeviceEnrollBody(BaseModel):
    device_name: str = ""


class DeviceLoginBody(BaseModel):
    device_id: str
    secret: str
    app: str = "web"
    device: str = ""


class DeviceRevokeBody(BaseModel):
    device_id: str


@router.post("/device/enroll")
async def device_enroll(body: DeviceEnrollBody, user: dict = Depends(get_current_user)):
    """Turns fingerprint sign-in on for this device (see app/device_credentials.py)."""
    if is_super_admin(user):
        raise HTTPException(status_code=400, detail="Fingerprint sign-in is for the apps.")
    return await device_credentials.enroll(db, "user", user["email"], body.device_name)


@router.post("/device/login", dependencies=[Depends(login_burst_limit)])
async def device_login(body: DeviceLoginBody):
    doc = await device_credentials.check(db, "user", body.device_id, body.secret)
    user = await db.users.find_one({"email": doc["subject"]})
    if not user:
        raise HTTPException(status_code=401, detail="Sign in with your password.")
    await device_credentials.check(db, "user", body.device_id, body.secret, user.get("sessions_valid_from"), doc["subject"])
    if user.get("status") == "Inactive":
        raise HTTPException(status_code=403, detail="This account is inactive. Contact your administrator.")
    clinic = await _clinic_of(user)
    if not clinic or clinic.get("status") == "Suspended":
        raise HTTPException(status_code=403, detail="This clinic is suspended. Contact Dentor support.")
    check_app_access(user, body.app)
    return await _token_response(user, device=body.device)


@router.post("/device/revoke")
async def device_revoke(body: DeviceRevokeBody, user: dict = Depends(get_current_user)):
    await device_credentials.revoke(db, "user", user["email"], body.device_id)
    return {"ok": True}


@router.post("/refresh", dependencies=[Depends(login_burst_limit)])
async def refresh_session(body: RefreshBody):
    """Exchange a refresh token for a new access + refresh pair (staff, owner, consultant, patient)."""
    record = await consume_refresh_token(db, body.refresh_token)
    expired = HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    if record["kind"] == "patient":
        account = await db.patient_accounts.find_one({"_id": to_object_id(record["subject"])})
        if not account or account.get("status") == "Disabled":
            raise expired
        claims = record.get("claims") or {}
        # Keep the active profile only while it still belongs to this account's mobile number.
        keep = await load_profile(account, claims.get("cid"), claims.get("pid"))
        tokens = await issue_patient_tokens(
            account, claims.get("cid") if keep else None, claims.get("pid") if keep else None,
            family=record["family"], device=record.get("device", ""),
        )
        profiles = await list_profiles(account)
        active = next((p for p in profiles if keep and p["patient_id"] == claims.get("pid")), None)
        return {**tokens, "account": public_account(account), "profiles": profiles, "profile": active}

    user = await db.users.find_one({"email": record["subject"]})
    if not user or user.get("status") == "Inactive":
        raise expired
    if not is_super_admin(user):
        clinic = await _clinic_of(user)
        if not clinic or clinic.get("status") == "Suspended":
            raise expired
    return await _token_response(user, family=record["family"], device=record.get("device", ""))


@router.post("/logout")
async def logout(body: LogoutBody | None = None, token: str | None = Depends(optional_bearer)):
    """Ends the session on this device, on the server as well: its refresh token is retired
    and its access token is refused from now on. The session is named by the refresh token
    in the body (mobile apps), by the bearer token (the web app holds only that), or both.
    Always succeeds, so a stale or missing token cannot block sign-out."""
    if body and body.refresh_token:
        await end_session_of_refresh_token(db, body.refresh_token)
    await end_session(db, session_id_of(token))
    return {"ok": True}


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
    # Other devices must sign in again; this one receives a fresh pair to carry on with.
    await revoke_all_sessions(db, "user", user["email"])
    fresh = await db.users.find_one({"email": user["email"]})
    tokens = await _token_response(fresh)
    return {"ok": True, "message": "Password changed.", **tokens}


@router.post("/account/delete", dependencies=[Depends(login_burst_limit)])
async def delete_my_account(request: Request, password: str = Body(..., embed=True), user: dict = Depends(get_current_user)):
    """"Delete my account" in the Clinic Owner and Consultant apps: soft-deletes this login (app/account_deletion.py).
    The clinic's records stay; a Super Admin can restore the login."""
    check_login_allowed(request, user["email"])
    full = await db.users.find_one({"email": user["email"]})
    if not verify_password(password, full.get("password_hash", "")):
        record_login_failure(request, user["email"])
        raise HTTPException(status_code=400, detail="Password is incorrect.")
    clear_login_failures(request, user["email"])
    await soft_delete_staff(db, full)
    return {"ok": True}
