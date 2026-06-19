from __future__ import annotations

import logging
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.user import User
from app.services import leaderboard_service, results_service

logger = logging.getLogger(__name__)


def _format_prediction(outcome: str | None, team_home: str, team_away: str) -> str:
    if not outcome:
        return "—"
    if outcome == "home":
        return team_home
    if outcome == "away":
        return team_away
    if outcome == "draw":
        return "Empate"
    return outcome


def _indicator_label(indicator: str) -> str:
    if indicator == "correct":
        return "✓"
    if indicator == "no_bet":
        return "sin apuesta"
    return "✗"


def _find_match_table(db: Session, match_id: uuid.UUID) -> dict | None:
    for table in results_service.list_finished_match_tables(db):
        if table["match_id"] == match_id:
            return table
    return None


def _build_email_content(table: dict, leaderboard_rows: list) -> tuple[str, str, str]:
    settings = get_settings()
    team_home = table["team_home"]
    team_away = table["team_away"]
    score_home = table["score_home"]
    score_away = table["score_away"]
    subject = f"Resultado final: {team_home} {score_home}-{score_away} {team_away}"

    app_url = settings.public_app_url.rstrip("/") if settings.public_app_url else ""
    app_line = f"\nVer la polla: {app_url}\n" if app_url else ""

    text_lines = [
        f"Resultado final: {team_home} {score_home}-{score_away} {team_away}",
        "",
        "Apuestas del partido:",
        "Usuario | Apuesta | Marcador | Pts",
        "--------|---------|----------|----",
    ]
    for row in table["rows"]:
        pick = _format_prediction(row["predicted_outcome"], team_home, team_away)
        score = row["predicted_score"] or "—"
        text_lines.append(
            f"{row['user_name']} | {pick} | {score} | {row['points_earned']} {_indicator_label(row['result_indicator'])}"
        )

    text_lines.extend(["", "Ranking actualizado:", "Pos | Jugador | Pts"])
    for idx, lb in enumerate(leaderboard_rows, start=1):
        text_lines.append(f"{idx} | {lb.name} | {lb.total_points}")
    text_lines.append(app_line)
    text_body = "\n".join(text_lines).strip()

    match_rows_html = ""
    for row in table["rows"]:
        pick = escape(_format_prediction(row["predicted_outcome"], team_home, team_away))
        score = escape(row["predicted_score"] or "—")
        match_rows_html += (
            f"<tr>"
            f"<td>{escape(row['user_name'])}</td>"
            f"<td>{pick}</td>"
            f"<td>{score}</td>"
            f"<td style='text-align:center'>{row['points_earned']}</td>"
            f"<td>{escape(_indicator_label(row['result_indicator']))}</td>"
            f"</tr>"
        )

    leaderboard_html = ""
    for idx, lb in enumerate(leaderboard_rows, start=1):
        leaderboard_html += (
            f"<tr><td>{idx}</td><td>{escape(lb.name)}</td><td style='text-align:center'>{lb.total_points}</td></tr>"
        )

    app_html = (
        f'<p style="margin-top:24px"><a href="{escape(app_url)}">Abrir VitoBet</a></p>'
        if app_url
        else ""
    )

    html_body = f"""
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
  <h2>Resultado final: {escape(team_home)} {score_home}-{score_away} {escape(team_away)}</h2>
  <h3>Apuestas del partido</h3>
  <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:720px">
    <thead>
      <tr style="background:#f3f4f6">
        <th align="left">Jugador</th>
        <th align="left">Apuesta</th>
        <th align="left">Marcador</th>
        <th>Pts</th>
        <th align="left">Estado</th>
      </tr>
    </thead>
    <tbody>{match_rows_html}</tbody>
  </table>
  <h3 style="margin-top:24px">Ranking actualizado</h3>
  <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:480px">
    <thead>
      <tr style="background:#f3f4f6">
        <th>#</th>
        <th align="left">Jugador</th>
        <th>Pts</th>
      </tr>
    </thead>
    <tbody>{leaderboard_html}</tbody>
  </table>
  {app_html}
</body>
</html>
""".strip()

    return subject, text_body, html_body


