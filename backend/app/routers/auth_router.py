from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from ..auth import create_access_token, get_current_user, hash_password, is_super_admin, verify_password
from ..db import db
from ..util import now_iso, serialize, to_object_id

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str
    password: str
    remember: bool = True


async def _clinic_of(user: dict) -> dict | None:
    if not user.get("clinic_id"):
        return None
    return await db.clinics.find_one({"_id": to_object_id(user["clinic_id"])})


async def _authenticate(identifier: str, password: str) -> dict:
    user = await db.users.find_one(
        {"$or": [{"email": identifier.lower().strip()}, {"user_id": identifier.strip()}]}
    )
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
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
    token = create_access_token(user["email"], {"role": user.get("role", "staff")})
    safe = serialize({k: v for k, v in user.items() if k != "password_hash"})
    clinic = await _clinic_of(user)
    if clinic:
        safe["clinic"] = {"id": str(clinic["_id"]), "name": clinic.get("name", ""), "code": clinic.get("code", "")}
    return {"access_token": token, "token_type": "bearer", "user": safe}


@router.post("/login")
async def login(body: LoginBody):
    user = await _authenticate(body.email, body.password)
    await db.activities.insert_one(
        {"type": "login", "message": f"{user.get('name', user['email'])} signed in", "at": now_iso(),
         "user": user["email"], "clinic_id": user.get("clinic_id")}
    )
    return await _token_response(user)


# OAuth2 form variant so Swagger UI "Authorize" works too
@router.post("/login-form", include_in_schema=False)
async def login_form(form: OAuth2PasswordRequestForm = Depends()):
    user = await _authenticate(form.username, form.password)
    return await _token_response(user)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/change-password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    user: dict = Depends(get_current_user),
):
    full = await db.users.find_one({"email": user["email"]})
    if not verify_password(current_password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
    await db.users.update_one(
        {"email": user["email"]},
        {"$set": {"password_hash": hash_password(new_password), "password_changed_at": now_iso()}},
    )
    return {"ok": True, "message": "Password changed. Sign in with your new password."}
