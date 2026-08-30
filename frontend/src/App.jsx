import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import * as turf from '@turf/turf';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

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

const createArrowIcon = (rotation) => L.divIcon({
  className: 'arrow-marker',
  html: `<div style="color: #f59e0b; font-size: 24px; transform: rotate(${rotation}deg); font-weight: bold; text-shadow: 0 0 2px black;">&#10148;</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12]
});

// --- FLEET CONFIGURATION (All paths strictly offshore) ---
const FLEET = [
  { 
    id: 1, name: "MAERSK TITAN", mmsi: "419000123", region: "Arabian Sea", 
    path: [[15.0, 71.0], [15.2, 71.3], [15.4, 71.6], [15.6, 71.9], [15.8, 72.2]], 
    crime: { type: "Hit and Run", startPathIndex: 2, endPathIndex: 3, spillCoord: [15.4, 71.6] } 
  },
  { id: 2, name: "GULF STAR", mmsi: "419000124", region: "Arabian Sea", path: [[16.0, 70.5], [16.2, 70.8], [16.4, 71.1], [16.6, 71.4], [16.8, 71.7]] },
  { id: 3, name: "ARABIAN PEARL", mmsi: "419000125", region: "Arabian Sea", path: [[14.0, 72.0], [14.2, 71.7], [14.4, 71.4], [14.6, 71.1], [14.8, 70.8]] },
  { id: 4, name: "MUMBAI EXPRESS", mmsi: "419000126", region: "Arabian Sea", path: [[18.0, 71.5], [17.8, 71.2], [17.6, 70.9], [17.4, 70.6], [17.2, 70.3]] },
  
  { 
    id: 5, name: "OCEAN VOYAGER", mmsi: "419000456", region: "Bay of Bengal", 
    path: [
      [13.0, 81.0], [13.2, 81.2], [13.4, 81.4], [13.2, 81.45], 
      [13.0, 81.5], [13.2, 81.55], [13.4, 81.6], [13.6, 81.8]
    ], 
    crime: { type: "Dip Maneuver", startPathIndex: 2, endPathIndex: 5, spillCoord: [13.0, 81.5] } 
  },
  { id: 6, name: "BENGAL TIGER", mmsi: "419000457", region: "Bay of Bengal", path: [[15.0, 81.5], [15.2, 81.8], [15.4, 82.1], [15.6, 82.4], [15.8, 82.7]] },
  { id: 7, name: "CHENNAI TRADER", mmsi: "419000458", region: "Bay of Bengal", path: [[12.0, 80.5], [12.2, 80.8], [12.4, 81.1], [12.6, 81.4], [12.8, 81.7]] },

  // Fixed: Pushed further south into deep ocean to avoid land
  { id: 8, name: "INDIAN OCEANIC", mmsi: "419000789", region: "Indian Ocean", path: [[5.0, 76.0], [5.5, 77.0], [6.0, 78.0], [6.5, 79.0], [7.0, 80.0]] },
  { id: 9, name: "SOUTHERN CROSS", mmsi: "419000790", region: "Indian Ocean", path: [[4.0, 77.0], [4.5, 78.0], [5.0, 79.0], [5.5, 80.0], [6.0, 81.0]] },
  { id: 10, name: "EQUATOR VOYAGER", mmsi: "419000791", region: "Indian Ocean", path: [[2.0, 78.0], [2.5, 79.0], [3.0, 80.0], [3.5, 81.0], [4.0, 82.0]] }
];

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

// Real SAR Oil Spill Image URL (Envisat ASAR)
const SAR_IMAGE_URL = "https://sentinel.esa.int/documents/247904/349485/Envisat_oil_spill.jpg";

function App() {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [oilSpills, setOilSpills] = useState([]);
  const [backtrackLines, setBacktrackLines] = useState([]);
  const [deviationPaths, setDeviationPaths] = useState([]);
  const mapRef = useRef();

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= 360) { setIsPlaying(false); return 360; }
          return prev + 1;
        });
      }, 100); 
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const getShipState = (ship) => {
    const totalPoints = ship.path.length;
    const timePerSegment = 360 / (totalPoints - 1);
    const segmentIndex = Math.floor(currentTime / timePerSegment);
    const progress = (currentTime % timePerSegment) / timePerSegment;
    
    let currentPos = ship.path[Math.min(segmentIndex, totalPoints - 1)];
    let nextPos = ship.path[Math.min(segmentIndex + 1, totalPoints - 1)];
    const lat = currentPos[0] + (nextPos[0] - currentPos[0]) * progress;
    const lng = currentPos[1] + (nextPos[1] - currentPos[1]) * progress;
    
    let status = "NORMAL", lkp = null, rp = null, isDark = false;

    if (ship.crime) {
      if (segmentIndex >= ship.crime.startPathIndex && segmentIndex <= ship.crime.endPathIndex) {
        status = "DARK"; isDark = true;
      } else if (segmentIndex > ship.crime.endPathIndex) {
        status = "NORMAL_POST_CRIME";
        lkp = ship.path[ship.crime.startPathIndex];
        rp = ship.path[Math.min(ship.crime.endPathIndex + 1, ship.path.length - 1)];
      }
    }
    return { lat, lng, status, lkp, rp, isDark, segmentIndex };
  };

  useEffect(() => {
    const activeSpills = [];
    const activeBacktracks = [];
    const activeDeviations = [];
    
    FLEET.forEach(s => {
      if (!s.crime) return;
      const state = getShipState(s);
      const crimeEndTime = s.crime.endPathIndex * (360 / (s.path.length - 1));
      
      // Progressive Deviation Lines
      if (state.segmentIndex >= s.crime.startPathIndex && state.segmentIndex <= s.crime.endPathIndex) {
        // Draw path from start of crime to current position
        const pathSoFar = s.path.slice(s.crime.startPathIndex, state.segmentIndex + 1);
        pathSoFar.push([state.lat, state.lng]); // Add current interpolated position
        activeDeviations.push({ id: s.id, coords: pathSoFar });
      } else if (state.segmentIndex > s.crime.endPathIndex) {
        // Draw full path after crime is complete
        const fullPath = s.path.slice(s.crime.startPathIndex, s.crime.endPathIndex + 2);
        activeDeviations.push({ id: s.id, coords: fullPath });
      }

      // Oil Spills and Backtracking (appear 30 mins after crime ends)
      if (currentTime >= crimeEndTime + 30) {
        const timeSinceSpill = currentTime - (crimeEndTime + 30);
        let driftLat = 0, driftLng = 0;
        if (s.region === "Arabian Sea") { driftLat = 0.002; driftLng = 0.0015; } 
        else if (s.region === "Bay of Bengal") { driftLat = 0.0015; driftLng = 0.001; } 
        else { driftLat = 0.0005; driftLng = -0.002; } 

        const currentLat = s.crime.spillCoord[0] + (driftLat * timeSinceSpill);
        const currentLng = s.crime.spillCoord[1] + (driftLng * timeSinceSpill);
        const radius = 0.01 + (timeSinceSpill * 0.0002); 
        activeSpills.push({ id: s.id, polygon: turf.circle([currentLng, currentLat], radius, { units: 'degrees', steps: 16 }), center: [currentLat, currentLng] });
        
        const originLat = s.crime.spillCoord[0];
        const originLng = s.crime.spillCoord[1];
        const midLat = (currentLat + originLat) / 2;
        const midLng = (currentLng + originLng) / 2;
        const angle = Math.atan2(originLat - currentLat, originLng - currentLng) * (180 / Math.PI);
        
        activeBacktracks.push({ id: s.id, coords: [[currentLat, currentLng], [originLat, originLng]], arrowPos: [midLat, midLng], arrowRotation: angle });
      }
    });
    
    setOilSpills(activeSpills);
    setBacktrackLines(activeBacktracks);
    setDeviationPaths(activeDeviations);
  }, [currentTime]);

  useEffect(() => {
    const activeIncidents = FLEET.filter(s => {
      if (!s.crime) return false;
      const crimeEndTime = s.crime.endPathIndex * (360 / (s.path.length - 1));
      return currentTime >= crimeEndTime + 30;
    }).map(s => ({ id: s.id, name: s.name, type: s.crime.type, region: s.region, status: "ATTRIBUTION CONFIRMED", volume: "3,200 Liters", backscatter: "-22.4 dB" }));
    setIncidents(activeIncidents);
  }, [currentTime]);

  const handleSpillClick = (e, spillId) => {
    const ship = FLEET.find(s => s.id === spillId);
    if (!ship) return;
    
    const popupContent = `
      <div style="width: 280px; font-family: sans-serif;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #1a202c; font-weight: bold;">SAR Imagery Analysis - ${ship.name}</h4>
        <img src="${SAR_IMAGE_URL}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; background: #000;" />
        <div style="margin-top: 8px; font-size: 11px; color: #4a5568; line-height: 1.4;">
          <div><strong>Sensor:</strong> Sentinel-1 SAR (VV Polarization)</div>
          <div><strong>Resolution:</strong> 10m</div>
          <div><strong>AI Confidence:</strong> 94.2%</div>
          <div><strong>Analysis:</strong> Dark patch detected consistent with crude oil slick.</div>
        </div>
      </div>
    `;
    
    L.popup()
      .setLatLng(e.latlng)
      .setContent(popupContent)
      .openOn(mapRef.current);
  };

  const territorialBuffers = offshorePoints.map(p => turf.circle([p.lng, p.lat], 22, { units: 'kilometers', steps: 32 }));
  const eezBuffers = offshorePoints.map(p => turf.circle([p.lng, p.lat], 50, { units: 'kilometers', steps: 32 }));
  const zoneStyle = (color, fill) => ({ color, weight: 1, fillColor: fill, fillOpacity: 0.1, dashArray: '4, 4' });
  const formatTime = (mins) => `${(Math.floor(mins / 60) + 8).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', fontFamily: 'Inter, sans-serif', backgroundColor: '#0f172a', color: '#e2e8f0' }}>
      <MapContainer ref={mapRef} center={[12.0, 78.0]} zoom={5} style={{ width: '100%', height: '100%' }} worldCopyJump={false} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
        {territorialBuffers.map((b, i) => <GeoJSON key={`t${i}`} data={b} style={zoneStyle('#3b82f6', '#93c5fd')} />)}
        {eezBuffers.map((b, i) => <GeoJSON key={`e${i}`} data={b} style={zoneStyle('#1e40af', '#60a5fa')} />)}

        {oilSpills.map(spill => (
          <GeoJSON 
            key={`oil-${spill.id}`} 
            data={spill.polygon} 
            style={{ color: '#b91c1c', weight: 1, fillColor: '#7f1d1d', fillOpacity: 0.6 }}
            onEachFeature={(feature, layer) => {
              layer.on('click', (e) => handleSpillClick(e, spill.id));
              layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.8, weight: 2 }));
              layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.6, weight: 1 }));
            }}
          />
        ))}

        {backtrackLines.map(bt => (
          <React.Fragment key={`bt-${bt.id}`}>
            <Polyline positions={bt.coords} pathOptions={{ color: '#f59e0b', weight: 3, dashArray: '8, 4' }} />
            <Marker position={bt.arrowPos} icon={createArrowIcon(bt.arrowRotation)}><Popup>Backtrack Vector</Popup></Marker>
          </React.Fragment>
        ))}

        {deviationPaths.map(dp => (
          <Polyline key={`dev-${dp.id}`} positions={dp.coords} pathOptions={{ color: '#000000', weight: 2, dashArray: '6, 4', opacity: 0.7 }} />
        ))}

        {FLEET.map(ship => {
          const state = getShipState(ship);
          return (
            <React.Fragment key={ship.id}>
              <Marker position={[state.lat, state.lng]} icon={state.isDark ? createDarkShipIcon() : createNormalShipIcon()}>
                <Popup><b>{ship.name}</b><br/>MMSI: {ship.mmsi}<br/>Status: {state.status}</Popup>
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

      <div style={{ position: 'absolute', top: '20px', left: '20px', backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '20px', borderRadius: '8px', border: '1px solid #334155', width: '320px', zIndex: 1000 }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#f8fafc', fontWeight: '800', letterSpacing: '1px' }}>POSEIDON</h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Maritime Forensics Command Center</p>
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px', color: '#cbd5e1' }}>
            <span>Global Clock</span><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatTime(currentTime)} UTC</span>
          </div>
          <input type="range" min="0" max="360" value={currentTime} onChange={(e) => setCurrentTime(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6' }} />
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ width: '100%', marginTop: '10px', padding: '8px', backgroundColor: isPlaying ? '#ef4444' : '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isPlaying ? 'PAUSE SIMULATION' : 'RESUME SIMULATION'}
          </button>
        </div>
      </div>

      <div style={{ position: 'absolute', top: '20px', right: '20px', width: '350px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '90vh' }}>
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>Global Situational Awareness</h3>
          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Vessels Tracked:</span><span style={{ color: '#f8fafc' }}>10</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active AIS Signals:</span><span style={{ color: '#10b981' }}>{10 - incidents.length}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Dark Vessels (AIS OFF):</span><span style={{ color: '#ef4444' }}>{incidents.length}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active Incidents:</span><span style={{ color: '#f59e0b' }}>{incidents.length}</span></div>
          </div>
        </div>
        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '8px', border: '1px solid #334155', flex: 1, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>Incident Command</h3>
          {incidents.length === 0 ? <p style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>No active forensic investigations.</p> : incidents.map(inc => (
            <div key={inc.id} style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '5px' }}>INCIDENT-{inc.id} [{inc.region.toUpperCase()}]</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.5' }}>
                <div>Vessel: {inc.name}</div><div>Method: {inc.type}</div>
                <div>Status: <span style={{ color: '#10b981' }}>{inc.status}</span></div>
                <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #334155' }}><div>SAR Backscatter: {inc.backscatter}</div><div>Est. Volume: {inc.volume}</div></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: '10px', borderRadius: '8px', border: '1px solid #334155', height: '150px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '10px' }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>System Telemetry</h3>
          {logs.map((log, i) => <div key={i} style={{ marginBottom: '3px', color: log.type === 'ALERT' ? '#ef4444' : log.type === 'WARN' ? '#f59e0b' : '#94a3b8' }}><span style={{ color: '#475569' }}>[{log.time}]</span> {log.msg}</div>)}
        </div>
      </div>
      <style>{`@keyframes pulse-red { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1e293b; } ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }`}</style>
    </div>
  );
}

export default App;