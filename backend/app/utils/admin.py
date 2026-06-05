"""Admin identities for pool administration."""

ADMIN_EMAILS: frozenset[str] = frozenset(
    {
        "vitoco2489@gmail.com",
        "cris.arias.cabrera@gmail.com",
    }
)

# Primary admin (legacy references).
ADMIN_EMAIL = "vitoco2489@gmail.com"


def is_admin_email(email: str) -> bool:
    return (email or "").strip().lower() in ADMIN_EMAILS
