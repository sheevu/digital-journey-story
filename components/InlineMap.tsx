
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { RouteDetails } from '../types';

interface Props {
  route: RouteDetails;
  smoothProgress: number; // 0.0 to 1.0 (journey-wide progress)
  totalSegments: number;
}

const InlineMap: React.FC<Props> = ({ route, smoothProgress, totalSegments }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const progressMarkerRef = useRef<any>(null);
  const routePathRef = useRef<any[]>([]);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  useEffect(() => {
    let interval: any;
    const checkApi = () => {
      if (window.google?.maps?.Map && window.google?.maps?.geometry) {
        setIsApiLoaded(true);
        if (interval) clearInterval(interval);
      }
    };

    checkApi();
    if (!isApiLoaded) {
      interval = setInterval(checkApi, 200);
    }
    return () => { if (interval) clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!isApiLoaded || !mapRef.current) return;

    if (!googleMapRef.current) {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 16,
        center: { lat: 0, lng: 0 },
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'cooperative',
        styles: [
            { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
            { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
            { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
            { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
            { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] }
        ]
      });

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: googleMapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#1A1A1A",
          strokeWeight: 6,
          strokeOpacity: 0.95
        }
      });
    }
  }, [isApiLoaded]);

  useEffect(() => {
    if (isApiLoaded && route && directionsRendererRef.current && googleMapRef.current) {
        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
          {
            origin: route.startAddress,
            destination: route.endAddress,
            travelMode: window.google.maps.TravelMode[route.travelMode],
          },
          (result: any, status: any) => {
            if (status === window.google.maps.DirectionsStatus.OK) {
              directionsRendererRef.current.setDirections(result);
              routePathRef.current = result.routes[0].overview_path;

              if (!progressMarkerRef.current) {
                  progressMarkerRef.current = new window.google.maps.Marker({
                      map: googleMapRef.current,
                      position: routePathRef.current[0],
                      zIndex: 1000,
                      icon: {
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 10,
                          fillColor: "#1A1A1A",
                          fillOpacity: 1,
                          strokeColor: "#FFFFFF",
                          strokeWeight: 4,
                      },
                      optimized: false
                  });
              }
              
              const bounds = result.routes[0].bounds;
              googleMapRef.current.fitBounds(bounds);
              setTimeout(() => {
                  googleMapRef.current.setZoom(16);
              }, 100);
            }
          }
        );
      }
  }, [isApiLoaded, route]);

  useEffect(() => {
      if (!isApiLoaded || !progressMarkerRef.current || routePathRef.current.length === 0 || !window.google?.maps?.geometry) return;

      const path = routePathRef.current;
      const progress = Math.max(0, Math.min(1, smoothProgress));
      const geometry = window.google.maps.geometry.spherical;
      
      let totalDistance = 0;
      const distances = [0];
      for (let i = 0; i < path.length - 1; i++) {
          const d = geometry.computeDistanceBetween(path[i], path[i+1]);
          totalDistance += d;
          distances.push(totalDistance);
      }

      const targetDistance = totalDistance * progress;
      
      let segmentIdx = 0;
      for (let i = 0; i < distances.length - 1; i++) {
          if (targetDistance >= distances[i] && targetDistance <= distances[i+1]) {
              segmentIdx = i;
              break;
          }
      }

      const segStartDist = distances[segmentIdx];
      const segEndDist = distances[segmentIdx+1];
      const segFraction = (targetDistance - segStartDist) / (segEndDist - segStartDist || 1);
      
      const newPos = geometry.interpolate(path[segmentIdx], path[segmentIdx+1], segFraction);
      
      if (newPos) {
          progressMarkerRef.current.setPosition(newPos);
          googleMapRef.current.panTo(newPos);
      }

  }, [isApiLoaded, smoothProgress]);

  return <div ref={mapRef} className="w-full h-full bg-stone-100" />;
};

export default InlineMap;
