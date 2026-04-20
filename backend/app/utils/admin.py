"""Single admin identity for pool administration."""

ADMIN_EMAIL = "vitoco2489@gmail.com"


def is_admin_email(email: str) -> bool:
    return (email or "").strip().lower() == ADMIN_EMAIL
