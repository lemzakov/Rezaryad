import hashlib
import hmac
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Query
from app.middleware.auth import get_current_user, create_access_token
from app.db import get_db
from app.config import MAX_BOT_TOKEN
from pydantic import BaseModel

router = APIRouter(prefix="/api/couriers", tags=["couriers"])


class MiniAppAuthRequest(BaseModel):
    initData: str


class AddCardRequest(BaseModel):
    cardToken: str
    lastFour: str


class VerifyRequest(BaseModel):
    code: str
    state: str


def _verify_max_init_data(init_data: str, bot_token: str) -> dict:
    """
    Verify Max messenger mini-app initData.

    Max uses the same verification scheme as Telegram Web Apps:
    1. Parse the URL-encoded initData string into key-value pairs.
    2. Extract the 'hash' field.
    3. Sort the remaining pairs alphabetically, join as 'key=value\n'.
    4. Compute HMAC-SHA256 using a secret key derived from the bot token.
       Secret key = HMAC-SHA256("WebAppData", bot_token)
    5. Compare computed hash with the extracted hash.

    Returns the parsed data dict if valid, raises HTTPException otherwise.
    """
    params = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=400, detail="Missing hash in initData")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(params.items())
    )
    secret_key = hmac.new(
        b"WebAppData", bot_token.encode(), hashlib.sha256
    ).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    return params


@router.post("/miniapp-auth")
async def miniapp_auth(req: MiniAppAuthRequest, db=Depends(get_db)):
    """
    Authenticate a Max messenger mini-app user.

    The client (mini-app running inside Max) sends the raw initData string
    provided by the Max SDK (window.max.initData or equivalent).
    The server verifies the HMAC signature using the bot token, then finds
    or creates the user and returns a JWT access token.

    Mini-app setup in Max:
    - Register your bot at https://dev.max.ru
    - In the bot settings, add the mini-app URL:
        https://<your-backend-host>  (or the Vercel frontend URL)
    - The mini-app URL to enter in Max developer portal is the URL of your
      deployed frontend, e.g.: https://rezaryad.vercel.app
    """
    if not MAX_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Bot token not configured")

    params = _verify_max_init_data(req.initData, MAX_BOT_TOKEN)

    # Extract user info from initData
    user_param = params.get("user")
    if not user_param:
        raise HTTPException(status_code=400, detail="No user data in initData")

    import json as _json
    try:
        user_data = _json.loads(user_param)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user data in initData")

    max_id = str(user_data.get("id", ""))
    if not max_id:
        raise HTTPException(status_code=400, detail="Missing user id in initData")

    user = await db.user.find_unique(where={"maxId": max_id})
    if not user:
        user = await db.user.create(data={"maxId": max_id, "language": "RU"})

    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    return {
        "id": user.id,
        "maxId": user.maxId,
        "phone": user.phone,
        "language": user.language,
        "isVerified": user.isVerified,
        "hasDebt": user.hasDebt,
        "debtAmount": user.debtAmount,
        "createdAt": user.createdAt,
    }


@router.post("/verify")
async def start_verification(req: VerifyRequest, user=Depends(get_current_user), db=Depends(get_db)):
    import httpx
    from app.config import GOSUSLUGI_CLIENT_ID, GOSUSLUGI_CLIENT_SECRET

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://esia.gosuslugi.ru/access-token",
                data={
                    "client_id": GOSUSLUGI_CLIENT_ID,
                    "client_secret": GOSUSLUGI_CLIENT_SECRET,
                    "code": req.code,
                    "grant_type": "authorization_code",
                },
                timeout=15,
            )
        if resp.status_code == 200:
            data = resp.json()
            await db.user.update(
                where={"id": user.id},
                data={
                    "isVerified": True,
                    "verificationData": data,
                },
            )
            return {"verified": True}
        else:
            raise HTTPException(status_code=400, detail="Verification failed")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Verification service unavailable")


@router.post("/cards")
async def add_card(req: AddCardRequest, user=Depends(get_current_user), db=Depends(get_db)):
    card = await db.paymentcard.create(data={
        "userId": user.id,
        "cardToken": req.cardToken,
        "lastFour": req.lastFour,
        "isActive": True,
    })
    return {"id": card.id, "lastFour": card.lastFour}


@router.delete("/cards/{card_id}")
async def remove_card(card_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    card = await db.paymentcard.find_unique(where={"id": card_id})
    if not card or card.userId != user.id:
        raise HTTPException(status_code=404, detail="Card not found")
    await db.paymentcard.update(where={"id": card_id}, data={"isActive": False})
    return {"deleted": True}


@router.get("/sessions")
async def get_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    skip = (page - 1) * limit
    sessions = await db.session.find_many(
        where={"userId": user.id},
        order={"createdAt": "desc"},
        skip=skip,
        take=limit,
    )
    total = await db.session.count(where={"userId": user.id})
    return {
        "items": [
            {
                "id": s.id,
                "startAt": s.startAt,
                "endAt": s.endAt,
                "durationMins": s.durationMins,
                "cost": s.cost,
                "isPaid": s.isPaid,
            }
            for s in sessions
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/balance")
async def get_balance(user=Depends(get_current_user)):
    return {"hasDebt": user.hasDebt, "debtAmount": user.debtAmount}
