"""Generic CRUD router factory for simple collections."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from ..auth import get_current_user
from ..tenancy import TenantDB, get_tenant
from ..util import next_sequence, now_iso, serialize, text_filter, to_object_id

# Query params reserved by the list endpoint itself; everything else becomes an equality filter.
RESERVED = {"q", "sort", "order", "limit", "skip"}


def crud_router(
    name: str,
    search_fields: list[str],
    *,
    code_field: Optional[str] = None,
    code_prefix: str = "",
    code_start: int = 1,
    default_sort: str = "created_at",
    default_order: int = -1,
    tag: Optional[str] = None,
) -> APIRouter:
    router = APIRouter(prefix=f"/api/{name}", tags=[tag or name])

    @router.get("")
    async def list_items(
        request: Request,
        q: Optional[str] = None,
        sort: Optional[str] = None,
        order: Optional[str] = None,
        limit: int = 500,
        skip: int = 0,
        user: dict = Depends(get_current_user),
        tdb: TenantDB = Depends(get_tenant),
    ):
        col = tdb[name]
        query = text_filter(q, search_fields)
        for key, value in request.query_params.items():
            if key in RESERVED or value == "" or key.startswith("$"):
                continue
            query[key] = value
        sort_field = sort or default_sort
        sort_dir = -1 if (order or ("desc" if default_order == -1 else "asc")) == "desc" else 1
        cursor = col.find(query).sort(sort_field, sort_dir).skip(skip).limit(min(limit, 2000))
        items = await cursor.to_list(length=None)
        total = await col.count_documents(query)
        return {"items": serialize(items), "total": total}

    @router.get("/{item_id}")
    async def get_item(item_id: str, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
        col = tdb[name]
        doc = await col.find_one({"_id": to_object_id(item_id)})
        if not doc:
            raise HTTPException(status_code=404, detail=f"{name[:-1] if name.endswith('s') else name} not found")
        return serialize(doc)

    @router.post("", status_code=201)
    async def create_item(payload: dict, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
        col = tdb[name]
        for key in ("id", "_id", "clinic_id"):
            payload.pop(key, None)
        payload["created_at"] = now_iso()
        payload["updated_at"] = payload["created_at"]
        payload["created_by"] = user.get("email")
        if code_field and not payload.get(code_field):
            payload[code_field] = await next_sequence(tdb, name, code_prefix, code_start)
        result = await col.insert_one(payload)
        doc = await col.find_one({"_id": result.inserted_id})
        return serialize(doc)

    @router.patch("/{item_id}")
    async def update_item(item_id: str, payload: dict, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
        col = tdb[name]
        for key in ("id", "_id", "clinic_id"):
            payload.pop(key, None)
        payload["updated_at"] = now_iso()
        result = await col.update_one({"_id": to_object_id(item_id)}, {"$set": payload})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        doc = await col.find_one({"_id": to_object_id(item_id)})
        return serialize(doc)

    @router.delete("/{item_id}")
    async def delete_item(item_id: str, user: dict = Depends(get_current_user), tdb: TenantDB = Depends(get_tenant)):
        col = tdb[name]
        result = await col.delete_one({"_id": to_object_id(item_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"ok": True}

    return router
