from __future__ import annotations

import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.match import Match
from app.schemas.social import DailyDigest
from app.services.pick_stats import count_predictions, popular_prediction
from app.utils.chile_time import chile_day_utc_bounds
from app.utils.time import get_current_time


def _match_label(match: Match) -> str:
    group_note = f" ({match.group_name})" if match.group_name else ""
    return f"{match.team_home} vs {match.team_away}{group_note}"


def _pick_variant(seed: str, options: list[str]) -> str:
    if not options:
        return ""
    idx = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(options)
    return options[idx]


def _has_lone_pick(counts: dict[str, int]) -> bool:
    total = counts["home"] + counts["draw"] + counts["away"]
    if total < 2:
        return False
    return any(counts[p] == 1 for p in ("home", "draw", "away"))


def _is_split_vote(counts: dict[str, int]) -> bool:
    total = counts["home"] + counts["draw"] + counts["away"]
    if total < 3:
        return False
    if min(counts["home"], counts["draw"], counts["away"]) == 0:
        return False
    _pop, pct = popular_prediction(counts)
    return pct < 75


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
        return DailyDigest(
            date=date_key,
            messages=[
                _pick_variant(
                    f"{date_key}:empty",
                    [
                        "Día libre de fútbol. Descansa la voz — mañana volvemos a webear.",
                        "Hoy no hay partidos. Aprovecha de inventar excusas para cuando pierdas.",
                        "Sin partidos hoy. El VAR también se tomó el día.",
                    ],
                )
            ],
        )

    upcoming = [m for m in matches if now < m.start_time]

    if len(upcoming) == 1:
        label = _match_label(upcoming[0])
        messages.append(
            _pick_variant(
                f"{date_key}:one",
                [
                    f"⚽ Hoy la pelota rueda en {label}. ¿Apostaste o estás haciendo el distraído?",
                    f"Un solo partido hoy: {label}. No hay excusa para quedar fuera de la polla.",
                    f"🎯 Día corto pero intenso: {label}. Cierra tu apuesta antes del pitido.",
                ],
            )
        )
    elif len(upcoming) > 1:
        n = len(upcoming)
        messages.append(
            _pick_variant(
                f"{date_key}:many",
                [
                    f"🔥 Agenda cargada: {n} partidos hoy. Corre antes del pitido — después no hay reclamo.",
                    f"{n} partidos en un día. La polla no perdona a los que dejan todo para el último minuto.",
                    f"📅 Maratón de {n} partidos. Cafecito, apuestas y a sufrir en compañía.",
                ],
            )
        )

    lone_matches: list[Match] = []
    split_matches: list[Match] = []
    for m in upcoming:
        counts = count_predictions(db, m.id)
        if _has_lone_pick(counts):
            lone_matches.append(m)
        elif _is_split_vote(counts):
            split_matches.append(m)

    if lone_matches:
        if len(lone_matches) == 1:
            label = _match_label(lone_matches[0])
            messages.append(
                _pick_variant(
                    f"{date_key}:lone:{lone_matches[0].id}",
                    [
                        f"🐺 En {label} hay un lobo solitario: alguien apostó distinto a todos. ¿Visionario o en otra?",
                        f"👀 {label} tiene disidente en las quinielas. Un alma valiente contra la manada.",
                        f"🎭 Drama en {label}: hay quien se tiró un verso que nadie más se animó. Sin decir quién.",
                    ],
                )
            )
        else:
            n = len(lone_matches)
            messages.append(
                _pick_variant(
                    f"{date_key}:lones",
                    [
                        f"🎲 {n} partidos con apuestas solitarias hoy. Alguien va a quedar como profeta… o como meme.",
                        f"Hoy hay {n} partidos con un rebelde en las quinielas. El chisme existe, los nombres no.",
                        f"🍿 {n} partidos con disidencia. La polla está picante y nadie sabe quién es quién.",
                    ],
                )
            )

    if split_matches:
        label = _match_label(split_matches[0])
        messages.append(
            _pick_variant(
                f"{date_key}:split:{split_matches[0].id}",
                [
                    f"🍿 {label} está partido al medio — las quinielas también. Puro caos sano.",
                    f"En {label} nadie se pone de acuerdo. Como reunión familiar, pero con goles.",
                    f"⚡ {label}: apuestas repartidas en tres bandos. Acá no hay consenso, hay personalidad.",
                ],
            )
        )

    best_draw: tuple[Match, int] | None = None
    for m in upcoming:
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
        m, _pct = best_draw
        label = _match_label(m)
        messages.append(
            _pick_variant(
                f"{date_key}:draw:{m.id}",
                [
                    f"🤝 En {label} el empate tiene fan club hoy. Ojo: el empate siempre acecha.",
                    f"En {label} varios ven tablas en las quinielas. El empate es el plot twist favorito.",
                    f"🎯 {label} huele a empate en las apuestas. No revelamos quién — solo el ambiente.",
                ],
            )
        )

    best_unanimous: tuple[Match, int] | None = None
    for m in upcoming:
        counts = count_predictions(db, m.id)
        _pop, pct = popular_prediction(counts)
        if pct < 75:
            continue
        if best_unanimous is None or pct > best_unanimous[1]:
            best_unanimous = (m, pct)

    if best_unanimous:
        m, pct = best_unanimous
        label = _match_label(m)
        messages.append(
            _pick_variant(
                f"{date_key}:uni:{m.id}",
                [
                    f"📢 En {label} casi todos piensan igual ({pct}%). ¿Coincidencia o manada?",
                    f"En {label} hay unanimidad ({pct}%) — sin decir por quién. La disidencia queda en silencio… por ahora.",
                    f"🧠 {label}: {pct}% alineados en las quinielas. Cuando todos coinciden, algo huele a trampa… o a acierto.",
                ],
            )
        )

    if len(messages) < 3:
        messages.append(
            _pick_variant(
                f"{date_key}:extra",
                [
                    "Recuerda: quien no apuesta, pierde puntos y pierde el derecho a webear después.",
                    "Hoy se define quién entiende de fútbol… y quién solo cree que entiende.",
                    "Cierra tus apuestas a tiempo. Después del pitido solo queda el llanto elegante.",
                    "La polla es entre amigos, pero el ego no perdona un mal pronóstico.",
                ],
            )
        )

    if not messages:
        messages.append(
            _pick_variant(
                f"{date_key}:quiet",
                [
                    "😴 Día de siesta futbolera — aún no hay chisme. Apuesta y despertamos el drama.",
                    "Tranquilo como VAR en amistoso. Falta que apuesten para armar cuento.",
                    "Todavía no hay material para el noticiero de la polla. ¡A la cancha de las apuestas!",
                ],
            )
        )

    seen: set[str] = set()
    unique: list[str] = []
    for msg in messages:
        if msg not in seen:
            seen.add(msg)
            unique.append(msg)

    return DailyDigest(date=date_key, messages=unique[:5])
