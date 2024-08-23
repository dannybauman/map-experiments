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
  const [lng, setLng] = useState(-71.0752);
  const [lat, setLat] = useState(42.3356);
  const [zoom, setZoom] = useState(19);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carPosition, setCarPosition] = useState<[number, number]>([0, 0]);
  const [carRotation, setCarRotation] = useState(0);
  const [obstacles, setObstacles] = useState<[number, number][]>([]);
  const [keysPressed, setKeysPressed] = useState<Set<string>>(new Set());
  const maxSpeed = 0.00001; // Reduced by 10x from 0.0001
  const acceleration = 0.0000025; // Reduced by 2x from 0.000005
  const deceleration = 0.05; // Kept the same
  const [velocity, setVelocity] = useState<[number, number]>([0, 0]);

  const updateCarPosition = useCallback(() => {
    if (map.current) {
      const newLng = lng - velocity[0];
      const newLat = lat - velocity[1];

      map.current.panTo([newLng, newLat], { animate: false });
      setLng(newLng);
      setLat(newLat);

      // Update car rotation based on velocity
      if (velocity[0] !== 0 || velocity[1] !== 0) {
        const angle = Math.atan2(velocity[1], velocity[0]) * (180 / Math.PI); // Removed negation
        setCarRotation(angle);
      }

      // Check for collisions
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

    // Normalize acceleration vector
    const magnitude = Math.sqrt(accelerationVector[0]**2 + accelerationVector[1]**2);
    if (magnitude !== 0) {
      accelerationVector[0] /= magnitude;
      accelerationVector[1] /= magnitude;
    }

    // Apply acceleration only if keys are pressed
    if (keysPressed.size > 0) {
      newVelocity[0] += accelerationVector[0] * acceleration;
      newVelocity[1] += accelerationVector[1] * acceleration;
    } else {
      // Apply deceleration when no keys are pressed
      newVelocity[0] *= (1 - deceleration);
      newVelocity[1] *= (1 - deceleration);
    }

    // Stop the car if the speed is very low
    const speed = Math.sqrt(newVelocity[0]**2 + newVelocity[1]**2);
    if (speed < 0.0000001) { // Adjusted threshold to match new speed scale
      newVelocity = [0, 0];
    }

    // Limit speed
    if (speed > maxSpeed) {
      newVelocity[0] = (newVelocity[0] / speed) * maxSpeed;
      newVelocity[1] = (newVelocity[1] / speed) * maxSpeed;
    }

    setVelocity(newVelocity);
  }, [keysPressed, velocity, acceleration, deceleration, maxSpeed]);

  useEffect(() => {
    const gameLoop = setInterval(() => {
      updateVelocity();
      updateCarPosition();
    }, 16); // ~60 fps
    return () => clearInterval(gameLoop);
  }, [updateVelocity, updateCarPosition]);

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

        // Add obstacles
        if (map.current) {
          map.current.addLayer({
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
        }
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
    // Generate random obstacles
    const newObstacles: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      newObstacles.push([
        lng + (Math.random() - 0.5) * 0.02,
        lat + (Math.random() - 0.5) * 0.02
      ]);
    }
    setObstacles(newObstacles);
  }, [lng, lat]);

  return (
    <div className="App">
      <div className="sidebar" aria-live="polite">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
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
          transform: `translate(-50%, -50%) rotate(${carRotation}deg)`
        }}
      >
        <img src="/images/car.png" alt="Car" className="car-image" />
      </div>
      <div className="instructions">
        Use arrow keys to move the car around the map
      </div>
    </div>
  );
}

export default App;
