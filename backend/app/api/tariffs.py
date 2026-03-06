from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.db import get_db
from pydantic import BaseModel

router = APIRouter(prefix="/api/tariffs", tags=["tariffs"])


class SubscribeRequest(BaseModel):
    tariffId: str
    autoRenew: bool = False


@router.get("/")
async def list_tariffs(db=Depends(get_db)):
    tariffs = await db.tariff.find_many()
    return [
        {
            "id": t.id,
            "name": t.name,
            "pricePerMinute": t.pricePerMinute,
            "isSubscription": t.isSubscription,
            "subscriptionPeriod": t.subscriptionPeriod,
            "freeMins": t.freeMins,
            "discountPct": t.discountPct,
            "isNight": t.isNight,
        }
        for t in tariffs
    ]


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest, user=Depends(get_current_user), db=Depends(get_db)):
    tariff = await db.tariff.find_unique(where={"id": req.tariffId})
    if not tariff or not tariff.isSubscription:
        raise HTTPException(status_code=400, detail="Tariff not available for subscription")

    existing = await db.subscription.find_first(
        where={"userId": user.id, "isActive": True}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already have an active subscription")

    days = tariff.subscriptionPeriod or 30
    now = datetime.now(timezone.utc)
    end_at = now + timedelta(days=days)

    sub = await db.subscription.create(data={
        "userId": user.id,
        "tariffId": req.tariffId,
        "startAt": now,
        "endAt": end_at,
        "isActive": True,
        "autoRenew": req.autoRenew,
    })
    return {"id": sub.id, "tariffId": sub.tariffId, "endAt": sub.endAt, "autoRenew": sub.autoRenew}


@router.delete("/subscribe/{sub_id}")
async def cancel_subscription(sub_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    sub = await db.subscription.find_unique(where={"id": sub_id})
    if not sub or sub.userId != user.id:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.subscription.update(where={"id": sub_id}, data={"isActive": False, "autoRenew": False})
    return {"cancelled": True}
