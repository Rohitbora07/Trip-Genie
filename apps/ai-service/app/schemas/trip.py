import datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

TravelPace = Literal["relaxed", "moderate", "packed"]


def _clean_string_list(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for item in values:
        stripped = item.strip()
        if stripped:
            cleaned.append(stripped)
    return cleaned


class TravelPreferences(BaseModel):
    pace: TravelPace | None = Field(default=None)
    interests: list[str] = Field(default_factory=list, max_length=20)
    accommodation_style: str | None = Field(default=None, max_length=100)
    transport_preference: str | None = Field(default=None, max_length=100)

    @field_validator("interests")
    @classmethod
    def validate_interests(cls, value: list[str]) -> list[str]:
        return _clean_string_list(value)

    @field_validator("accommodation_style", "transport_preference", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped if stripped else None


class TripConstraints(BaseModel):
    dietary: list[str] = Field(default_factory=list, max_length=20)
    accessibility: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("dietary", "accessibility")
    @classmethod
    def validate_constraints(cls, value: list[str]) -> list[str]:
        return _clean_string_list(value)


class TripInput(BaseModel):
    destination: str = Field(..., min_length=2, max_length=200)
    origin: str | None = Field(default=None, min_length=2, max_length=200)
    start_date: datetime.date
    end_date: datetime.date
    traveler_count: int = Field(default=1, ge=1, le=50)
    budget: float | None = Field(default=None, ge=0.0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    preferences: TravelPreferences | None = Field(default=None)
    constraints: TripConstraints | None = Field(default=None)
    additional_instructions: str | None = Field(default=None, max_length=2000)

    @field_validator("destination", mode="before")
    @classmethod
    def strip_destination(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("origin", "additional_instructions", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped if stripped else None

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        if isinstance(value, str):
            normalized = value.strip().upper()
            if not re.fullmatch(r"[A-Z]{3}", normalized):
                raise ValueError("Currency must be a 3-letter ISO 4217 code")
            return normalized
        return value

    @model_validator(mode="after")
    def validate_dates(self) -> "TripInput":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        duration = (self.end_date - self.start_date).days + 1
        if duration > 30:
            raise ValueError("Trip duration cannot exceed 30 days")
        return self

    @property
    def duration_days(self) -> int:
        return (self.end_date - self.start_date).days + 1
