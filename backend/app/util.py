import re
from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from fastapi import HTTPException


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize(doc: Any) -> Any:
    """Convert Mongo documents to JSON-safe structures (_id -> id string)."""
    if isinstance(doc, list):
        return [serialize(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k == "_id":
                out["id"] = str(v)
            elif isinstance(v, ObjectId):
                out[k] = str(v)
            elif isinstance(v, (dict, list)):
                out[k] = serialize(v)
            elif isinstance(v, datetime):
                out[k] = v.isoformat()
            else:
                out[k] = v
        return out
    return doc


def to_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


async def next_sequence(tdb, name: str, prefix: str, start: int, width: int = 0) -> str:
    """Atomic per-clinic sequence generator, e.g. DEN-1001, INV-2849."""
    doc = await tdb.counters.find_one_and_update(
        {"name": name},
        {"$inc": {"seq": 1}, "$setOnInsert": {"start": start}},
        upsert=True,
        return_document=True,
    )
    seq = start + doc["seq"] - 1
    num = str(seq).zfill(width) if width else str(seq)
    return f"{prefix}{num}"


def text_filter(q: Optional[str], fields: list[str]) -> dict:
    if not q:
        return {}
    rx = {"$regex": re.escape(q), "$options": "i"}
    return {"$or": [{f: rx} for f in fields]}
