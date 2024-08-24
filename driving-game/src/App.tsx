import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
  throw new Error('Mapbox token is missing. Please check your .env file.');
}

mapboxgl.accessToken = MAPBOX_TOKEN;

// Add this constant for the zoom level
const CONSTANT_ZOOM = 19;

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  // Update initial coordinates to Seattle, WA
  const [lng, setLng] = useState(-122.3321);
  const [lat, setLat] = useState(47.6062);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carRotation, setCarRotation] = useState(0);
  const [obstacles, setObstacles] = useState<[number, number][]>([]);
  const [keysPressed, setKeysPressed] = useState<Set<string>>(new Set());
  const [velocity, setVelocity] = useState<[number, number]>([0, 0]);

  const maxSpeed = 0.00001;
  const acceleration = 0.0000025;
  const deceleration = 0.05;

  // Add this new function to center the map
  const centerMap = useCallback((latitude: number, longitude: number) => {
    if (map.current) {
      map.current.flyTo({
        center: [longitude, latitude],
        zoom: CONSTANT_ZOOM,
        essential: true
      });
      setLng(longitude);
      setLat(latitude);
    }
  }, []);

  const updateCarPosition = useCallback(() => {
    if (map.current) {
      const newLng = lng - velocity[0];
      const newLat = lat - velocity[1];

      // Update the map's center to keep the car centered
      map.current.setCenter([newLng, newLat]);

      setLng(newLng);
      setLat(newLat);

      if (velocity[0] !== 0 || velocity[1] !== 0) {
        const angle = Math.atan2(velocity[1], -velocity[0]) * (180 / Math.PI);
        setCarRotation(angle);
      }

      obstacles.forEach(obstacle => {
        const distance = Math.sqrt(
          Math.pow(newLng - obstacle[0], 2) + Math.pow(newLat - obstacle[1], 2)
        );
        if (distance < 0.0001) {
          setVelocity([0, 0]);
        }
      });
    }
  }, [lng, lat, velocity, obstacles]);

  const updateVelocity = useCallback(() => {
    let newVelocity: [number, number] = [...velocity];
    let accelerationVector: [number, number] = [0, 0];

    if (keysPressed.has('ArrowUp')) accelerationVector[1] -= 1;
    if (keysPressed.has('ArrowDown')) accelerationVector[1] += 1;
    if (keysPressed.has('ArrowLeft')) accelerationVector[0] += 1;
    if (keysPressed.has('ArrowRight')) accelerationVector[0] -= 1;

    const magnitude = Math.sqrt(accelerationVector[0]**2 + accelerationVector[1]**2);
    if (magnitude !== 0) {
      accelerationVector[0] /= magnitude;
      accelerationVector[1] /= magnitude;
    }

    if (keysPressed.size > 0) {
      newVelocity[0] += accelerationVector[0] * acceleration;
      newVelocity[1] += accelerationVector[1] * acceleration;
    } else {
      newVelocity[0] *= (1 - deceleration);
      newVelocity[1] *= (1 - deceleration);
    }

    const speed = Math.sqrt(newVelocity[0]**2 + newVelocity[1]**2);
    if (speed < 0.0000001) {
      newVelocity = [0, 0];
    } else if (speed > maxSpeed) {
      newVelocity[0] = (newVelocity[0] / speed) * maxSpeed;
      newVelocity[1] = (newVelocity[1] / speed) * maxSpeed;
    }

    setVelocity(newVelocity);
  }, [keysPressed, velocity]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setKeysPressed(prev => new Set(prev).add(e.key));
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      setKeysPressed(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [lng, lat],
      zoom: CONSTANT_ZOOM,
      scrollZoom: false,
    });

    // Disable double-click zoom
    map.current.doubleClickZoom.disable();

    // Disable map rotation
    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();

    map.current.on('load', () => {
      setIsLoading(false);

      const newObstacles: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        newObstacles.push([
          lng + (Math.random() - 0.5) * 0.02,
          lat + (Math.random() - 0.5) * 0.02
        ]);
      }
      setObstacles(newObstacles);

      if (map.current) {
        map.current.addLayer({
          id: 'obstacles',
          type: 'circle',
          source: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: newObstacles.map(obstacle => ({
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
      }
    });

    map.current.on('error', (e) => {
      setError(`Mapbox error: ${e.error.message}`);
      setIsLoading(false);
    });

    // Add this to ensure the zoom level stays constant
    map.current.on('zoomend', () => {
      if (map.current && map.current.getZoom() !== CONSTANT_ZOOM) {
        map.current.zoomTo(CONSTANT_ZOOM);
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      map.current?.remove();
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const gameLoop = setInterval(() => {
      updateVelocity();
      updateCarPosition();
    }, 16);
    return () => clearInterval(gameLoop);
  }, [updateVelocity, updateCarPosition]);

  return (
    <div className="App">
      <div className="sidebar" aria-live="polite">
        Longitude: {lng.toFixed(4)} | Latitude: {lat.toFixed(4)} | Zoom: {CONSTANT_ZOOM}
      </div>
      {isLoading && <div className="loading">Loading map...</div>}
      {error && <div className="error">{error}</div>}
      <div
        ref={mapContainer}
        className="map-container"
        aria-label="Mapbox map"
      />
      <div
        className="car-overlay"
        style={{
          transform: `translate(-50%, -50%) rotate(${carRotation}deg)`,
          left: `50%`,
          top: `50%`,
        }}
      >
        <img src="/images/car.png" alt="Car" className="car-image" />
      </div>
      <div className="instructions">
        Use arrow keys to move the car around the map
      </div>
      <button onClick={() => centerMap(47.6062, -122.3321)}>Center on Seattle</button>
    </div>
  );
}

export default App;
