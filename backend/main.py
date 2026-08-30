from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import detection, drift, vessels

app = FastAPI(
    title="Poseidon API", 
    description="AI-Based Oil Spill Detection & Vessel Source Attribution"
)

# Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detection.router, prefix="/api/v1/detection", tags=["Detection"])
app.include_router(drift.router, prefix="/api/v1/drift", tags=["Drift"])
app.include_router(vessels.router, prefix="/api/v1/vessels", tags=["Vessels"])

@app.get("/")
def read_root():
    return {"status": "Poseidon Backend is running. Welcome to the Indian Ocean surveillance grid."}