from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db

router = APIRouter(prefix="/api/lockers", tags=["lockers"])


@router.get("/")
async def list_lockers(db=Depends(get_db)):
    lockers = await db.locker.find_many(
        where={"isActive": True},
        include={"cells": True},
    )
    return [
        {
            "id": l.id,
            "name": l.name,
            "address": l.address,
            "lat": l.lat,
            "lon": l.lon,
            "freeCells": sum(1 for c in l.cells if c.status == "FREE"),
            "totalCells": len(l.cells),
        }
        for l in lockers
    ]


@router.get("/qr/{qr_code}")
async def get_by_qr(qr_code: str, db=Depends(get_db)):
    locker = await db.locker.find_unique(
        where={"qrCode": qr_code},
        include={"cells": True},
    )
    if not locker:
        raise HTTPException(status_code=404, detail="Locker not found")
    return _locker_detail(locker)


@router.get("/{locker_id}")
async def get_locker(locker_id: str, db=Depends(get_db)):
    locker = await db.locker.find_unique(
        where={"id": locker_id},
        include={"cells": True},
    )
    if not locker:
        raise HTTPException(status_code=404, detail="Locker not found")
    return _locker_detail(locker)


def _locker_detail(locker) -> dict:
    return {
        "id": locker.id,
        "name": locker.name,
        "address": locker.address,
        "lat": locker.lat,
        "lon": locker.lon,
        "qrCode": locker.qrCode,
        "isActive": locker.isActive,
        "cells": [
            {
                "id": c.id,
                "number": c.number,
                "status": c.status,
                "hasCharger": c.hasCharger,
            }
            for c in locker.cells
        ],
        "freeCells": sum(1 for c in locker.cells if c.status == "FREE"),
    }