def _build_test_email_content(to_email: str) -> tuple[str, str, str]:
    settings = get_settings()
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    app_url = settings.public_app_url.rstrip("/") if settings.public_app_url else ""
    subject = "VitoBet — prueba de correo"

    team_home = "Chile"
    team_away = "Argentina"
    score_home = 2
    score_away = 1

    sample_bets = [
        {"user_name": "Vito", "pick": team_home, "score": "2-1", "points": 3, "indicator": "✓"},
        {"user_name": "Juan", "pick": "Empate", "score": "1-1", "points": 0, "indicator": "✗"},
        {"user_name": "María", "pick": team_away, "score": "0-2", "points": 0, "indicator": "✗"},
    ]
    sample_leaderboard = [
        {"name": "Vito", "points": 12},
        {"name": "María", "points": 9},
        {"name": "Juan", "points": 7},
    ]

    text_lines = [
        "VitoBet — correo de prueba",
        "",
        "Si recibes este mensaje, la configuración SMTP funciona correctamente.",
        "",
        "Cuando guardes un resultado real en el panel admin, todos los jugadores",
        "registrados recibirán un correo con el mismo formato (pero con datos reales).",
        "",
        "Vista previa de ejemplo (datos ficticios):",
        f"Resultado final: {team_home} {score_home}-{score_away} {team_away}",
        "",
        "Apuestas del partido:",
        "Usuario | Apuesta | Marcador | Pts",
        "--------|---------|----------|----",
    ]
    for row in sample_bets:
        text_lines.append(
            f"{row['user_name']} | {row['pick']} | {row['score']} | {row['points']} {row['indicator']}"
        )
    text_lines.extend(["", "Ranking actualizado:", "Pos | Jugador | Pts"])
    for idx, lb in enumerate(sample_leaderboard, start=1):
        text_lines.append(f"{idx} | {lb['name']} | {lb['points']}")
    text_lines.extend(
        [
            "",
            "---",
            f"Destinatario de esta prueba: {to_email}",
            f"Enviado: {timestamp}",
        ]
    )
    if app_url:
        text_lines.append(f"Ver la polla: {app_url}")
    text_body = "\n".join(text_lines).strip()

    match_rows_html = ""
    for row in sample_bets:
        match_rows_html += (
            f"<tr>"
            f"<td>{escape(row['user_name'])}</td>"
            f"<td>{escape(row['pick'])}</td>"
            f"<td>{escape(row['score'])}</td>"
            f"<td style='text-align:center'>{row['points']}</td>"
            f"<td>{escape(row['indicator'])}</td>"
            f"</tr>"
        )

    leaderboard_html = ""
    for idx, lb in enumerate(sample_leaderboard, start=1):
        leaderboard_html += (
            f"<tr><td>{idx}</td><td>{escape(lb['name'])}</td>"
            f"<td style='text-align:center'>{lb['points']}</td></tr>"
        )

    app_html = (
        f'<p style="margin-top:24px"><a href="{escape(app_url)}" '
        f'style="display:inline-block;padding:10px 18px;background:#059669;color:#fff;'
        f'text-decoration:none;border-radius:6px;font-weight:600">Abrir VitoBet</a></p>'
        if app_url
        else ""
    )

    html_body = f"""
<html>
<body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:720px;margin:0 auto;padding:16px">
  <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin-bottom:24px">
    <h2 style="margin:0 0 8px;color:#047857">Correo de prueba — SMTP OK</h2>
    <p style="margin:0;color:#065f46">
      Si ves este mensaje, la configuración de correo funciona. Los jugadores <strong>no</strong>
      recibieron este envío; solo llegó a tu cuenta de admin.
    </p>
  </div>
  <p style="color:#374151">
    Cuando guardes un resultado real, todos los registrados recibirán un correo con este mismo
    formato: resultado del partido, tabla de apuestas y ranking actualizado.
  </p>
  <p style="font-size:13px;color:#6b7280;margin-bottom:20px">
    <strong>Vista previa con datos de ejemplo</strong> (no corresponde a un partido real)
  </p>
  <h2 style="margin-top:0">Resultado final: {escape(team_home)} {score_home}-{score_away} {escape(team_away)}</h2>
  <h3>Apuestas del partido</h3>
  <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:720px;border-color:#e5e7eb">
    <thead>
      <tr style="background:#f3f4f6">
        <th align="left">Jugador</th>
        <th align="left">Apuesta</th>
        <th align="left">Marcador</th>
        <th>Pts</th>
        <th align="left">Estado</th>
      </tr>
    </thead>
    <tbody>{match_rows_html}</tbody>
  </table>
  <h3 style="margin-top:24px">Ranking actualizado</h3>
  <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:480px;border-color:#e5e7eb">
    <thead>
      <tr style="background:#f3f4f6">
        <th>#</th>
        <th align="left">Jugador</th>
        <th>Pts</th>
      </tr>
    </thead>
    <tbody>{leaderboard_html}</tbody>
  </table>
  {app_html}
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="font-size:12px;color:#6b7280;margin:0">
    Prueba enviada a {escape(to_email)} · {escape(timestamp)}
  </p>
</body>
</html>
""".strip()

    return subject, text_body, html_body


def _send_smtp(*, recipients: list[str], subject: str, text_body: str, html_body: str) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, recipients, msg.as_string())
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_from_email, recipients, msg.as_string())


def send_match_result_email(db: Session, match_id: uuid.UUID) -> tuple[bool, str | None]:
    settings = get_settings()
    if not settings.smtp_enabled:
        return False, "SMTP deshabilitado"

    table = _find_match_table(db, match_id)
    if not table:
        return False, "No se encontró la tabla del partido"

    recipients = list(db.scalars(select(User.email)).all())
    if not recipients:
        return False, "No hay usuarios registrados para enviar correo"

    try:
        leaderboard_rows = leaderboard_service.leaderboard(db)
        subject, text_body, html_body = _build_email_content(table, leaderboard_rows)
        _send_smtp(
            recipients=recipients,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        logger.info("Result email sent for match %s to %d recipients", match_id, len(recipients))
        return True, None
    except Exception as exc:
        logger.exception("Failed to send result email for match %s", match_id)
        return False, str(exc)


def send_test_email(to_email: str) -> tuple[bool, str | None]:
    settings = get_settings()
    if not settings.smtp_enabled:
        return False, "SMTP deshabilitado"

    try:
        subject, text_body, html_body = _build_test_email_content(to_email)
        _send_smtp(
            recipients=[to_email],
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        logger.info("Test email sent to %s", to_email)
        return True, None
    except Exception as exc:
        logger.exception("Failed to send test email to %s", to_email)
        return False, str(exc)
