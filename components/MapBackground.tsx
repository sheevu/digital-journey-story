
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { RouteDetails } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

interface Props {
  route: RouteDetails | null;
}

const MapBackground: React.FC<Props> = ({ route }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);

  useEffect(() => {
    const initMap = () => {
      if (!window.google?.maps?.Map || !mapRef.current) return;

      if (!googleMapRef.current) {
        googleMapRef.current = new window.google.maps.Map(mapRef.current, {
          zoom: 13,
          center: { lat: 28.6139, lng: 77.2090 }, // New Delhi
          disableDefaultUI: true,
          styles: [
            { "elementType": "geometry", "stylers": [{ "color": "#fdf8f1" }] },
            { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
            { "elementType": "labels.text.fill", "stylers": [{ "color": "#a86b3e" }] },
            { "elementType": "labels.text.stroke", "stylers": [{ "color": "#fdf8f1" }] },
            { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
            { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#ffe8d1" }] },
            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e3f2fd" }] },
            { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#f1f8e9" }] }
          ]
        });

        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map: googleMapRef.current,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#f59e0b",
            strokeWeight: 4,
            strokeOpacity: 0.6
          }
        });
      }
    };

    if (!window.google?.maps?.Map) {
        const interval = setInterval(() => {
            if (window.google?.maps?.Map) {
                clearInterval(interval);
                initMap();
            }
        }, 300);
        return () => clearInterval(interval);
    } else {
        initMap();
    }
  }, []);

  useEffect(() => {
    if (route && window.google?.maps?.DirectionsService && directionsRendererRef.current && googleMapRef.current) {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: route.startAddress,
          destination: route.endAddress,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result: any, status: any) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRendererRef.current.setDirections(result);
            const bounds = result.routes[0].bounds;
            googleMapRef.current.fitBounds(bounds);
          }
        }
      );
    }
  }, [route]);

  return (
    <div className="absolute inset-0 z-0 opacity-40 pointer-events-none mix-blend-multiply contrast-110">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFF9F2] via-transparent to-[#FFF9F2]"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#FFF9F2] via-transparent to-[#FFF9F2]"></div>
    </div>
  );
};

export default MapBackground;
