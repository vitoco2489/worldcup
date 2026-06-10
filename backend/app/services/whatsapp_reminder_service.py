from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.bet import Bet
from app.models.match import Match
from app.models.user import User
from app.schemas.admin import UrgentMatchSummary, UserMissingUrgentBets, WhatsAppReminderResponse
from app.utils.time import get_current_time, lock_time_for_match_start

CHILE_TZ = ZoneInfo("America/Santiago")
URGENT_WINDOW_HOURS = 2


def _format_local(dt: datetime) -> str:
    local = dt.astimezone(CHILE_TZ)
    return local.strftime("%d/%m %H:%M")


def _match_label(m: Match) -> str:
    return f"{m.team_home} vs {m.team_away}"


def _minutes_until(start: datetime, now: datetime) -> int:
    return max(0, int((start - now).total_seconds() // 60))


def build_whatsapp_reminder(db: Session) -> WhatsAppReminderResponse:
    now = get_current_time(db=db)
    window_end = now + timedelta(hours=URGENT_WINDOW_HOURS)

    urgent_matches = list(
        db.scalars(
            select(Match)
            .where(
                Match.score_home.is_(None),
                Match.score_away.is_(None),
                Match.teams_resolved.is_(True),
                Match.start_time > now,
                Match.start_time <= window_end,
            )
            .order_by(Match.start_time.asc())
        ).all()
    )
    # Still bettable: more than 5 min before kickoff
    urgent_matches = [m for m in urgent_matches if now < lock_time_for_match_start(m.start_time)]

    users = list(db.scalars(select(User).order_by(User.name.asc())).all())
    match_summaries: list[UrgentMatchSummary] = [
        UrgentMatchSummary(
            match_id=m.id,
            team_home=m.team_home,
            team_away=m.team_away,
            start_time=m.start_time,
            minutes_until_start=_minutes_until(m.start_time, now),
        )
        for m in urgent_matches
    ]

    users_missing: list[UserMissingUrgentBets] = []
    if urgent_matches:
        match_ids = [m.id for m in urgent_matches]
        bets = list(
            db.scalars(
                select(Bet).where(
                    Bet.match_id.in_(match_ids),
                    Bet.user_id.in_([u.id for u in users]),
                )
            ).all()
        )
        bets_by_user_match: set[tuple[uuid.UUID, uuid.UUID]] = {
            (b.user_id, b.match_id) for b in bets
        }
        for user in users:
            missing_labels: list[str] = []
            for m in urgent_matches:
                if (user.id, m.id) not in bets_by_user_match:
                    missing_labels.append(_match_label(m))
            if missing_labels:
                users_missing.append(
                    UserMissingUrgentBets(
                        user_id=user.id,
                        name=user.name,
                        email=user.email,
                        missing_match_labels=missing_labels,
                    )
                )

    settings = get_settings()
    app_url = (settings.public_app_url or "http://localhost:3000").rstrip("/")
    message = _format_message(
        urgent_matches=urgent_matches,
        users_missing=users_missing,
        app_url=app_url,
        now=now,
    )

    return WhatsAppReminderResponse(
        hours_window=URGENT_WINDOW_HOURS,
        app_url=app_url,
        urgent_matches=match_summaries,
        users_missing=users_missing,
        message=message,
    )


def _format_message(
    *,
    urgent_matches: list[Match],
    users_missing: list[UserMissingUrgentBets],
    app_url: str,
    now: datetime,
) -> str:
    if not urgent_matches:
        return (
            "✅ *VitoBet*\n\n"
            f"No hay partidos sin apostar que empiecen en las próximas {URGENT_WINDOW_HOURS} horas "
            "(o ya cerraron las apuestas).\n\n"
            f"Entra al sitio: {app_url}"
        )

    lines = [
        "⚠️ *VitoBet — Recordatorio de apuestas*",
        "",
        f"Hola! Hay partidos que empiezan en *menos de {URGENT_WINDOW_HOURS} horas* "
        "y todavía hay gente sin apostar:",
        "",
        "*Partidos:*",
    ]
    for m in urgent_matches:
        mins = _minutes_until(m.start_time, now)
        h, rem = divmod(mins, 60)
        countdown = f"{h}h {rem}m" if h else f"{rem} min"
        lines.append(f"• {_match_label(m)} — {_format_local(m.start_time)} (en {countdown})")

    if users_missing:
        lines.extend(["", "*Pendientes de apostar:*"])
        for u in users_missing:
            if len(u.missing_match_labels) == 1:
                lines.append(f"• {u.name}")
            else:
                joined = ", ".join(u.missing_match_labels)
                lines.append(f"• {u.name} — falta: {joined}")

    lines.extend(
        [
            "",
            f"👉 Apuesta aquí: {app_url}",
            "",
            "Las apuestas cierran *5 minutos* antes del pitido inicial.",
        ]
    )
    return "\n".join(lines)
