from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import MONGO_URL, DB_NAME

client: AsyncIOMotorClient = AsyncIOMotorClient(MONGO_URL)
db: AsyncIOMotorDatabase = client[DB_NAME]


def get_db() -> AsyncIOMotorDatabase:
    return db
