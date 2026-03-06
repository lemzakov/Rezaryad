from fastapi import APIRouter, Depends, HTTPException, Query
from app.middleware.auth import get_current_user
from app.db import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/couriers", tags=["couriers"])


class AddCardRequest(BaseModel):
    cardToken: str
    lastFour: str


class VerifyRequest(BaseModel):
    code: str
    state: str


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
