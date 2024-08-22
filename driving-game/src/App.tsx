import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  const [carPosition, setCarPosition] = useState<[number, number]>([0, 0]);
  const [carRotation, setCarRotation] = useState(0);
  const [carSpeed, setCarSpeed] = useState<[number, number]>([0, 0]);
  const [obstacles, setObstacles] = useState<[number, number][]>([]);
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

        // Remove previous car layer if it exists
        if (map.current?.getLayer('car')) {
          map.current?.removeLayer('car');
          map.current?.removeSource('car');
        }

        // Add new car layer
        map.current?.addLayer({
          id: 'car',
          type: 'symbol',
          source: {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              }
            }
          },
          layout: {
            'icon-image': 'car',
            'icon-size': 0.1,
            'icon-rotate': carRotation,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        });

        // Add obstacles
        map.current?.addLayer({
          id: 'obstacles',
          type: 'circle',
          source: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: obstacles.map(obstacle => ({
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: obstacle
                }
              }))
            }
          },
          paint: {
            'circle-radius': 10,
            'circle-color': '#ff0000'
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
      document.addEventListener('keyup', handleKeyUp);
    } catch (error) {
      setError(`Error initializing map: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updateCarPosition = useCallback(() => {
    if (map.current) {
      const newLng = lng + carSpeed[0];
      const newLat = lat + carSpeed[1];
      setLng(newLng);
      setLat(newLat);
      map.current.panTo([newLng, newLat]);

      // Update car rotation
      if (carSpeed[0] !== 0 || carSpeed[1] !== 0) {
        const angle = Math.atan2(carSpeed[1], carSpeed[0]) * (180 / Math.PI);
        setCarRotation(angle);
      }

      // Check for collisions
      obstacles.forEach(obstacle => {
        const distance = Math.sqrt(
          Math.pow(newLng - obstacle[0], 2) + Math.pow(newLat - obstacle[1], 2)
        );
        if (distance < 0.0002) { // Adjust this value for collision sensitivity
          setCarSpeed([0, 0]);
        }
      });
    }
  }, [lng, lat, carSpeed, obstacles]);

  useEffect(() => {
    const gameLoop = setInterval(updateCarPosition, 50); // 20 fps
    return () => clearInterval(gameLoop);
  }, [updateCarPosition]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const acceleration = 0.00001;
    let newSpeed: [number, number] = [...carSpeed];

    switch (e.key) {
      case 'ArrowUp':
        newSpeed[1] += acceleration;
        break;
      case 'ArrowDown':
        newSpeed[1] -= acceleration;
        break;
      case 'ArrowLeft':
        newSpeed[0] -= acceleration;
        break;
      case 'ArrowRight':
        newSpeed[0] += acceleration;
        break;
      default:
        return;
    }

    setCarSpeed(newSpeed);
  }, [carSpeed]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setCarSpeed([0, 0]);
    }
  }, []);

  useEffect(() => {
    // Generate random obstacles
    const newObstacles: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      newObstacles.push([
        lng + (Math.random() - 0.5) * 0.02,
        lat + (Math.random() - 0.5) * 0.02
      ]);
    }
    setObstacles(newObstacles);
  }, []);

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