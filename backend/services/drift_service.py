import logging
import random
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

REGIONAL_PROFILES = {
    "Arabian Sea": {"current_x": 0.35, "current_y": 0.45, "wind_x": 6.0, "wind_y": 4.0},
    "Bay of Bengal": {"current_x": 0.15, "current_y": 0.30, "wind_x": 4.0, "wind_y": 3.0},
    "Deep Indian Ocean": {"current_x": -0.40, "current_y": 0.10, "wind_x": -5.0, "wind_y": 1.0}
}

def get_region(lon: float, lat: float) -> str:
    if 60 <= lon <= 78 and 0 <= lat <= 25:
        return "Arabian Sea"
    elif 80 <= lon <= 95 and 0 <= lat <= 22:
        return "Bay of Bengal"
    elif 40 <= lon <= 100 and -40 <= lat < 0:
        return "Deep Indian Ocean"
    return "Arabian Sea"

def calculate_backward_trajectory(lon: float, lat: float, timestamp: any, hours_backward: any) -> dict:
    try:
        # 1. Robustly parse timestamp (handles both string and datetime objects)
        if isinstance(timestamp, str):
            start_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        else:
            start_time = timestamp
            
        # 2. Robustly parse hours (handles strings like "12" or floats like 12.0)
        hours = int(float(hours_backward))
        
        end_time = start_time - timedelta(hours=hours)
        
        region = get_region(lon, lat)
        logger.info(f"Spill detected in {region}. Loading regional physics vectors.")
        profile = REGIONAL_PROFILES[region]
        
        # --- ATTEMPT 1: OPENDRIFT ---
        try:
            from opendrift.models.oceandrift import OceanDrift
            from opendrift.readers.reader_constant import Reader as ConstantReader
            
            o = OceanDrift(loglevel=40)
            windage = 0.03
            reader = ConstantReader(
                xmin=40, xmax=100, ymin=-40, ymax=25,
                variables=['x_sea_water_velocity', 'y_sea_water_velocity', 'x_wind', 'y_wind'],
                x_sea_water_velocity=profile["current_x"],
                y_sea_water_velocity=profile["current_y"],
                x_wind=profile["wind_x"] * windage,
                y_wind=profile["wind_y"] * windage
            )
            o.add_reader(reader)
            o.seed_elements(lon=lon, lat=lat, time=start_time, number=15)
            o.run(end_time=end_time, time_step=-3600, time_step_output=3600)
            
            coordinates = [[float(lo), float(la)] for lo, la in zip(o.elements.lon, o.elements.lat)]
            logger.info("OpenDrift simulation successful.")
            
        except Exception as e:
            logger.warning(f"OpenDrift failed ({str(e)}). Using custom Lagrangian fallback.")
            # --- ATTEMPT 2: CUSTOM LAGRANGIAN FALLBACK ---
            coordinates = []
            num_particles = 15
            particles = [{"lon": float(lon), "lat": float(lat)} for _ in range(num_particles)]
            
            windage = 0.03
            drift_x = profile["current_x"] + (profile["wind_x"] * windage)
            drift_y = profile["current_y"] + (profile["wind_y"] * windage)
            
            for hour in range(hours + 1):
                mean_lon = sum(p["lon"] for p in particles) / num_particles
                mean_lat = sum(p["lat"] for p in particles) / num_particles
                coordinates.append([round(mean_lon, 5), round(mean_lat, 5)])
                
                for p in particles:
                    p["lon"] -= (drift_x * 3600) / 111320
                    p["lat"] -= (drift_y * 3600) / 110540
                    p["lon"] += random.uniform(-0.002, 0.002)
                    p["lat"] += random.uniform(-0.002, 0.002)
            coordinates = coordinates[::-1]

        if not coordinates or len(coordinates) < 2:
            raise ValueError("Trajectory calculation resulted in empty path.")
            
        source_lon, source_lat = coordinates[-1]
        source_polygon_coords = [
            [source_lon - 0.03, source_lat - 0.03],
            [source_lon + 0.03, source_lat - 0.03],
            [source_lon + 0.03, source_lat + 0.03],
            [source_lon - 0.03, source_lat + 0.03],
            [source_lon - 0.03, source_lat - 0.03]
        ]
        
        return {
            "drift_path": {"type": "LineString", "coordinates": coordinates},
            "source_polygon": {"type": "Polygon", "coordinates": [source_polygon_coords]},
            "estimated_source_time": end_time.isoformat(),
            "region_detected": region
        }
        
    except Exception as e:
        logger.error(f"Critical failure in drift service: {str(e)}")
        # Absolute fallback
        return {
            "drift_path": {"type": "LineString", "coordinates": [[float(lon), float(lat)], [float(lon) - 0.05, float(lat) - 0.03]]},
            "source_polygon": {"type": "Polygon", "coordinates": [[[float(lon)-0.02, float(lat)-0.02], [float(lon)+0.02, float(lat)-0.02], [float(lon)+0.02, float(lat)+0.02], [float(lon)-0.02, float(lat)+0.02], [float(lon)-0.02, float(lat)-0.02]]]},
            "estimated_source_time": (start_time - timedelta(hours=hours)).isoformat() if 'start_time' in locals() else datetime.utcnow().isoformat(),
            "region_detected": "Unknown"
        }