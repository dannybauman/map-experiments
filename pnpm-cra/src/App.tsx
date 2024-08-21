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
  const [carPosition, setCarPosition] = useState<[number, number]>([-70.9, 42.35]);
  const [mapLoaded, setMapLoaded] = useState(false);

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
        setMapLoaded(true);

        // Add a new layer for the car
        map.current?.addLayer({
          id: 'car',
          type: 'circle',
          source: {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: carPosition
              }
            }
          },
          paint: {
            'circle-radius': 10,
            'circle-color': '#007cbf'
          }
        });
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

      // Add keyboard event listener
      document.addEventListener('keydown', handleKeyDown);
    } catch (error) {
      setError(`Error initializing map: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Update car position when it changes
  useEffect(() => {
    if (map.current && mapLoaded) {
      const source = map.current.getSource('car') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: carPosition
          }
        });
      }
    }
  }, [carPosition, mapLoaded]);

  const handleKeyDown = (e: KeyboardEvent) => {
    const speed = 0.001; // Adjust this value to change the car's speed
    let newPosition: [number, number] = [...carPosition];

    switch (e.key) {
      case 'ArrowUp':
        newPosition[1] += speed;
        break;
      case 'ArrowDown':
        newPosition[1] -= speed;
        break;
      case 'ArrowLeft':
        newPosition[0] -= speed;
        break;
      case 'ArrowRight':
        newPosition[0] += speed;
        break;
      default:
        return;
    }

    setCarPosition(newPosition);
    if (map.current) {
      map.current.panTo(newPosition);
    }
  };

  return (
    <div className="App">
      <div className="sidebar" aria-live="polite">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
      {isLoading && <div className="loading">Loading map...</div>}
      {error && <div className="error">{error}</div>}
      <div ref={mapContainer} className="map-container" aria-label="Mapbox map" />
      <div className="instructions">
        Use arrow keys to move the car around the map
      </div>
    </div>
  );
}

export default App;
