import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { api } from './services/api';

// Fix default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

// --- PROFESSIONAL MARKER FACTORIES ---
const createNormalShipIcon = () => L.divIcon({
  className: 'normal-ship',
  html: `<div style="background-color: #3b82f6; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7]
});

const createDarkShipIcon = () => L.divIcon({
  className: 'dark-ship',
  html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #ef4444; animation: pulse-red 1.5s infinite;"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8]
});

const createGapMarkerIcon = (type) => L.divIcon({
  className: 'gap-marker',
  html: `<div style="background-color: transparent; width: 12px; height: 12px; border: 2px solid ${type === 'LKP' ? '#ef4444' : '#10b981'}; transform: rotate(45deg);"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8]
});

// --- FLEET CONFIGURATION ---
// 10 Ships across 3 regions. 2 are culprits.
const FLEET = [
  // ARABIAN SEA (4 Ships)
  { id: 1, name: "MAERSK TITAN", mmsi: "419000123", region: "Arabian Sea", path: [[15.0, 71.5], [15.2, 71.8], [15.4, 72.1], [15.6, 72.4], [15.8, 72.7]], crime: { type: "Hit and Run", startMin: 60, endMin: 90, spillCoord: [15.4, 72.1] } },
  { id: 2, name: "GULF STAR", mmsi: "419000124", region: "Arabian Sea", path: [[16.0, 71.0], [16.2, 71.3], [16.4, 71.6], [16.6, 71.9], [16.8, 72.2]] },
  { id: 3, name: "ARABIAN PEARL", mmsi: "419000125", region: "Arabian Sea", path: [[14.0, 72.5], [14.2, 72.2], [14.4, 71.9], [14.6, 71.6], [14.8, 71.3]] },
  { id: 4, name: "MUMBAI EXPRESS", mmsi: "419000126", region: "Arabian Sea", path: [[18.0, 72.0], [17.8, 71.7], [17.6, 71.4], [17.4, 71.1], [17.2, 70.8]] },
  
  // BAY OF BENGAL (3 Ships)
  { id: 5, name: "OCEAN VOYAGER", mmsi: "419000456", region: "Bay of Bengal", path: [[13.0, 81.5], [13.2, 81.8], [13.4, 82.1], [13.6, 82.4], [13.8, 82.7]], crime: { type: "Dip Maneuver", startMin: 120, endMin: 150, spillCoord: [13.4, 82.1] } },
  { id: 6, name: "BENGAL TIGER", mmsi: "419000457", region: "Bay of Bengal", path: [[15.0, 82.0], [15.2, 82.3], [15.4, 82.6], [15.6, 82.9], [15.8, 83.2]] },
  { id: 7, name: "CHENNAI TRADER", mmsi: "419000458", region: "Bay of Bengal", path: [[12.0, 81.0], [12.2, 81.3], [12.4, 81.6], [12.6, 81.9], [12.8, 82.2]] },

  // DEEP INDIAN OCEAN (3 Ships)
  { id: 8, name: "INDIAN OCEANIC", mmsi: "419000789", region: "Indian Ocean", path: [[8.0, 77.0], [8.2, 77.5], [8.4, 78.0], [8.6, 78.5], [8.8, 79.0]] },
  { id: 9, name: "SOUTHERN CROSS", mmsi: "419000790", region: "Indian Ocean", path: [[6.0, 78.0], [6.2, 78.5], [6.4, 79.0], [6.6, 79.5], [6.8, 80.0]] },
  { id: 10, name: "EQUATOR VOYAGER", mmsi: "419000791", region: "Indian Ocean", path: [[4.0, 79.0], [4.2, 79.5], [4.4, 80.0], [4.6, 80.5], [4.8, 81.0]] }
];

