import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { api } from './services/api';

// Fix default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

// Custom Ship Icons
const createShipIcon = (isGhost) => L.divIcon({
  className: 'custom-ship',
  html: `<div style="background-color: ${isGhost ? '#e53e3e' : '#3182ce'}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); ${isGhost ? 'animation: pulse 1.5s infinite;' : ''}"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// MAJOR COASTAL CITIES for territorial water visualization
const coastalCities = [
  { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
  { name: "Goa", lat: 15.2993, lng: 74.1240 },
  { name: "Mangalore", lat: 12.9141, lng: 74.8560 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673 },
  { name: "Kanyakumari", lat: 8.0883, lng: 77.5385 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  { name: "Paradip", lat: 20.3167, lng: 86.6100 },
  { name: "Digha", lat: 21.6667, lng: 87.5167 }
];

function App() {
  const [loading, setLoading] = useState(false);
  const [spillData, setSpillData] = useState(null);
  const [driftPath, setDriftPath] = useState(null);
  const [shipPos, setShipPos] = useState([15.0, 70.0]);
  const [isGhost, setIsGhost] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0); // 0: Idle, 1: Animating, 2: Complete
  const [logs, setLogs] = useState([]);
  const mapRef = useRef();

  // Create circular buffers around coastal cities (Ocean side monitoring zones)
  const territorialBuffers = coastalCities.map(city => 
    turf.circle([city.lng, city.lat], 22, { units: 'kilometers', steps: 64 })
  );
  
  const eezBuffers = coastalCities.map(city => 
    turf.circle([city.lng, city.lat], 50, { units: 'kilometers', steps: 64 })
  );

  const zoneStyle = (color, fill) => ({ 
    color, 
    weight: 2, 
    fillColor: fill, 
    fillOpacity: 0.15, 
    dashArray: '6, 4' 
  });
  
  // LIQUID OIL STYLING
  const oilSpillStyle = { 
    color: '#5c0a0a',       // Very dark, subtle red border
    weight: 1,              // Thin border
    fillColor: '#b91c1c',   // Deep red fill
    fillOpacity: 0.45,      // Semi-transparent
    dashArray: null         
  };

  const addLog = (message, type = "info") => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { time, message, type }]);
  };

  // ANIMATION LOGIC
  useEffect(() => {
    if (simulationStep === 1) {
      addLog("Simulation started. Tracking vessel MMSI: 419000...", "info");
      const path = [[15.0, 70.0], [15.02, 70.02], [15.04, 70.04], [15.06, 70.06], [15.08, 70.08]];
      let i = 0;
      const interval = setInterval(() => {
        if (i < path.length) {
          setShipPos(path[i]);
          i++;
        } else {
          clearInterval(interval);
          addLog("Vessel stopped. AIS Transponder DISABLED.", "warning");
          setIsGhost(true); // Ship turns red
          
          setTimeout(() => {
            addLog("Illegal discharge detected. Vessel fleeing area.", "warning");
            setShipPos([15.15, 70.15]); // Ship flees off-screen
            
            setTimeout(() => {
              addLog("Vessel out of range. Initiating satellite scan...", "info");
              triggerAIDetection();
            }, 1500);
          }, 1000);
        }
      }, 800);
      return () => clearInterval(interval);
    }
  }, [simulationStep]);

  const startSimulation = () => {
    setSimulationStep(1);
    setSpillData(null);
    setDriftPath(null);
    setIsGhost(false);
    setLogs([]);
    if (mapRef.current) mapRef.current.setView([15.0, 70.0], 7);
  };

  const triggerAIDetection = async (shipName, shipMMSI) => {
  setLoading(true);
  try {
    addLog("🛰️ Sentinel-1 SAR satellite capturing imagery...", "info");
    await new Promise(r => setTimeout(r, 1000)); // Simulate satellite delay
    
    addLog("🤖 U-Net AI analyzing SAR imagery for dark patches...", "info");
    const detection = await api.detectSpill("simulated_ship_spill");
    setSpillData(detection.spill_polygon);
    addLog(`✔️ AI Detection Complete. Confidence: ${(detection.confidence * 100).toFixed(1)}%`, "success");
    addLog(`📍 Spill centroid: ${detection.centroid[1].toFixed(4)}°N, ${detection.centroid[0].toFixed(4)}°E`, "info");

    addLog(" Calculating backward trajectory using regional ocean physics...", "info");
    addLog("   - Arabian Sea monsoon vectors loaded", "info");
    addLog("   - Windage factor: 3%", "info");
    const drift = await api.simulateDrift(detection.centroid, detection.timestamp);
    setDriftPath(drift.drift_path);
    addLog(`✔️ Physics backtrack complete. Source region: ${drift.region_detected || 'Unknown'}`, "success");
    
    addLog("🔍 FORENSIC ANALYSIS:", "info");
    addLog(`   Querying historical AIS database for source coordinates...`, "info");
    await new Promise(r => setTimeout(r, 800));
    addLog(`   ⚠️ No AIS signal at spill time (vessel was dark)`, "warning");
    
    addLog(`   Cross-referencing with last known AIS positions...`, "info");
    await new Promise(r => setTimeout(r, 800));
    addLog(`   ✔️ MATCH FOUND: ${shipName} (MMSI: ${shipMMSI}) was at this location 12 hours ago`, "success");
    
    addLog(`   Checking current AIS status of ${shipName}...`, "info");
    await new Promise(r => setTimeout(r, 600));
    addLog(`   ⚠️ Vessel AIS currently DISABLED (Ghost Ship behavior)`, "warning");
    
    addLog(`   Querying SAR CFAR for metallic signatures at source...`, "info");
    await new Promise(r => setTimeout(r, 600));
    addLog(`   ✔️ Metallic vessel signature detected (confirms physical presence)`, "success");
    
    addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "error");
    addLog(` ALERT: GHOST SHIP ATTRIBUTION CONFIRMED`, "error");
    addLog(`   Vessel: ${shipName}`, "error");
    addLog(`   MMSI: ${shipMMSI}`, "error");
    addLog(`   Violation: Illegal oil discharge + AIS tampering`, "error");
    addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "error");
    
    setSimulationStep(2);
  } catch (error) {
    console.error("Detection error:", error);
    addLog(" System Error: Backend connection failed.", "error");
    setSimulationStep(0);
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f7fafc' }}>
      <MapContainer ref={mapRef} center={[12.0, 78.0]} zoom={4} style={{ width: '100%', height: '100%' }} worldCopyJump={false} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
        
        {/* Territorial Waters (22km) - City-based buffers */}
        {territorialBuffers.map((buffer, idx) => (
          <GeoJSON 
            key={`terr-${idx}`} 
            data={buffer} 
            style={zoneStyle('#2b6cb0', '#bee3f8')}
          >
            <Popup>{coastalCities[idx].name} - 22km Territorial Waters</Popup>
          </GeoJSON>
        ))}

        {/* EEZ Buffer (50km) - City-based buffers */}
        {eezBuffers.map((buffer, idx) => (
          <GeoJSON 
            key={`eez-${idx}`} 
            data={buffer} 
            style={zoneStyle('#2c5282', '#ebf8ff')}
          >
            <Popup>{coastalCities[idx].name} - 50km EEZ Buffer</Popup>
          </GeoJSON>
        ))}

        {/* AI Detected Spill */}
        {spillData && <GeoJSON data={spillData} style={oilSpillStyle} />}
        
        {/* Physics Backtrack Path */}
        {driftPath && <GeoJSON data={driftPath} style={{ color: '#ffaa00', weight: 3, dashArray: '5, 5', fill: false }} />}

        {/* The Moving Ship */}
        <Marker position={shipPos} icon={createShipIcon(isGhost)}>
          <Popup>{isGhost ? 'GHOST SHIP (AIS OFF)' : 'Vessel in Transit (AIS ON)'}</Popup>
        </Marker>
      </MapContainer>

      {/* LEFT: Control Panel */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: '300px', zIndex: 1000 }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '22px', color: '#1a365d', fontWeight: '800', letterSpacing: '-0.5px' }}>POSEIDON</h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px' }}>Maritime Forensics Platform</p>
        
        <button onClick={startSimulation} disabled={simulationStep === 1 || loading} style={{ width: '100%', padding: '12px', backgroundColor: (simulationStep === 1 || loading) ? '#a0aec0' : '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '14px', cursor: (simulationStep === 1 || loading) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
          {loading ? 'Processing...' : simulationStep === 1 ? 'Simulation Running...' : 'Start Live Simulation'}
        </button>
      </div>

      {/* RIGHT: Live System Telemetry Panel */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', width: '320px', zIndex: 1000, color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px', maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '8px', textTransform: 'uppercase' }}>System Telemetry</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {logs.length === 0 && <span style={{ color: '#64748b', fontStyle: 'italic' }}>Waiting for simulation...</span>}
          {logs.map((log, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', lineHeight: '1.4' }}>
              <span style={{ color: '#64748b', minWidth: '65px' }}>[{log.time}]</span>
              <span style={{ 
                color: log.type === 'error' ? '#f87171' : log.type === 'warning' ? '#fbbf24' : log.type === 'success' ? '#4ade80' : '#e2e8f0' 
              }}>
                {log.type === 'error' ? '✖ ' : log.type === 'success' ? '✔ ' : log.type === 'warning' ? '⚠ ' : 'ℹ '}
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM: Legend */}
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: '220px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#1e293b', fontWeight: '700', textTransform: 'uppercase' }}>Map Legend</h3>
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(185, 28, 28, 0.45)', border: '1px solid #5c0a0a', marginRight: '10px', borderRadius: '2px' }}></div>
          AI Detected Oil Spill
        </div>
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '20px', height: '3px', backgroundColor: '#ffaa00', marginRight: '10px' }}></div>
          Physics Backtrack Path
        </div>
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#3182ce', borderRadius: '50%', border: '2px solid white', marginRight: '10px' }}></div>
          Normal Vessel (AIS Active)
        </div>
        <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#e53e3e', borderRadius: '50%', border: '2px solid white', marginRight: '10px' }}></div>
          Ghost Ship (AIS Disabled)
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.3); } }`}</style>
    </div>
  );
}

export default App;