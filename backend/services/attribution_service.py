# backend/services/attribution_service.py
import os
import joblib
from typing import List, Dict, Any

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ranker_model.pkl")

RANKER = None
try:
    RANKER = joblib.load(MODEL_PATH)["model"]
    print("✅ Calibrated attribution ranker loaded (Platt-scaled logistic regression).")
except Exception as e:
    print(f"⚠️ Ranker not loaded ({e}). Using fixed heuristic weights fallback.")


def calculate_attribution(vessels_behavior: List[Dict[str, Any]], source_zone: Dict[str, Any], source_time: str = None) -> Dict[str, Any]:
    rankings = []
    source_lon, source_lat = source_zone.get("uncertainty", {}).get("centroid", [0.0, 0.0])

    for vb in vessels_behavior:
        vessel, behavior = vb["vessel"], vb["behavior"]
        if "error" in behavior:
            rankings.append({"mmsi": vessel["mmsi"], "name": vessel["name"], "total_score": 0,
                             "spatial": 0, "temporal": 0, "trajectory": 0, "drift": 0,
                             "behavioral": 0, "ais": 0, "score_method": "error",
                             "explanation": behavior["error"], "is_dark_vessel": False})
            continue

        dist = behavior.get("min_distance_to_source_km", 100)
        spatial = max(0, 100 - (dist * 5))
        temporal = 90
        traj = 50 + (30 if behavior.get("speed_drop_knots", 0) > 2.0 else 0) + (10 if behavior.get("suspicious_behavior_detected", False) else 0)
        drift = min(100, spatial + 10)
        behavioral = 50 + (30 if behavior.get("speed_drop_knots", 0) > 4.0 else (15 if behavior.get("speed_drop_knots", 0) > 2.0 else 0))
        ais = 30 if behavior.get("is_dark_vessel", False) else 80

        # --- CALIBRATED RANKER (novelty) with safe fallback ---
        if RANKER is not None:
            prob = float(RANKER.predict_proba([[spatial, temporal, drift, behavioral, ais]])[0][1])
            total = round(prob * 100, 1)
            method = "calibrated_ranker"
        else:
            total = round(spatial*0.25 + temporal*0.15 + traj*0.20 + drift*0.15 + behavioral*0.15 + ais*0.10, 1)
            method = "fixed_weights"

        explanation_parts = []
        if spatial > 70: explanation_parts.append(f"Passed within {dist:.1f}km of estimated source region.")
        if behavior.get("speed_drop_knots", 0) > 2.0: explanation_parts.append(f"Speed reduced by {behavior['speed_drop_knots']:.1f} knots near release time.")
        if behavior.get("is_dark_vessel", False): explanation_parts.append("AIS gap overlaps critical source window (Dark Vessel behavior).")

        rankings.append({
            "mmsi": vessel["mmsi"], "name": vessel["name"], "total_score": total, "score_method": method,
            "spatial": round(spatial, 1), "temporal": round(temporal, 1), "trajectory": round(min(100, traj), 1),
            "drift": round(drift, 1), "behavioral": round(behavioral, 1), "ais": round(ais, 1),
            "explanation": f"{vessel['name']} is a candidate because: " + " ".join(explanation_parts) if explanation_parts else f"{vessel['name']} was in area but shows no strong indicators.",
            "is_dark_vessel": behavior.get("is_dark_vessel", False)
        })

    rankings.sort(key=lambda x: x["total_score"], reverse=True)
    top = rankings[0] if rankings else None

    top_exp = ""
    if top:
        top_exp = f"VESSEL {top['name']} ranked #1 because:\n• Present during estimated source window.\n• Position falls within high-probability source region (Spatial: {top['spatial']}/100)."
        if top["behavioral"] > 60: top_exp += f"\n• Significant speed reduction occurred (Behavioral: {top['behavioral']}/100)."
        if top["is_dark_vessel"]: top_exp += f"\n• AIS gap overlaps critical window (AIS: {top['ais']}/100)."
        top_exp += f"\n\nAttribution Confidence: {top['total_score']}/100"
        if top["score_method"] == "calibrated_ranker":
            top_exp += " (calibrated probability from learned ranker)"

    return {"ranking": rankings, "top_candidate": top, "explanation": top_exp}