// --- OFFSHORE MONITORING POINTS ---
const offshorePoints = [
  { name: "Mumbai Offshore", lat: 18.95, lng: 72.70 },
  { name: "Goa Offshore", lat: 15.20, lng: 73.90 },
  { name: "Mangalore Offshore", lat: 12.85, lng: 74.70 },
  { name: "Kochi Offshore", lat: 9.85, lng: 76.10 },
  { name: "Kanyakumari Offshore", lat: 8.00, lng: 77.45 },
  { name: "Chennai Offshore", lat: 13.05, lng: 80.45 },
  { name: "Visakhapatnam Offshore", lat: 17.65, lng: 83.45 },
  { name: "Paradip Offshore", lat: 20.25, lng: 86.85 },
  { name: "Digha Offshore", lat: 21.60, lng: 87.75 }
];

function App() {
  const [currentTime, setCurrentTime] = useState(0); // 0 to 360 minutes (6 hours)
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const mapRef = useRef();

  // --- TIMELINE ENGINE ---
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= 360) {
            setIsPlaying(false);
            return 360;
          }
          return prev + 1;
        });
      }, 100); // 100ms = 1 minute of simulation time
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // --- SHIP POSITION CALCULATOR ---
  const getShipState = (ship) => {
    const totalPoints = ship.path.length;
    const timePerSegment = 360 / (totalPoints - 1);
    const segmentIndex = Math.floor(currentTime / timePerSegment);
    const progress = (currentTime % timePerSegment) / timePerSegment;
    
    let currentPos = ship.path[Math.min(segmentIndex, totalPoints - 1)];
    let nextPos = ship.path[Math.min(segmentIndex + 1, totalPoints - 1)];
    
    // Interpolate position
    const lat = currentPos[0] + (nextPos[0] - currentPos[0]) * progress;
    const lng = currentPos[1] + (nextPos[1] - currentPos[1]) * progress;
    
    let status = "NORMAL";
    let lkp = null;
    let rp = null;
    let isDark = false;

    if (ship.crime) {
      if (currentTime >= ship.crime.startMin && currentTime <= ship.crime.endMin) {
        status = "DARK";
        isDark = true;
      } else if (currentTime > ship.crime.endMin) {
        status = "NORMAL_POST_CRIME";
        lkp = ship.path[Math.floor(ship.crime.startMin / timePerSegment)];
        rp = ship.path[Math.floor(ship.crime.endMin / timePerSegment)];
      }
    }

    return { lat, lng, status, lkp, rp, isDark };
  };

  // --- INCIDENT DETECTION LOGIC ---
  useEffect(() => {
    const activeIncidents = FLEET.filter(s => s.crime && currentTime >= s.crime.endMin + 30).map(s => ({
      id: s.id,
      name: s.name,
      type: s.crime.type,
      region: s.region,
      status: "ATTRIBUTION CONFIRMED",
      volume: "3,200 Liters",
      backscatter: "-22.4 dB"
    }));
    setIncidents(activeIncidents);
  }, [currentTime]);

  // --- SYSTEM LOGS ---
  const addLog = (msg, type) => {
    const timeStr = `T+${Math.floor(currentTime/60)}h${currentTime%60}m`;
    setLogs(prev => [{ time: timeStr, msg, type }, ...prev].slice(0, 50));
  };

  // --- GEOGRAPHY ---
  const territorialBuffers = offshorePoints.map(p => turf.circle([p.lng, p.lat], 22, { units: 'kilometers', steps: 32 }));
  const eezBuffers = offshorePoints.map(p => turf.circle([p.lng, p.lat], 50, { units: 'kilometers', steps: 32 }));
  const zoneStyle = (color, fill) => ({ color, weight: 1, fillColor: fill, fillOpacity: 0.1, dashArray: '4, 4' });

  const formatTime = (mins) => {
    const h = Math.floor(mins / 60) + 8; // Start at 08:00
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', fontFamily: 'Inter, sans-serif', backgroundColor: '#0f172a', color: '#e2e8f0' }}>
      <MapContainer ref={mapRef} center={[12.0, 78.0]} zoom={5} style={{ width: '100%', height: '100%' }} worldCopyJump={false} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
        
        {territorialBuffers.map((b, i) => <GeoJSON key={`t${i}`} data={b} style={zoneStyle('#3b82f6', '#93c5fd')} />)}
        {eezBuffers.map((b, i) => <GeoJSON key={`e${i}`} data={b} style={zoneStyle('#1e40af', '#60a5fa')} />)}

        {FLEET.map(ship => {
          const state = getShipState(ship);
          return (
            <React.Fragment key={ship.id}>
              <Marker position={[state.lat, state.lng]} icon={state.isDark ? createDarkShipIcon() : createNormalShipIcon()}>
                <Popup>
                  <b>{ship.name}</b><br/>
                  MMSI: {ship.mmsi}<br/>
                  Status: {state.status}
                </Popup>
              </Marker>
              {state.lkp && state.rp && (
                <>
                  <Marker position={state.lkp} icon={createGapMarkerIcon('LKP')}><Popup>Last Known Position (AIS OFF)</Popup></Marker>
                  <Marker position={state.rp} icon={createGapMarkerIcon('RP')}><Popup>Reacquisition Position (AIS ON)</Popup></Marker>
                  <Polyline positions={[state.lkp, state.rp]} pathOptions={{ color: '#ef4444', weight: 2, dashArray: '5, 5' }} />
                </>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* LEFT PANEL: COMMAND & TIMELINE */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '20px', borderRadius: '8px', border: '1px solid #334155', width: '320px', zIndex: 1000 }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#f8fafc', fontWeight: '800', letterSpacing: '1px' }}>POSEIDON</h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Maritime Forensics Command Center</p>
        
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px', color: '#cbd5e1' }}>
            <span>Global Clock</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatTime(currentTime)} UTC</span>
          </div>
          <input 
            type="range" min="0" max="360" value={currentTime} 
            onChange={(e) => setCurrentTime(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6' }}
          />
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ width: '100%', marginTop: '10px', padding: '8px', backgroundColor: isPlaying ? '#ef4444' : '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isPlaying ? 'PAUSE SIMULATION' : 'RESUME SIMULATION'}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: COMMAND CENTER DASHBOARD */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', width: '350px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '90vh' }}>
        
        {/* Module A: SITREP */}
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>Global Situational Awareness</h3>
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Vessels Tracked:</span><span style={{ color: '#f8fafc' }}>10</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active AIS Signals:</span><span style={{ color: '#10b981' }}>{10 - incidents.length}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Dark Vessels (AIS OFF):</span><span style={{ color: '#ef4444' }}>{incidents.length}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active Incidents:</span><span style={{ color: '#f59e0b' }}>{incidents.length}</span></div>
          </div>
        </div>

        {/* Module B: Incident Command */}
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '8px', border: '1px solid #334155', flex: 1, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>Incident Command</h3>
          {incidents.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No active forensic investigations.</p>
          ) : (
            incidents.map(inc => (
              <div key={inc.id} style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '5px' }}>INCIDENT-{inc.id} [{inc.region.toUpperCase()}]</div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <div>Vessel: {inc.name}</div>
                  <div>Method: {inc.type}</div>
                  <div>Status: <span style={{ color: '#10b981' }}>{inc.status}</span></div>
                  <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #334155' }}>
                    <div>SAR Backscatter: {inc.backscatter}</div>
                    <div>Est. Volume: {inc.volume}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Module C: System Logs */}
        <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: '10px', borderRadius: '8px', border: '1px solid #334155', height: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '10px' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>System Telemetry</h3>
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '3px', color: log.type === 'ALERT' ? '#ef4444' : log.type === 'WARN' ? '#f59e0b' : '#94a3b8' }}>
              <span style={{ color: '#475569' }}>[{log.time}]</span> {log.msg}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse-red { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
      `}</style>
    </div>
  );
}

export default App;