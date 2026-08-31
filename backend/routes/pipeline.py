from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
import random

# Import the services we just created
from backend.services import drift_service, attribution_service, evidence_service

router = APIRouter()

class PipelineRequest(BaseModel):
    spill_lon: float
    spill_lat: float
    timestamp: str
    case_id: str = "DEMO-001"

@router.post("/api/v1/pipeline/run")
async def run_full_pipeline(request: PipelineRequest):
    # 1. Mock Detection (In real app, this calls the U-Net model)
    detection_result = {
        "spill_detected": True,
        "confidence": 94.2,
        "centroid": [request.spill_lon, request.spill_lat],
        "area_km2": round(random.uniform(2.0, 5.0), 1)
    }
    
    # 2. Run Ensemble Drift
    drift_result = drift_service.calculate_backward_trajectory(
        lon=request.spill_lon, 
        lat=request.spill_lat, 
        timestamp=request.timestamp, 
        hours_backward=12, 
        num_ensemble=10
    )
    
    # 3. Mock Vessel Query (In real app, this queries PostGIS)
    # We simulate 3 candidates: one dark vessel (the culprit), two innocent
    vessels_behavior = [
        {
            "vessel": {"mmsi": "419000123", "name": "MAERSK TITAN"},
            "behavior": {"min_distance_to_source_km": 1.2, "speed_drop_knots": 4.5, "suspicious_behavior_detected": True, "is_dark_vessel": True}
        },
        {
            "vessel": {"mmsi": "419000456", "name": "OCEAN VOYAGER"},
            "behavior": {"min_distance_to_source_km": 15.4, "speed_drop_knots": 0.0, "suspicious_behavior_detected": False, "is_dark_vessel": False}
        },
        {
            "vessel": {"mmsi": "419000789", "name": "INDIAN OCEANIC"},
            "behavior": {"min_distance_to_source_km": 45.0, "speed_drop_knots": 0.0, "suspicious_behavior_detected": False, "is_dark_vessel": False}
        }
    ]
    
    # 4. Run Attribution Scoring
    attribution_result = attribution_service.calculate_attribution(
        vessels_behavior=vessels_behavior,
        source_zone=drift_result
    )
    
    # 5. Generate Cryptographic Evidence Package
    evidence_package = evidence_service.generate_evidence_package(
        case_id=request.case_id,
        detection=detection_result,
        drift=drift_result,
        attribution=attribution_result
    )
    
    return {
        "status": "success",
        "pipeline": "complete",
        "detection": detection_result,
        "drift": drift_result,
        "attribution": attribution_result,
        "evidence_package": evidence_package
    }
