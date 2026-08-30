import torch
import cv2
import numpy as np
from skimage import measure
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from .model import UNet

class OilSpillDetector:
    def __init__(self, weights_path="ai_model/weights/unet_best.pth"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = UNet(in_channels=1, out_channels=1).to(self.device)
        
        try:
            self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
            print("✅ U-Net weights loaded successfully.")
        except FileNotFoundError:
            print("⚠️ No weights found. Using initialized model.")
        
        self.model.eval()

    def predict_polygon(self, image_path: str, base_lat: float = 15.0, base_lon: float = 70.0) -> dict:
        # 1. Preprocess image
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"Could not read image at {image_path}")
            
        img_resized = cv2.resize(img, (256, 256)) / 255.0
        tensor_img = torch.tensor(img_resized, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(self.device)

        # 2. Predict
        with torch.no_grad():
            pred_mask = self.model(tensor_img).cpu().numpy()[0, 0]

        # 3. Post-process: Convert binary mask to organic Polygon
        binary_mask = (pred_mask > 0.5).astype(np.uint8)
        
        # Find all contours
        contours = measure.find_contours(binary_mask, 0.5)
        
        if not contours:
            return {"spill_detected": False, "confidence": 0.0, "polygon": None, "centroid": [base_lon, base_lat]}

        # Convert pixel contours to Shapely Polygons
        shapely_polys = []
        height, width = binary_mask.shape
        
        # SCALE FACTOR: Spread the 256px image over ~0.08 degrees (about 8km)
        # This makes the spill visible and realistic
        scale_degrees = 0.08
        
        for contour in contours:
            geo_coords = []
            for y, x in contour:
                # Map 0-256 pixel space to geographic coordinates
                lat_offset = ((y - 128) / 128) * (scale_degrees / 2)
                lon_offset = ((x - 128) / 128) * (scale_degrees / 2)
                geo_coords.append((base_lon + lon_offset, base_lat + lat_offset))
            
            if len(geo_coords) >= 3:
                poly = Polygon(geo_coords)
                if poly.is_valid and poly.area > 0:
                    shapely_polys.append(poly)

        if not shapely_polys:
            return {"spill_detected": False, "confidence": 0.0, "polygon": None, "centroid": [base_lon, base_lat]}

        # Merge overlapping polygons
        merged_poly = unary_union(shapely_polys)
        
        # Simplify slightly but preserve organic shape
        simplified_poly = merged_poly.simplify(tolerance=0.0003, preserve_topology=True)
        
        # Extract coordinates for GeoJSON
        if isinstance(simplified_poly, Polygon):
            coords = [list(simplified_poly.exterior.coords)]
        else:  # MultiPolygon
            coords = [list(poly.exterior.coords) for poly in simplified_poly.geoms]

        # Calculate true centroid
        centroid_lon, centroid_lat = simplified_poly.centroid.x, simplified_poly.centroid.y
        confidence = float(np.mean(pred_mask[binary_mask == 1])) if np.any(binary_mask) else 0.0

        return {
            "spill_detected": True,
            "confidence": round(confidence, 4),
            "polygon": {"type": "Polygon" if isinstance(simplified_poly, Polygon) else "MultiPolygon", "coordinates": coords},
            "centroid": [centroid_lon, centroid_lat]
        }