import React, { useState } from 'react';
import Map, { Layer, Source, Marker, NavigationControl } from 'react-map-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api } from '../services/api';

const INITIAL_VIEW = {
  longitude: 78.0,
  latitude: 12.0,
  zoom: 4.5
};

export default function MapContainer() {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [spillPolygon, setSpillPolygon] = useState(null);
  const [driftPath, setDriftPath] = useState(null);
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageId, setImageId] = useState('S1A_IW_GRDH_20210501');

  const handleDetect = async () => {
    setLoading(true);
    try {
      // 1. Detect Spill
      const detection = await api.detectSpill(imageId);
      setSpillPolygon(detection.spill_polygon);

      // 2. Simulate Drift
      const drift = await api.simulateDrift(detection.centroid, detection.timestamp);
      setDriftPath(drift.drift_path);

      // 3. Get Vessels
      const coords = drift.source_polygon.coordinates[0];
      const bbox = [
        Math.min(...coords.map(c => c[0])) - 0.1,
        Math.min(...coords.map(c => c[1])) - 0.1,
        Math.max(...coords.map(c => c[0])) + 0.1,
        Math.max(...coords.map(c => c[1])) + 0.1
      ];
      const vesselList = await api.getVessels(bbox, new Date(), new Date());
      setVessels(vesselList);

      // 4. Zoom to spill
      setViewState({
        longitude: detection.centroid[0],
        latitude: detection.centroid[1],
        zoom: 8
      });
    } catch (err) {
      console.error(err);
      alert('Error: Ensure backend is running on port 8000');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="map-wrapper">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://demotiles.maplibre.org/style.json"
      >
        <NavigationControl position="top-right" />

        {/* Oil Spill Layer */}
        {spillPolygon && (
          <Source type="geojson" data={spillPolygon}>
            <Layer type="fill" paint={{ 'fill-color': '#ff4444', 'fill-opacity': 0.6 }} />
            <Layer type="line" paint={{ 'line-color': '#cc0000', 'line-width': 2 }} />
          </Source>
        )}

        {/* Drift Path Layer */}
        {driftPath && (
          <Source type="geojson" data={driftPath}>
            <Layer type="line" paint={{ 'line-color': '#ffaa00', 'line-width': 3, 'line-dasharray': [2, 2] }} />
          </Source>
        )}

        {/* Vessel Markers */}
        {vessels.map((vessel, i) => {
          const lastCoord = vessel.trajectory.coordinates[vessel.trajectory.coordinates.length - 1];
          return (
            <Marker key={i} longitude={lastCoord[0]} latitude={lastCoord[1]} anchor="center">
              <div className="custom-marker">
                {vessel.is_ghost_ship ? (
                  <div className="marker-ghost" title={`Ghost Ship: ${vessel.name}`}>!</div>
                ) : (
                  <div className="marker-ais" title={`AIS: ${vessel.name}`} />
                )}
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Control Panel */}
      <div className="control-panel">
        <h1 className="panel-title">Poseidon</h1>
        <p className="panel-subtitle">AI-Based Oil Spill Detection & Vessel Attribution</p>
        
        <div className="form-group">
          <label className="form-label">SAR Image ID</label>
          <input 
            type="text" 
            className="form-input" 
            value={imageId} 
            onChange={(e) => setImageId(e.target.value)} 
          />
        </div>

        <button className="detect-btn" onClick={handleDetect} disabled={loading}>
          {loading ? 'Analyzing...' : 'Detect Oil Spill'}
        </button>

        <div className="coverage-info">
          <strong>Coverage Area:</strong><br/>
          - Arabian Sea<br/>
          - Bay of Bengal<br/>
          - Indian Ocean
        </div>
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="legend-title">Legend</div>
        <div className="legend-item">
          <div className="legend-color-box" style={{ background: 'rgba(255,68,68,0.6)', border: '2px solid #cc0000' }} />
          Oil Spill Detection
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: '#ffaa00' }} />
          Backward Drift Path
        </div>
        <div className="legend-item">
          <div className="marker-ais" style={{ width: 16, height: 16, marginRight: 10 }} />
          AIS Vessel
        </div>
        <div className="legend-item">
          <div className="marker-ghost" style={{ width: 16, height: 16, marginRight: 10, fontSize: 10 }}>!</div>
          Ghost Ship (Dark Vessel)
        </div>
      </div>
    </div>
  );
}