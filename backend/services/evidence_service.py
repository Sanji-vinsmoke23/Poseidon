import hashlib
import json
from datetime import datetime
from typing import Dict, Any

def generate_evidence_package(case_id: str, detection: Dict, drift: Dict, attribution: Dict) -> Dict[str, Any]:
    evidence_data = {
        "case_id": case_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "detection_summary": {
            "spill_detected": detection.get("spill_detected"),
            "confidence": detection.get("confidence"),
            "centroid": detection.get("centroid")
        },
        "drift_summary": {
            "engine": drift.get("engine"),
            "ensemble_count": drift.get("ensemble_count"),
            "uncertainty_radius_km": drift.get("uncertainty", {}).get("radius_km")
        },
        "attribution_summary": {
            "top_candidate_mmsi": attribution.get("top_candidate", {}).get("mmsi"),
            "top_candidate_name": attribution.get("top_candidate", {}).get("name"),
            "confidence_score": attribution.get("top_candidate", {}).get("total_score"),
            "explanation": attribution.get("explanation")
        }
    }
    
    # Generate SHA-256 hash of the evidence data
    json_str = json.dumps(evidence_data, sort_keys=True)
    sha256_hash = hashlib.sha256(json_str.encode('utf-8')).hexdigest()
    
    evidence_data["cryptographic_seal"] = {
        "algorithm": "SHA-256",
        "hash": sha256_hash,
        "message": "This hash guarantees the integrity of the evidence package. Any alteration to the data will invalidate this hash."
    }
    
    return evidence_data
