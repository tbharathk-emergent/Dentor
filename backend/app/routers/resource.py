"""Generic CRUD router factory for simple collections."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from ..roles import has_role, require_staff
from ..tenancy import TenantDB, get_tenant
from ..util import next_sequence, now_iso, serialize, text_filter, to_object_id

# Query params reserved by the list endpoint itself; everything else becomes an equality filter.
RESERVED = {"q", "sort", "order", "limit", "skip"}


def crud_router(
    name: str,
    search_fields: list[str],
    *,
    validate=None,  # async (tdb, payload, existing_doc | None) -> None; may mutate payload
    after_write=None,  # async (tdb, action, doc, before | None) -> None; notifications etc.
    code_field: Optional[str] = None,
    code_prefix: str = "",
    code_start: int = 1,
    default_sort: str = "created_at",
    default_order: int = -1,
    tag: Optional[str] = None,
    read_roles: Optional[set[str]] = None,  # None: any clinic staff
    write_roles: Optional[set[str]] = None,  # None: same as read_roles
    validate_user=None,  # async (tdb, user, payload, existing_doc | None) -> None: per-user rules
) -> APIRouter:
    """`read_roles` / `write_roles` narrow who may read and change the collection. The collections
    the reception web app has always used keep the default (any clinic staff) so that the live web
    app behaves as before; the collections added for the designed apps name their roles."""
    router = APIRouter(prefix=f"/api/{name}", tags=[tag or name])
    write_roles = write_roles if write_roles is not None else read_roles
    label = name.replace("_", " ")

    def check(user: dict, roles: Optional[set[str]], verb: str) -> None:
        if roles is not None and not has_role(user, roles):
            raise HTTPException(status_code=403, detail=f"Your role cannot {verb} {label}.")

    @router.get("")
    async def list_items(
        request: Request,
        q: Optional[str] = None,
        sort: Optional[str] = None,
        order: Optional[str] = None,
        limit: int = 500,
        skip: int = 0,
        user: dict = Depends(require_staff),
        tdb: TenantDB = Depends(get_tenant),
    ):
        check(user, read_roles, "see")
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
    async def get_item(item_id: str, user: dict = Depends(require_staff), tdb: TenantDB = Depends(get_tenant)):
        check(user, read_roles, "see")
        col = tdb[name]
        doc = await col.find_one({"_id": to_object_id(item_id)})
        if not doc:
            raise HTTPException(status_code=404, detail=f"{name[:-1] if name.endswith('s') else name} not found")
        return serialize(doc)

    @router.post("", status_code=201)
    async def create_item(payload: dict, user: dict = Depends(require_staff), tdb: TenantDB = Depends(get_tenant)):
        check(user, write_roles, "add to")
        col = tdb[name]
        for key in ("id", "_id", "clinic_id", "test_record"):
            payload.pop(key, None)
        if validate_user:
            await validate_user(tdb, user, payload, None)
        if validate:
            await validate(tdb, payload, None)
        payload["created_at"] = now_iso()
        payload["updated_at"] = payload["created_at"]
        payload["created_by"] = user.get("email")
        if code_field and not payload.get(code_field):
            payload[code_field] = await next_sequence(tdb, name, code_prefix, code_start)
        result = await col.insert_one(payload)
        doc = await col.find_one({"_id": result.inserted_id})
        if after_write:
            await after_write(tdb, "create", doc, None)
        return serialize(doc)

    @router.patch("/{item_id}")
    async def update_item(item_id: str, payload: dict, user: dict = Depends(require_staff), tdb: TenantDB = Depends(get_tenant)):
        check(user, write_roles, "change")
        col = tdb[name]
        for key in ("id", "_id", "clinic_id", "created_at", "created_by", "test_record"):
            payload.pop(key, None)
        existing = None
        if validate or after_write or validate_user:
            existing = await col.find_one({"_id": to_object_id(item_id)})
            if not existing:
                raise HTTPException(status_code=404, detail="Record not found")
        if validate_user:
            await validate_user(tdb, user, payload, existing)
        if validate:
            await validate(tdb, payload, existing)
        payload["updated_at"] = now_iso()
        result = await col.update_one({"_id": to_object_id(item_id)}, {"$set": payload})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        doc = await col.find_one({"_id": to_object_id(item_id)})
        if after_write:
            await after_write(tdb, "update", doc, existing)
        return serialize(doc)

    @router.delete("/{item_id}")
    async def delete_item(item_id: str, user: dict = Depends(require_staff), tdb: TenantDB = Depends(get_tenant)):
        check(user, write_roles, "remove")
        col = tdb[name]
        result = await col.delete_one({"_id": to_object_id(item_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"ok": True}

    return router
