from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from app.middleware.auth import get_current_admin
from app.db import get_db
from app.config import ADMIN_SECRET
from passlib.context import CryptContext
from app.middleware.auth import create_admin_token
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["admin"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AdminLoginRequest(BaseModel):
    login: str
    password: str


class CreateLockerRequest(BaseModel):
    name: str
    address: str
    lat: float
    lon: float
    qrCode: str


class UpdateLockerRequest(BaseModel):
    name: str | None = None
    address: str | None = None
    isActive: bool | None = None


@router.post("/login")
async def admin_login(req: AdminLoginRequest, db=Depends(get_db)):
    admin = await db.adminuser.find_unique(where={"login": req.login})
    if not admin or not pwd_context.verify(req.password, admin.passwordHash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_admin_token(admin.id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/stats")
async def get_stats(db=Depends(get_db), _=Depends(get_current_admin)):
    now = datetime.now(timezone.utc)
    total_sessions = await db.session.count()
    active_sessions = await db.session.count(where={"endAt": None})
    total_users = await db.user.count()
    verified_users = await db.user.count(where={"isVerified": True})

    payments = await db.payment.find_many(where={"status": "SUCCESS"})
    total_revenue = sum(p.amount for p in payments)

    debt_users = await db.user.count(where={"hasDebt": True})
    total_debt = sum(
        u.debtAmount
        for u in await db.user.find_many(where={"hasDebt": True})
    )

    return {
        "totalSessions": total_sessions,
        "activeSessions": active_sessions,
        "totalUsers": total_users,
        "verifiedUsers": verified_users,
        "totalRevenue": round(total_revenue, 2),
        "debtUsers": debt_users,
        "totalDebt": round(total_debt, 2),
    }


@router.get("/stats/lockers")
async def get_locker_stats(db=Depends(get_db), _=Depends(get_current_admin)):
    lockers = await db.locker.find_many(include={"cells": True})
    result = []
    for locker in lockers:
        cell_ids = [c.id for c in locker.cells]
        total_sessions = await db.session.count(where={"cellId": {"in": cell_ids}}) if cell_ids else 0
        active_sessions = await db.session.count(
            where={"cellId": {"in": cell_ids}, "endAt": None}
        ) if cell_ids else 0
        free_cells = sum(1 for c in locker.cells if c.status == "FREE")
        result.append({
            "id": locker.id,
            "name": locker.name,
            "address": locker.address,
            "totalCells": len(locker.cells),
            "freeCells": free_cells,
            "totalSessions": total_sessions,
            "activeSessions": active_sessions,
        })
    return result


@router.get("/stats/couriers")
async def get_courier_stats(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db=Depends(get_db),
    _=Depends(get_current_admin),
):
    skip = (page - 1) * limit
    users = await db.user.find_many(skip=skip, take=limit, order={"createdAt": "desc"})
    result = []
    for u in users:
        session_count = await db.session.count(where={"userId": u.id})
        result.append({
            "id": u.id,
            "maxId": u.maxId,
            "phone": u.phone,
            "isVerified": u.isVerified,
            "hasDebt": u.hasDebt,
            "debtAmount": u.debtAmount,
            "sessionCount": session_count,
            "createdAt": u.createdAt,
        })
    return {"items": result, "total": await db.user.count()}


@router.get("/anomalies")
async def get_anomalies(db=Depends(get_db), _=Depends(get_current_admin)):
    from datetime import timedelta
    threshold = datetime.now(timezone.utc) - timedelta(hours=2)
    long_sessions = await db.session.find_many(
        where={"endAt": None, "startAt": {"lt": threshold}},
        include={"user": True, "cell": {"include": {"locker": True}}},
    )
    return [
        {
            "sessionId": s.id,
            "userId": s.userId,
            "userMaxId": s.user.maxId if s.user else None,
            "cellId": s.cellId,
            "locker": s.cell.locker.name if s.cell and s.cell.locker else None,
            "startAt": s.startAt,
            "durationHours": round((datetime.now(timezone.utc) - s.startAt).total_seconds() / 3600, 2),
        }
        for s in long_sessions
    ]


@router.get("/sessions")
async def get_all_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user_id: str | None = Query(None),
    active_only: bool = Query(False),
    db=Depends(get_db),
    _=Depends(get_current_admin),
):
    skip = (page - 1) * limit
    where: dict = {}
    if user_id:
        where["userId"] = user_id
    if active_only:
        where["endAt"] = None

    sessions = await db.session.find_many(
        where=where,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"},
        include={"user": True, "cell": {"include": {"locker": True}}},
    )
    total = await db.session.count(where=where)
    return {
        "items": [
            {
                "id": s.id,
                "userId": s.userId,
                "userMaxId": s.user.maxId if s.user else None,
                "locker": s.cell.locker.name if s.cell and s.cell.locker else None,
                "startAt": s.startAt,
                "endAt": s.endAt,
                "durationMins": s.durationMins,
                "cost": s.cost,
                "isPaid": s.isPaid,
            }
            for s in sessions
        ],
        "total": total,
    }


@router.get("/lockers")
async def get_lockers(db=Depends(get_db), _=Depends(get_current_admin)):
    lockers = await db.locker.find_many(include={"cells": True})
    return [
        {
            "id": l.id,
            "name": l.name,
            "address": l.address,
            "lat": l.lat,
            "lon": l.lon,
            "qrCode": l.qrCode,
            "isActive": l.isActive,
            "cellCount": len(l.cells),
        }
        for l in lockers
    ]


@router.post("/lockers")
async def create_locker(req: CreateLockerRequest, db=Depends(get_db), _=Depends(get_current_admin)):
    locker = await db.locker.create(data={
        "name": req.name,
        "address": req.address,
        "lat": req.lat,
        "lon": req.lon,
        "qrCode": req.qrCode,
        "isActive": True,
    })
    return {"id": locker.id, "name": locker.name, "qrCode": locker.qrCode}


@router.patch("/lockers/{locker_id}")
async def update_locker(
    locker_id: str,
    req: UpdateLockerRequest,
    db=Depends(get_db),
    _=Depends(get_current_admin),
):
    locker = await db.locker.find_unique(where={"id": locker_id})
    if not locker:
        raise HTTPException(status_code=404, detail="Locker not found")
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    updated = await db.locker.update(where={"id": locker_id}, data=data)
    return {"id": updated.id, "name": updated.name, "isActive": updated.isActive}
