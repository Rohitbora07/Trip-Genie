from fastapi import APIRouter, Depends

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
from app.services.optimization_service import optimize_itinerary
from app.workflows.disruption_recovery import recover_itinerary

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
    summary="Optimize an existing itinerary with geographic clustering and budget trimming",
)
async def optimize_itinerary_endpoint(
    payload: OptimizeItineraryRequest,
    request_id: RequestIdDep,
) -> OptimizeItineraryResponse:
    if not payload.request_id:
        payload.request_id = request_id
    return optimize_itinerary(payload)


@router.post(
    "/recovery",
    response_model=RecoveryItineraryResponse,
    summary="Recover an itinerary from a travel disruption",
)
async def recovery_itinerary_endpoint(
    payload: RecoveryItineraryRequest,
    request_id: RequestIdDep,
) -> RecoveryItineraryResponse:
    if not payload.request_id:
        payload.request_id = request_id
    return await recover_itinerary(payload)
