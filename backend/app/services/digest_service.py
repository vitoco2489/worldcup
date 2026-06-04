from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.schemas.social import DailyDigest
from app.services.pick_stats import count_predictions, popular_prediction, sole_picker
from app.utils.chile_time import chile_day_utc_bounds
from app.utils.time import get_current_time


def _side_label(match: Match, prediction: str) -> str:
    if prediction == "home":
        return match.team_home
    if prediction == "away":
        return match.team_away
    return "empate"


def daily_digest(db: Session, date_key: str) -> DailyDigest:
    start_utc, end_utc = chile_day_utc_bounds(date_key)
    now = get_current_time(db=db)
    matches = list(
        db.scalars(
            select(Match)
            .where(Match.start_time >= start_utc, Match.start_time < end_utc)
            .order_by(Match.start_time.asc())
        ).all()
    )

    messages: list[str] = []

    if not matches:
        return DailyDigest(date=date_key, messages=["No hay partidos este día — el drama llegará pronto."])

    # Lone wolf picks (only one person on a side, at least 2 bettors)
    for m in matches:
        if now >= m.start_time:
            continue
        counts = count_predictions(db, m.id)
        total = counts["home"] + counts["draw"] + counts["away"]
        if total < 2:
            continue
        for pred in ("home", "draw", "away"):
            if counts[pred] != 1:
                continue
            name = sole_picker(db, m.id, pred)
            if not name:
                continue
            side = _side_label(m, pred)
            group_note = f" ({m.group_name})" if m.group_name else ""
            messages.append(
                f"Hoy {name} va solo contra todos en {m.team_home} vs {m.team_away}{group_note} — apostó por {side}."
            )

    # Most picked draw today
    best_draw: tuple[Match, int] | None = None
    for m in matches:
        counts = count_predictions(db, m.id)
        total = counts["home"] + counts["draw"] + counts["away"]
        if total == 0:
            continue
        draw_pct = round(counts["draw"] / total * 100)
        if draw_pct <= 0:
            continue
        if best_draw is None or draw_pct > best_draw[1]:
            best_draw = (m, draw_pct)

    if best_draw:
        m, pct = best_draw
        messages.append(f"Empate más apostado del día: {pct}% en {m.team_home} vs {m.team_away}.")

    # Most unanimous pick
    best_unanimous: tuple[Match, str, int] | None = None
    for m in matches:
        counts = count_predictions(db, m.id)
        pop, pct = popular_prediction(counts)
        if pop is None or pct < 75:
            continue
        if best_unanimous is None or pct > best_unanimous[2]:
            best_unanimous = (m, pop, pct)

    if best_unanimous:
        m, pop, pct = best_unanimous
        side = _side_label(m, pop)
        messages.append(f"Casi todos coinciden ({pct}%): {side} en {m.team_home} vs {m.team_away}.")

    # Group-specific lone in group stage
    groups = {m.group_name for m in matches if m.group_name}
    for group in sorted(groups):
        group_matches = [m for m in matches if m.group_name == group]
        for m in group_matches:
            counts = count_predictions(db, m.id)
            total = counts["home"] + counts["draw"] + counts["away"]
            if total < 2:
                continue
            for pred in ("home", "draw", "away"):
                if counts[pred] != 1:
                    continue
                name = sole_picker(db, m.id, pred)
                if name:
                    messages.append(f"En {group}, {name} es el único que ve {_side_label(m, pred)} en {m.team_home} vs {m.team_away}.")

    if not messages:
        messages.append("Día tranquilo — todavía no hay apuestas suficientes para armar el chisme.")

    # De-dupe while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for msg in messages:
        if msg not in seen:
            seen.add(msg)
            unique.append(msg)

    return DailyDigest(date=date_key, messages=unique[:5])
