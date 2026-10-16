"""Notification centre and push-device registration for staff, owner and consultant logins.
(The patient app has the same endpoints under /api/patient.)"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import get_current_user
from ..db import db
from ..notify import KIND_USER, list_notifications, mark_read, register_device, unregister_device

router = APIRouter(prefix="/api", tags=["notifications"])


class ReadBody(BaseModel):
    ids: Optional[list[str]] = None


class DeviceBody(BaseModel):
    token: str
    platform: str = ""


@router.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    if not user.get("clinic_id"):
        return {"items": [], "unread": 0}
    return await list_notifications(db, user["clinic_id"], KIND_USER, user["email"])


@router.post("/notifications/read")
async def read_notifications(body: ReadBody, user: dict = Depends(get_current_user)):
    if not user.get("clinic_id"):
        return {"updated": 0}
    return {"updated": await mark_read(db, user["clinic_id"], KIND_USER, user["email"], body.ids)}


@router.post("/devices")
async def add_device(body: DeviceBody, user: dict = Depends(get_current_user)):
    await register_device(db, KIND_USER, user["email"], body.token, body.platform)
    return {"ok": True}


@router.post("/devices/remove")
async def remove_device(body: DeviceBody, user: dict = Depends(get_current_user)):
    await unregister_device(db, body.token)
    return {"ok": True}
