"""Multi-tenancy: every clinic's data lives in the shared collections, tagged with `clinic_id`.

Routers never touch the raw database for clinic data. They depend on `get_tenant`, which
returns a `TenantDB` whose collections force the caller's clinic into every filter and write,
so a missing filter cannot leak one clinic's records to another.
"""
from fastapi import Depends, HTTPException, Request

from .auth import get_current_user, is_super_admin
from .db import db
from .util import to_object_id

CLINIC_HEADER = "X-Clinic-Id"


class ScopedCollection:
    def __init__(self, collection, clinic_id: str):
        self._col = collection
        self._clinic_id = clinic_id

    def _scope(self, query=None) -> dict:
        return {**(query or {}), "clinic_id": self._clinic_id}

    def find(self, query=None, *args, **kwargs):
        return self._col.find(self._scope(query), *args, **kwargs)

    def find_one(self, query=None, *args, **kwargs):
        return self._col.find_one(self._scope(query), *args, **kwargs)

    def count_documents(self, query=None, **kwargs):
        return self._col.count_documents(self._scope(query), **kwargs)

    def insert_one(self, doc: dict):
        doc["clinic_id"] = self._clinic_id
        return self._col.insert_one(doc)

    def insert_many(self, docs: list[dict]):
        for doc in docs:
            doc["clinic_id"] = self._clinic_id
        return self._col.insert_many(docs)

    def update_one(self, query, update, **kwargs):
        return self._col.update_one(self._scope(query), update, **kwargs)

    def find_one_and_update(self, query, update, **kwargs):
        return self._col.find_one_and_update(self._scope(query), update, **kwargs)

    def delete_one(self, query):
        return self._col.delete_one(self._scope(query))

    def aggregate(self, pipeline: list, **kwargs):
        return self._col.aggregate([{"$match": {"clinic_id": self._clinic_id}}, *pipeline], **kwargs)


class TenantDB:
    """A view of the database restricted to one clinic."""

    def __init__(self, database, clinic_id: str):
        self._db = database
        self.clinic_id = clinic_id

    def __getitem__(self, name: str) -> ScopedCollection:
        return ScopedCollection(self._db[name], self.clinic_id)

    def __getattr__(self, name: str) -> ScopedCollection:
        return self[name]


async def get_tenant(request: Request, user: dict = Depends(get_current_user)) -> TenantDB:
    """Resolve the clinic a request acts on.

    Clinic users are pinned to their own clinic. A super admin picks the clinic to manage
    through the X-Clinic-Id header; that header is ignored for everyone else.
    """
    if is_super_admin(user):
        clinic_id = request.headers.get(CLINIC_HEADER)
        if not clinic_id:
            raise HTTPException(status_code=400, detail="Select a clinic to manage first.")
        if not await db.clinics.find_one({"_id": to_object_id(clinic_id)}):
            raise HTTPException(status_code=404, detail="Clinic not found")
        return TenantDB(db, clinic_id)

    clinic_id = user.get("clinic_id")
    clinic = await db.clinics.find_one({"_id": to_object_id(clinic_id)}) if clinic_id else None
    if not clinic:
        raise HTTPException(status_code=403, detail="Your account is not linked to a clinic.")
    if clinic.get("status") == "Suspended":
        raise HTTPException(status_code=403, detail="This clinic is suspended. Contact Dentor support.")
    return TenantDB(db, clinic_id)
