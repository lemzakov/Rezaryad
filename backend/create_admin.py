#!/usr/bin/env python3
"""
Script to create an admin user for the Rezaryad admin panel.

Usage:
    python create_admin.py <login> <password>

Example:
    python create_admin.py admin MySecretPassword123
"""
import sys
import asyncio
from passlib.context import CryptContext
from prisma import Prisma

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_admin(login: str, password: str) -> None:
    db = Prisma()
    await db.connect()
    try:
        existing = await db.adminuser.find_unique(where={"login": login})
        if existing:
            print(f"Admin user '{login}' already exists. Updating password...")
            await db.adminuser.update(
                where={"login": login},
                data={"passwordHash": pwd_context.hash(password)},
            )
            print(f"Password updated for admin '{login}'.")
        else:
            admin = await db.adminuser.create(
                data={
                    "login": login,
                    "passwordHash": pwd_context.hash(password),
                }
            )
            print(f"Admin user '{admin.login}' created successfully (id={admin.id}).")
    finally:
        await db.disconnect()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    login_arg = sys.argv[1]
    password_arg = sys.argv[2]

    if len(password_arg) < 8:
        print("Error: Password must be at least 8 characters.")
        sys.exit(1)

    asyncio.run(create_admin(login_arg, password_arg))
