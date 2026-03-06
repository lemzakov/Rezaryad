from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.db import get_db
from app.services.session import SessionService
from pydantic import BaseModel

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class StartSessionRequest(BaseModel):
    cellId: str
    bookingId: str | None = None


class EndSessionRequest(BaseModel):
    doorClosed: bool
    chargerDisconnected: bool


@router.post("/")
async def start_session(req: StartSessionRequest, user=Depends(get_current_user), db=Depends(get_db)):
    svc = SessionService(db)
    try:
        session = await svc.start_session(user.id, req.cellId, req.bookingId)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": session.id, "startAt": session.startAt, "cellId": session.cellId}


@router.post("/{session_id}/end")
async def end_session(
    session_id: str,
    req: EndSessionRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    svc = SessionService(db)
    try:
        session = await svc.end_session(session_id, req.doorClosed, req.chargerDisconnected)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "id": session.id,
        "endAt": session.endAt,
        "durationMins": session.durationMins,
        "cost": session.cost,
        "isPaid": session.isPaid,
    }


@router.get("/{session_id}")
async def get_session(session_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    session = await db.session.find_unique(
        where={"id": session_id},
        include={"cell": {"include": {"locker": True}}},
    )
    if not session or session.userId != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "id": session.id,
        "startAt": session.startAt,
        "endAt": session.endAt,
        "durationMins": session.durationMins,
        "cost": session.cost,
        "isPaid": session.isPaid,
        "cell": {
            "number": session.cell.number,
            "locker": {"name": session.cell.locker.name} if session.cell.locker else None,
        },
    }
