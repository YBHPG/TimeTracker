import calendar
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import DEFAULT_TZ


def get_zone(tz_name: str) -> ZoneInfo:
    """Resolves an IANA timezone name. Raises ValueError on an unknown zone."""
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError(f"Unknown timezone: {tz_name}")


def today_in_tz(tz_name: str) -> date:
    """Returns the current date in the given timezone."""
    return datetime.now(get_zone(tz_name)).date()


def parse_iso_date(value: str) -> date:
    """Parses a YYYY-MM-DD string into a date."""
    return date.fromisoformat(value)


def resolve_period(period: str, anchor: date) -> tuple[date, date]:
    """Returns inclusive (from, to) bounds of a named period around an anchor date."""
    if period == "day":
        return anchor, anchor
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())  # Monday
        return start, start + timedelta(days=6)
    if period == "month":
        last_day = calendar.monthrange(anchor.year, anchor.month)[1]
        return anchor.replace(day=1), anchor.replace(day=last_day)
    raise ValueError(f"Unknown period: {period}")


def previous_range(from_date: date, to_date: date) -> tuple[date, date]:
    """Returns the immediately preceding range of the same length."""
    length = (to_date - from_date).days + 1
    prev_to = from_date - timedelta(days=1)
    prev_from = prev_to - timedelta(days=length - 1)
    return prev_from, prev_to


def resolve_range(tz_name: str, period: str | None, anchor: str | None) -> tuple[date, date]:
    """Resolves an inclusive (from, to) date range from a period/anchor or explicit anchor day."""
    anchor_date = parse_iso_date(anchor) if anchor else today_in_tz(tz_name)
    return resolve_period(period, anchor_date)
