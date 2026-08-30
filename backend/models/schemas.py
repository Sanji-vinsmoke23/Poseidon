from pydantic import BaseModel, Field
from typing import List, Dict, Any
from datetime import datetime

class DetectionRequest(BaseModel):
    image_id: str = Field(..., description="ID of the Sentinel-1 SAR image chip")

class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class GeoJSONLineString(BaseModel):
    type: str = "LineString"
    coordinates: List[List[float]]

class DetectionResponse(BaseModel):
    spill_detected: bool
    confidence: float
    spill_polygon: GeoJSONPolygon
    centroid: List[float]
    timestamp: datetime

class DriftRequest(BaseModel):
    centroid: List[float]
    timestamp: datetime
    hours_backward: int = 12

class DriftResponse(BaseModel):
    source_polygon: GeoJSONPolygon
    drift_path: GeoJSONLineString
    estimated_source_time: str

class VesselRequest(BaseModel):
    bbox: List[float] # [min_lon, min_lat, max_lon, max_lat]
    start_time: datetime
    end_time: datetime

class Vessel(BaseModel):
    mmsi: str
    name: str
    is_ghost_ship: bool
    trajectory: GeoJSONLineString

class VesselsResponse(BaseModel):
    vessels: List[Vessel]
