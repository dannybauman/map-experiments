import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
  throw new Error('Mapbox token is missing. Please check your .env file.');
}

mapboxgl.accessToken = MAPBOX_TOKEN;

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState(-70.9);
  const [lat, setLat] = useState(42.35);
  const [zoom, setZoom] = useState(9);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [lng, lat],
        zoom: zoom
      });

      map.current.on('load', () => {
        setIsLoading(false);
      });

      map.current.on('error', (e) => {
        setError(`Mapbox error: ${e.error.message}`);
        setIsLoading(false);
      });

      map.current.on('move', () => {
        if (map.current) {
          const center = map.current.getCenter();
          setLng(Number(center.lng.toFixed(4)));
          setLat(Number(center.lat.toFixed(4)));
          setZoom(Number(map.current.getZoom().toFixed(2)));
        }
      });

    } catch (error) {
      setError(`Error initializing map: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div className="App">
      <div className="sidebar" aria-live="polite">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
      {isLoading && <div className="loading">Loading map...</div>}
      {error && <div className="error">{error}</div>}
      <div ref={mapContainer} className="map-container" aria-label="Mapbox map" />
    </div>
  );
}

export default App;
