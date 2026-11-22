import datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

PlaceCategory = Literal[
    "ATTRACTION",
    "RESTAURANT",
    "HOTEL",
    "AIRPORT",
    "TRANSIT",
    "ACTIVITY",
    "OTHER",
]


def _parse_hhmm_to_minutes(time_str: str) -> int:
    hours, minutes = time_str.split(":")
    return int(hours) * 60 + int(minutes)


def _normalize_currency(value: str) -> str:
    if isinstance(value, str):
        normalized = value.strip().upper()
        if not re.fullmatch(r"[A-Z]{3}", normalized):
            raise ValueError("Currency must be a 3-letter ISO 4217 code")
        return normalized
    return value


class PlaceInfo(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Name of the place or venue")
    address: str | None = Field(
        default=None,
        max_length=300,
        description="Street address or neighborhood",
    )
    category: PlaceCategory = Field(
        default="ATTRACTION",
        description="Semantic category of the place",
    )
    latitude: float | None = Field(
        default=None,
        ge=-90.0,
        le=90.0,
        description="Latitude coordinate if known",
    )
    longitude: float | None = Field(
        default=None,
        ge=-180.0,
        le=180.0,
        description="Longitude coordinate if known",
    )

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("address", mode="before")
    @classmethod
    def strip_address(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped if stripped else None


class ActivityTiming(BaseModel):
    start_time: str = Field(
        ...,
        pattern=r"^([01]\d|2[0-3]):[0-5]\d$",
        description="Start time in 24-hour HH:MM format",
    )
    end_time: str = Field(
        ...,
        pattern=r"^([01]\d|2[0-3]):[0-5]\d$",
        description="End time in 24-hour HH:MM format",
    )
    duration_minutes: int = Field(
        ...,
        gt=0,
        le=1440,
        description="Duration of the activity in minutes",
    )

    @model_validator(mode="after")
    def validate_time_order(self) -> "ActivityTiming":
        start_minutes = _parse_hhmm_to_minutes(self.start_time)
        end_minutes = _parse_hhmm_to_minutes(self.end_time)
        if end_minutes <= start_minutes:
            raise ValueError("end_time must be after start_time")
        expected_duration = end_minutes - start_minutes
        if self.duration_minutes != expected_duration:
            raise ValueError(
                f"duration_minutes ({self.duration_minutes}) must equal the difference between "
                f"start_time ({self.start_time}) and end_time ({self.end_time}) ({expected_duration} minutes)"
            )
        return self


class ItineraryActivity(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Short title of the activity")
    description: str = Field(
        ...,
        min_length=1,
        max_length=1500,
        description="Detailed description of the activity",
    )
    timing: ActivityTiming = Field(..., description="Scheduled timing details")
    place: PlaceInfo = Field(..., description="Location details for the activity")
    estimated_cost: float = Field(
        default=0.0,
        ge=0.0,
        description="Estimated total cost for this activity",
    )
    currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        description="3-letter uppercase ISO 4217 currency code",
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        description="Optional practical tips, booking advice, or constraint notes",
    )

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("notes", mode="before")
    @classmethod
    def strip_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped if stripped else None

    @field_validator("currency", mode="before")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return _normalize_currency(value)


class ItineraryDay(BaseModel):
    day_number: int = Field(..., ge=1, description="Sequential day number starting at 1")
    date: datetime.date | None = Field(
        default=None,
        description="Calendar date in YYYY-MM-DD format",
    )
    title: str = Field(..., min_length=1, max_length=200, description="Theme or title for the day")
    summary: str | None = Field(
        default=None,
        max_length=1000,
        description="Brief overview of the day's schedule",
    )
    activities: list[ItineraryActivity] = Field(
        ...,
        min_length=1,
        description="Ordered list of activities for the day",
    )
    daily_cost_total: float = Field(
        default=0.0,
        ge=0.0,
        description="Sum of estimated costs for all activities in this day",
    )

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("summary", mode="before")
    @classmethod
    def strip_summary(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped if stripped else None

    @model_validator(mode="after")
    def reconcile_daily_cost(self) -> "ItineraryDay":
        self.daily_cost_total = round(
            sum(activity.estimated_cost for activity in self.activities),
            2,
        )
        return self


class ItineraryOutput(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Title of the trip itinerary")
    summary: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="High-level summary of the itinerary",
    )
    currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        description="3-letter uppercase ISO 4217 currency code",
    )
    days: list[ItineraryDay] = Field(
        ...,
        min_length=1,
        description="Day-by-day itinerary breakdown",
    )
    total_estimated_cost: float = Field(
        default=0.0,
        ge=0.0,
        description="Total estimated cost across all itinerary days",
    )
    highlights: list[str] = Field(
        default_factory=list,
        description="Key highlights or travel recommendations",
    )

    @field_validator("title", "summary", mode="before")
    @classmethod
    def strip_required_fields(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return _normalize_currency(value)

    @model_validator(mode="after")
    def validate_days_and_totals(self) -> "ItineraryOutput":
        expected_day_numbers = list(range(1, len(self.days) + 1))
        actual_day_numbers = [day.day_number for day in self.days]
        if actual_day_numbers != expected_day_numbers:
            raise ValueError("day_number values must be sequential starting from 1")
        self.total_estimated_cost = round(
            sum(day.daily_cost_total for day in self.days),
            2,
        )
        return self
