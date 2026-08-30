from fastapi import APIRouter, HTTPException
from models.schemas import DetectionRequest, DetectionResponse
from services.detection_service import detect_spill_real

router = APIRouter()

@router.post("/", response_model=DetectionResponse)
async def detect_spill(request: DetectionRequest):
    try:
        # Call the REAL trained U-Net model
        result = detect_spill_real(request.image_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")