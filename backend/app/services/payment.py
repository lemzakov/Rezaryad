import httpx
import logging
from app.config import ACQUIRING_API_KEY, ACQUIRING_BASE_URL

logger = logging.getLogger(__name__)


class PaymentService:
    def __init__(self, db):
        self.db = db

    async def charge(self, user_id: str, amount: float, session_id: str | None = None) -> dict:
        user = await self.db.user.find_unique(where={"id": user_id})
        if not user:
            raise ValueError("User not found")

        card = await self.db.paymentcard.find_first(
            where={"userId": user_id, "isActive": True}
        )

        payment = await self.db.payment.create(data={
            "userId": user_id,
            "sessionId": session_id,
            "amount": amount,
            "status": "PENDING",
            "cardToken": card.cardToken if card else None,
        })

        if not card:
            return await self.handle_insufficient_funds(session_id, amount, user_id, payment.id)

        try:
            success = await self._call_acquiring(card.cardToken, amount, payment.id)
        except Exception as e:
            logger.error(f"Acquiring error: {e}")
            success = False

        if success:
            await self.db.payment.update(where={"id": payment.id}, data={"status": "SUCCESS"})
            if session_id:
                await self.db.session.update(where={"id": session_id}, data={"isPaid": True})
            return {"status": "success", "payment_id": payment.id}
        else:
            return await self.handle_insufficient_funds(session_id, amount, user_id, payment.id)

    async def _call_acquiring(self, card_token: str, amount: float, payment_id: str) -> bool:
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    f"{ACQUIRING_BASE_URL}/charge",
                    headers={"Authorization": f"Bearer {ACQUIRING_API_KEY}"},
                    json={"card_token": card_token, "amount": amount, "order_id": payment_id},
                    timeout=30,
                )
                return resp.status_code == 200 and resp.json().get("status") == "success"
            except Exception:
                return False

    async def handle_insufficient_funds(
        self, session_id: str | None, amount: float, user_id: str, payment_id: str
    ) -> dict:
        await self.db.payment.update(where={"id": payment_id}, data={"status": "FAILED"})
        # Mark debt — do NOT cut power
        user = await self.db.user.find_unique(where={"id": user_id})
        new_debt = (user.debtAmount or 0) + amount
        await self.db.user.update(
            where={"id": user_id},
            data={"hasDebt": True, "debtAmount": new_debt},
        )
        logger.warning(f"Debt marked for user {user_id}: {new_debt}")
        return {"status": "debt", "debt_amount": new_debt}

    async def process_debt(self, user_id: str) -> bool:
        user = await self.db.user.find_unique(where={"id": user_id})
        if not user or not user.hasDebt or user.debtAmount <= 0:
            return True

        card = await self.db.paymentcard.find_first(
            where={"userId": user_id, "isActive": True}
        )
        if not card:
            return False

        payment = await self.db.payment.create(data={
            "userId": user_id,
            "amount": user.debtAmount,
            "status": "PENDING",
            "cardToken": card.cardToken,
        })

        success = await self._call_acquiring(card.cardToken, user.debtAmount, payment.id)
        if success:
            await self.db.payment.update(where={"id": payment.id}, data={"status": "SUCCESS"})
            await self.db.user.update(
                where={"id": user_id},
                data={"hasDebt": False, "debtAmount": 0},
            )
            return True
        else:
            await self.db.payment.update(where={"id": payment.id}, data={"status": "FAILED"})
            return False
