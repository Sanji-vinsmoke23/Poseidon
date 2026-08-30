from models.schemas import DetectionResponse, DriftResponse, Vessel
import random
from datetime import datetime, timedelta

def mock_detection(image_id: str) -> dict:
    # Simulate U-Net outputting a polygon around a centroid in the Arabian Sea
    base_lat, base_lon = 15.0, 70.0 
    poly_coords = [
        [base_lon - 0.01, base_lat - 0.01],
        [base_lon + 0.01, base_lat - 0.01],
        [base_lon + 0.01, base_lat + 0.01],
        [base_lon - 0.01, base_lat + 0.01],
        [base_lon - 0.01, base_lat - 0.01]
    ]
    return {
        "spill_detected": True,
        "confidence": 0.94,
        "spill_polygon": {"type": "Polygon", "coordinates": [poly_coords]},
        "centroid": [base_lon, base_lat],
        "timestamp": datetime.utcnow()
    }

def mock_drift(centroid: list, timestamp: datetime, hours: int) -> dict:
    start_lon, start_lat = centroid
    # Move slightly south-west to simulate wind/current drift backward
    end_lon, end_lat = start_lon - 0.05, start_lat - 0.03
    
    drift_path = {
        "type": "LineString",
        "coordinates": [[start_lon, start_lat], [end_lon, end_lat]]
    }
    source_poly = [
        [end_lon - 0.005, end_lat - 0.005],
        [end_lon + 0.005, end_lat - 0.005],
        [end_lon + 0.005, end_lat + 0.005],
        [end_lon - 0.005, end_lat + 0.005],
        [end_lon - 0.005, end_lat - 0.005]
    ]
    return {
        "source_polygon": {"type": "Polygon", "coordinates": [source_poly]},
        "drift_path": drift_path,
        "estimated_source_time": (timestamp - timedelta(hours=hours)).isoformat()
    }

def mock_vessels(bbox: list, start_time: datetime, end_time: datetime) -> list:
    # Simulate 2 vessels: 1 AIS, 1 Ghost Ship (Dark Vessel)
    return [
        {
            "mmsi": "419000000",
            "name": "OIL TANKER ALPHA",
            "is_ghost_ship": False,
            "trajectory": {
                "type": "LineString",
                "coordinates": [[70.0, 15.0], [69.9, 14.9]]
            }
        },
        {
            "mmsi": "UNKNOWN_CFR",
            "name": "DARK VESSEL 01",
            "is_ghost_ship": True,
            "trajectory": {
                "type": "LineString",
                "coordinates": [[69.95, 14.97], [69.85, 14.87]]
            }
        }
    ]
