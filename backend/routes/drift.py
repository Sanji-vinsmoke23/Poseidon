from fastapi import APIRouter, HTTPException
from models.schemas import DriftRequest, DriftResponse
from services.drift_service import calculate_backward_trajectory

router = APIRouter()

@router.post("/", response_model=DriftResponse)
async def simulate_drift(request: DriftRequest):
    try:
        result = calculate_backward_trajectory(
            lon=float(request.centroid[0]),
            lat=float(request.centroid[1]),
            timestamp=request.timestamp, # Pass the datetime object directly
            hours_backward=request.hours_backward
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drift simulation failed: {str(e)}")