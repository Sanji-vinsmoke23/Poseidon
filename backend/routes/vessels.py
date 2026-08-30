from fastapi import APIRouter
from models.schemas import VesselRequest, VesselsResponse
from services.mock_services import mock_vessels

router = APIRouter()

@router.post("/", response_model=VesselsResponse)
async def get_vessels(request: VesselRequest):
    # In the future, this will query the PostGIS database for AIS tracks
    return {"vessels": mock_vessels(request.bbox, request.start_time, request.end_time)}
