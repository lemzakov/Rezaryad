from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.db import get_db
from app.services.booking import BookingService
from pydantic import BaseModel

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


class CreateBookingRequest(BaseModel):
    cellId: str


@router.post("/")
async def create_booking(req: CreateBookingRequest, user=Depends(get_current_user), db=Depends(get_db)):
    svc = BookingService(db)
    try:
        booking = await svc.create_booking(user.id, req.cellId)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "id": booking.id,
        "cellId": booking.cellId,
        "status": booking.status,
        "isFree": booking.isFree,
        "endsAt": booking.endsAt,
        "createdAt": booking.createdAt,
    }


@router.delete("/{booking_id}")
async def cancel_booking(booking_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    svc = BookingService(db)
    try:
        penalty_until = await svc.cancel_booking(booking_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"cancelled": True, "penaltyUntil": penalty_until}


@router.get("/active")
async def get_active_booking(user=Depends(get_current_user), db=Depends(get_db)):
    booking = await db.booking.find_first(
        where={"userId": user.id, "status": "ACTIVE"},
        include={"cell": {"include": {"locker": True}}},
    )
    if not booking:
        return None
    return {
        "id": booking.id,
        "cellId": booking.cellId,
        "cell": {
            "number": booking.cell.number,
            "locker": {"name": booking.cell.locker.name, "address": booking.cell.locker.address},
        },
        "status": booking.status,
        "isFree": booking.isFree,
        "endsAt": booking.endsAt,
        "createdAt": booking.createdAt,
    }
