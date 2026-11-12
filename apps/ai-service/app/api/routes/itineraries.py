from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import LLMServiceDep, RequestIdDep, verify_service_key
from app.schemas.api import (
    GenerateItineraryData,
    GenerateItineraryRequest,
    GenerateItineraryResponse,
    OptimizeItineraryRequest,
    OptimizeItineraryResponse,
    RecoveryItineraryRequest,
    RecoveryItineraryResponse,
    ResponseMetadata,
)
from app.services.itinerary_service import generate_itinerary

router = APIRouter(
    prefix="/itineraries",
    tags=["Itineraries"],
    dependencies=[Depends(verify_service_key)],
)


@router.post(
    "/generate",
    response_model=GenerateItineraryResponse,
    summary="Generate a structured day-by-day itinerary",
)
async def generate_itinerary_endpoint(
    payload: GenerateItineraryRequest,
    llm: LLMServiceDep,
    request_id: RequestIdDep,
) -> GenerateItineraryResponse:
    effective_request_id = payload.request_id or request_id
    llm_result = await generate_itinerary(
        trip=payload.trip,
        llm=llm,
        options=payload.options,
    )

    return GenerateItineraryResponse(
        request_id=effective_request_id,
        data=GenerateItineraryData(
            trip_id=payload.trip_id,
            generation_job_id=payload.generation_job_id,
            itinerary=llm_result.content,
            metadata=ResponseMetadata(
                model=llm_result.model,
                latency_ms=llm_result.latency_ms,
                usage=llm_result.usage,
            ),
        ),
    )


@router.post(
    "/optimize",
    response_model=OptimizeItineraryResponse,
    summary="Optimize an existing itinerary (stub)",
)
async def optimize_itinerary_endpoint(
    payload: OptimizeItineraryRequest,
) -> OptimizeItineraryResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            f"Itinerary optimization for goal '{payload.optimization_goal}' "
            "is registered as a contract stub and not yet implemented."
        ),
    )


@router.post(
    "/recovery",
    response_model=RecoveryItineraryResponse,
    summary="Recover an itinerary from a travel disruption (stub)",
)
async def recovery_itinerary_endpoint(
    payload: RecoveryItineraryRequest,
) -> RecoveryItineraryResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            f"Disruption recovery for '{payload.disruption.type}' "
            "is registered as a contract stub and not yet implemented."
        ),
    )
