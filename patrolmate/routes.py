"""API routes for PatrolMate."""
from __future__ import annotations

from datetime import datetime
from http import HTTPStatus

from flask import Blueprint, jsonify, render_template, request

from .extensions import db
from .models import PatrolLog


PATROL_TARGETS: list[dict[str, object]] = [
    {
        "id": "main-1f-101-time",
        "building": "本館",
        "floor": "1F",
        "room": "電気室101",
        "patrol_attribute": "時間指定",
        "time_window": "08:00-10:00",
        "schedule": {"days_of_week": [0, 1, 2, 3, 4]},
        "items": [
            {
                "id": "main-1f-101-voltage",
                "name": "受電電圧",
                "category": "数値確認",
                "type": "numeric",
                "unit": "V",
                "guidance": "基準値 200±5V を確認",
            },
            {
                "id": "main-1f-101-ac",
                "name": "空調機稼働状況",
                "category": "稼働状況確認",
                "type": "status",
                "options": ["運転中", "停止", "異常"],
                "guidance": "室内温度に異常がないか確認",
            },
            {
                "id": "main-1f-101-earth",
                "name": "漏電遮断器表示灯",
                "category": "boolチェック項目",
                "type": "boolean",
                "check_label": "異常ランプが消灯している",
            },
        ],
    },
    {
        "id": "main-1f-101-daily",
        "building": "本館",
        "floor": "1F",
        "room": "電気室101",
        "patrol_attribute": "日次",
        "schedule": {"days_of_week": list(range(0, 7))},
        "items": [
            {
                "id": "main-1f-101-panel",
                "name": "分電盤温度",
                "category": "数値確認",
                "type": "numeric",
                "unit": "℃",
                "guidance": "赤外線温度計で主幹部を測定",
            },
            {
                "id": "main-1f-101-sound",
                "name": "異音の有無",
                "category": "boolチェック項目",
                "type": "boolean",
                "check_label": "機器から異音がしない",
            },
        ],
    },
    {
        "id": "main-2f-201-weekly",
        "building": "本館",
        "floor": "2F",
        "room": "サーバールーム201",
        "patrol_attribute": "週次",
        "schedule": {"days_of_week": [0, 3]},
        "items": [
            {
                "id": "main-2f-201-temp",
                "name": "室温",
                "category": "数値確認",
                "type": "numeric",
                "unit": "℃",
                "guidance": "目標 22±2℃",
            },
            {
                "id": "main-2f-201-uptime",
                "name": "ラック電源稼働",
                "category": "稼働状況確認",
                "type": "status",
                "options": ["正常", "UPS運転", "停止"],
            },
            {
                "id": "main-2f-201-door",
                "name": "入退室管理ログ",
                "category": "boolチェック項目",
                "type": "boolean",
                "check_label": "不審な入室履歴なし",
            },
        ],
    },
    {
        "id": "annex-b1-plant-monthly",
        "building": "別館",
        "floor": "B1",
        "room": "機械室B1",
        "patrol_attribute": "月次",
        "schedule": {"days_of_month": [1, 15]},
        "items": [
            {
                "id": "annex-b1-pressure",
                "name": "ポンプ吐出圧",
                "category": "数値確認",
                "type": "numeric",
                "unit": "MPa",
                "guidance": "仕様値 0.45〜0.55MPa",
            },
            {
                "id": "annex-b1-running",
                "name": "予備ポンプ試運転",
                "category": "稼働状況確認",
                "type": "status",
                "options": ["正常", "異常振動", "起動不可"],
            },
            {
                "id": "annex-b1-leak",
                "name": "配管漏れ",
                "category": "boolチェック項目",
                "type": "boolean",
                "check_label": "目視で漏れなし",
            },
        ],
    },
    {
        "id": "central-roof-tank-yearly",
        "building": "中央棟",
        "floor": "屋上",
        "room": "受水槽",
        "patrol_attribute": "年次",
        "schedule": {"months": [4], "days_of_month": [10]},
        "items": [
            {
                "id": "central-roof-water-level",
                "name": "水位計校正",
                "category": "数値確認",
                "type": "numeric",
                "unit": "mm",
                "guidance": "基準水位との差分を記録",
            },
            {
                "id": "central-roof-pump",
                "name": "補給ポンプ稼働",
                "category": "稼働状況確認",
                "type": "status",
                "options": ["正常", "異音あり", "起動不可"],
            },
            {
                "id": "central-roof-sanit",
                "name": "消毒装置確認",
                "category": "boolチェック項目",
                "type": "boolean",
                "check_label": "残留塩素濃度が基準内",
            },
        ],
    },
]


api_bp = Blueprint("api", __name__, url_prefix="/api")
pages_bp = Blueprint("pages", __name__)


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        # Only the date portion is required; ignore any time component.
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _matches_schedule(target: dict[str, object], selected_date: datetime | None) -> bool:
    if selected_date is None:
        return True

    schedule = target.get("schedule")
    if not isinstance(schedule, dict):
        return True

    weekday = selected_date.weekday()
    day = selected_date.day
    month = selected_date.month

    days_of_week = schedule.get("days_of_week")
    if isinstance(days_of_week, list) and weekday not in days_of_week:
        return False

    days_of_month = schedule.get("days_of_month")
    if isinstance(days_of_month, list) and day not in days_of_month:
        return False

    months = schedule.get("months")
    if isinstance(months, list) and month not in months:
        return False

    return True


def _matches_room(target: dict[str, object], room_query: str | None) -> bool:
    if not room_query:
        return True

    room_value = str(target.get("room", ""))
    return room_query in room_value


@pages_bp.get("/")
def dashboard():
    """Render the patrol log dashboard."""
    return render_template("index.html")


@api_bp.get("/targets")
def list_targets():
    """Return patrol targets filtered by date, attribute, and room."""

    selected_date = _parse_date(request.args.get("date"))
    attribute = (request.args.get("attribute") or "").strip()
    room = (request.args.get("room") or "").strip()

    room_query = room if room else None

    filtered_targets = []
    for target in PATROL_TARGETS:
        if attribute and target.get("patrol_attribute") != attribute:
            continue

        if not _matches_schedule(target, selected_date):
            continue

        if not _matches_room(target, room_query):
            continue

        filtered_targets.append(target)

    return jsonify(
        {
            "filters": {
                "date": selected_date.date().isoformat() if selected_date else None,
                "attribute": attribute or None,
                "room": room_query,
            },
            "targets": filtered_targets,
        }
    )


@api_bp.get("/logs")
def list_logs():
    """Return all patrol logs ordered from newest to oldest."""
    logs = PatrolLog.query.order_by(PatrolLog.created_at.desc()).all()
    return jsonify([log.to_dict() for log in logs])


@api_bp.post("/logs")
def create_log():
    """Create a new patrol log entry."""
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    notes = payload.get("notes")

    if not title:
        return (
            jsonify({"error": "'title' is required"}),
            HTTPStatus.BAD_REQUEST,
        )

    log = PatrolLog(title=title, notes=notes)
    db.session.add(log)
    db.session.commit()

    response = jsonify(log.to_dict())
    response.status_code = HTTPStatus.CREATED
    return response
