# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Add the backend directory to the path so imports work correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(
    title="POSEIDON Maritime Forensics API",
    description="End-to-end oil spill detection, drift modelling, and vessel attribution pipeline.",
    version="1.0.0"
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INCLUDE ROUTERS HERE ---
# Make sure these files exist in your backend/routes/ folder
try:
    from routes import pipeline
    app.include_router(pipeline.router, prefix="/api/v1", tags=["Pipeline"])
    print("✅ Pipeline router loaded successfully.")
except ImportError as e:
    print(f"⚠️ Warning: Could not load pipeline router. Error: {e}")

# (Add any other existing routers here, e.g., detection, drift, etc.)

@app.get("/")
def read_root():
    return {"message": "POSEIDON API is running. Visit /docs for Swagger UI."}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
