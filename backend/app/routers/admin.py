from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_admin_user
from app.models.user import User
from app.repositories import match_repo, user_repo
from app.schemas.admin import (
    AdminManualBetRequest,
    AdminUserRow,
    AllowedEmailCreate,
    AllowedEmailRow,
    CsvRowError,
    EntryPaidUpdate,
    FinishedMatchTable,
    LockBetsResponse,
    MatchResultUpdateRequest,
    MatchResultUpdateResponse,
    MatchResultsBulkUpdateRequest,
    MatchResultsBulkUpdateResponse,
    MatchLoadCsvResponse,
    MatchLoadItem,
    MatchLoadResponse,
    ScheduleLoadRequest,
    ScheduleLoadResponse,
    PoolUpdateRequest,
    RepairScheduleResponse,
    ReResolveBetsResponse,
    ResetAllDataRequest,
    ResetAllDataResponse,
    ResetBetsRequest,
    ResetBetsResponse,
    ResetMatchesRequest,
    ResetMatchesResponse,
    ResetSimulationResponse,
    ServerTimeResponse,
    SimulateBetRequest,
    SimulateMatchRequest,
    SimulateTimeRequest,
    WhatsAppReminderResponse,
)
from app.schemas.bet import BetPublic
from app.schemas.pool import PoolPublic
from app.services import (
    admin_match_service,
    admin_ops_service,
    allowlist_service,
    bet_service,
    clock_service,
    match_service,
    pool_service,
    results_service,
    schedule_import_service,
    simulation_service,
    bracket_resolver_service,
    whatsapp_reminder_service,
)
from app.utils.time import get_current_time
from app.utils.admin import is_admin_email

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/whatsapp-reminder", response_model=WhatsAppReminderResponse)
def whatsapp_reminder(
    hours: int = Query(default=2, description="Ventana: 2, 6, 12, 24, 48, 72 u 168 horas"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    return whatsapp_reminder_service.build_whatsapp_reminder(db, hours_window=hours)


@router.get("/users", response_model=list[AdminUserRow])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    users = db.scalars(select(User).order_by(User.name.asc())).all()
    return [AdminUserRow(id=u.id, name=u.name, email=u.email, entry_paid=bool(u.entry_paid)) for u in users]


@router.patch("/users/{user_id}/entry-paid", response_model=AdminUserRow)
def set_user_entry_paid(
    user_id: uuid.UUID,
    body: EntryPaidUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.entry_paid = body.entry_paid
    db.commit()
    db.refresh(user)
    return AdminUserRow(id=user.id, name=user.name, email=user.email, entry_paid=bool(user.entry_paid))


@router.get("/allowed-emails", response_model=list[AllowedEmailRow])
def list_allowed_emails(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = allowlist_service.list_allowed(db)
    return [
        AllowedEmailRow(
            email=r.email,
            note=r.note,
            created_at=r.created_at,
            is_admin=is_admin_email(r.email),
        )
        for r in rows
    ]


@router.post("/allowed-emails", response_model=AllowedEmailRow)
def add_allowed_email(
    body: AllowedEmailCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    try:
        row = allowlist_service.add_allowed(db, body.email, note=body.note)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    db.commit()
    return AllowedEmailRow(
        email=row.email,
        note=row.note,
        created_at=row.created_at,
        is_admin=is_admin_email(row.email),
    )


@router.delete("/allowed-emails/{email}")
def remove_allowed_email(
    email: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    try:
        allowlist_service.remove_allowed(db, email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    db.commit()
    return {"ok": True}


@router.post("/load-schedule", response_model=ScheduleLoadResponse)
def load_schedule(
    body: ScheduleLoadRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    out = schedule_import_service.load_schedule_payload(
        db,
        body.model_dump(),
    )
    bracket_updated = bracket_resolver_service.refresh_bracket(db)
    db.commit()
    return ScheduleLoadResponse(
        tournament=out["tournament"],
        created=out["created"],
        skipped=out["skipped"],
        bracket_slots_updated=bracket_updated,
        error_count=out["error_count"],
        errors=out["errors"][:50],
    )


@router.post("/repair-schedule", response_model=RepairScheduleResponse)
def repair_schedule(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    try:
        payload = schedule_import_service.load_bundled_schedule_payload()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    out = schedule_import_service.repair_schedule_pairings(db, payload)
    orphans_removed = schedule_import_service.remove_orphan_knockout_matches(db)
    bracket_updated = bracket_resolver_service.refresh_bracket(db)
    db.commit()
    return RepairScheduleResponse(
        updated=out["updated"],
        bracket_slots_updated=bracket_updated,
        orphans_removed=orphans_removed,
        message="Knockout pairings synced from official schedule",
    )


@router.post("/load-matches", response_model=MatchLoadResponse)
def load_matches(
    body: list[MatchLoadItem],
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    created, skipped = admin_match_service.load_matches_from_payload(db, body)
    db.commit()
    return MatchLoadResponse(created=created, skipped=skipped)


@router.post("/update-match-result", response_model=MatchResultUpdateResponse)
def update_match_result(
    body: MatchResultUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    match_service.set_result_and_resolve(
        db,
        match_id=body.match_id,
        score_home=body.score_home,
        score_away=body.score_away,
        penalty_score_home=body.penalty_score_home,
        penalty_score_away=body.penalty_score_away,
    )
    db.commit()
    return MatchResultUpdateResponse(match_id=body.match_id, message="Match result saved")


@router.post("/update-match-results-bulk", response_model=MatchResultsBulkUpdateResponse)
def update_match_results_bulk(
    body: MatchResultsBulkUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    if not body.updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updated = 0
    for u in body.updates:
        match_service.set_result_and_resolve(
            db,
            match_id=u.match_id,
            score_home=u.score_home,
            score_away=u.score_away,
            penalty_score_home=u.penalty_score_home,
            penalty_score_away=u.penalty_score_away,
        )
        updated += 1
    db.commit()
    return MatchResultsBulkUpdateResponse(updated=updated, message="Bulk match results saved")


@router.post("/re-resolve-bets", response_model=ReResolveBetsResponse)
def re_resolve_bets(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    updated = bet_service.re_resolve_all_finished_bets(db)
    db.commit()
    return ReResolveBetsResponse(
        updated=updated,
        message="Bet points recalculated (90' groups / 120' knockout, no penalties)",
    )


@router.get("/finished-matches-table", response_model=list[FinishedMatchTable])
def finished_matches_table(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = results_service.list_finished_match_tables(db)
    return [FinishedMatchTable(**r) for r in rows]


@router.post("/load-matches-csv", response_model=MatchLoadCsvResponse)
async def load_matches_csv(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
    file: UploadFile = File(...),
):
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    created, skipped, errors = admin_match_service.load_matches_from_csv_text(db, text)
    db.commit()
    return MatchLoadCsvResponse(
        created=created,
        skipped=skipped,
        errors=[CsvRowError(row=e["row"], message=e["message"]) for e in errors],
    )


@router.put("/pool", response_model=PoolPublic)
def update_pool(
    body: PoolUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    admin_ops_service.set_pool_total_usd(db, body.pool_total)
    db.commit()
    return pool_service.get_pool(db)


@router.post("/simulate-match")
def simulate_match(
    body: SimulateMatchRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    admin_ops_service.simulate_match_result(
        db,
        match_id=body.match_id,
        score_home=body.score_home,
        score_away=body.score_away,
        status=body.status,
    )
    db.commit()
    return {"ok": True, "match_id": str(body.match_id)}


@router.post("/simulate-bet", response_model=BetPublic)
def simulate_bet(
    body: SimulateBetRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    bet = simulation_service.simulate_bet_for_user(
        db,
        user_id=body.user_id,
        match_id=body.match_id,
        score_home=body.score_home,
        score_away=body.score_away,
    )
    m = match_repo.get_by_id(db, bet.match_id)
    if not m:
        raise HTTPException(status_code=500, detail="Match missing after simulation")
    out = bet_service.bet_to_public(bet, m, db=db)
    db.commit()
    return out


@router.post("/manual-bet", response_model=BetPublic)
def manual_bet(
    body: AdminManualBetRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    user = user_repo.get_by_id(db, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    out = bet_service.admin_create_or_update_manual_bet(
        db,
        user_id=body.user_id,
        match_id=body.match_id,
        prediction=body.prediction,
        predicted_score_home=body.predicted_score_home,
        predicted_score_away=body.predicted_score_away,
    )
    db.commit()
    return out


@router.post("/reset-simulation", response_model=ResetSimulationResponse)
def reset_simulation(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    out = simulation_service.reset_simulation(db)
    db.commit()
    return ResetSimulationResponse(**out)


@router.post("/simulate-time", response_model=ServerTimeResponse)
def simulate_time(
    body: SimulateTimeRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    clock_service.set_simulated_at(db, body.current_time)
    db.commit()
    now = get_current_time(db=db)
    return ServerTimeResponse(now=now, is_simulated=True)


@router.post("/reset-time", response_model=ServerTimeResponse)
def reset_time(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    clock_service.clear_simulated_at(db)
    db.commit()
    now = get_current_time(db=db)
    return ServerTimeResponse(now=now, is_simulated=False)


@router.post("/lock-bets/{match_id}", response_model=LockBetsResponse)
def lock_bets_for_match(
    match_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    n = admin_ops_service.force_lock_bets_for_match(db, match_id)
    db.commit()
    return LockBetsResponse(bets_locked=n)


@router.post("/reset-all-data", response_model=ResetAllDataResponse)
def reset_all_data(
    body: ResetAllDataRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    if body.confirm != "CONFIRM RESET":
        raise HTTPException(status_code=400, detail="Confirmation text must be exactly 'CONFIRM RESET'")
    out = admin_ops_service.reset_all_data(db)
    db.commit()
    return ResetAllDataResponse(**out)


@router.post("/reset-bets", response_model=ResetBetsResponse)
def reset_bets(
    body: ResetBetsRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    if body.confirm != "DELETE BETS":
        raise HTTPException(status_code=400, detail="Confirmation text must be exactly 'DELETE BETS'")
    out = admin_ops_service.reset_bets_only(db)
    db.commit()
    return ResetBetsResponse(**out)


@router.post("/reset-matches", response_model=ResetMatchesResponse)
def reset_matches(
    body: ResetMatchesRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    if body.confirm != "DELETE ALL":
        raise HTTPException(status_code=400, detail="Confirmation text must be exactly 'DELETE ALL'")
    out = admin_ops_service.reset_matches(db)
    db.commit()
    return ResetMatchesResponse(**out)
