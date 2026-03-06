from prisma import Prisma

_client: Prisma | None = None


async def get_db() -> Prisma:
    global _client
    if _client is None or not _client.is_connected():
        _client = Prisma()
        await _client.connect()
    return _client


async def connect_db() -> None:
    global _client
    _client = Prisma()
    await _client.connect()


async def disconnect_db() -> None:
    global _client
    if _client and _client.is_connected():
        await _client.disconnect()
