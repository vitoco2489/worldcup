from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@db:5432/worldcup"
    secret_key: str = "change-me-in-production"
    google_client_id: str = ""
    google_client_secret: str = ""
    cors_origins: str = "http://localhost:3000"
    public_app_url: str = ""
    cron_secret: str = ""
    admin_emails: str = ""
    prize_pool_label: str = "Friends Pool 2026"
    prize_pool_amount_usd: str = "—"

    @property
    def cors_origin_list(self) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for raw in (self.cors_origins, self.public_app_url):
            for o in raw.split(","):
                o = o.strip().rstrip("/")
                if o and o not in seen:
                    seen.add(o)
                    out.append(o)
        return out

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
