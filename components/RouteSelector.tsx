
import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, Autocomplete, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { MapPin, Navigation, Info, X, AlertCircle, Search, Map as MapIcon } from 'lucide-react';
import { Route } from '../types';

interface RouteSelectorProps {
  route: Route;
  onUpdate: (route: Route) => void;
  onClose: () => void;
}

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '500px'
};

const center = {
  lat: 40.4168,
  lng: -3.7038
};

export const RouteSelector: React.FC<RouteSelectorProps> = ({ route, onUpdate, onClose }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  const libraries = React.useMemo(() => ['places'] as any[], []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || "",
    libraries
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selecting, setSelecting] = useState<'origin' | 'destination' | null>(null);
  const [originInput, setOriginInput] = useState(route.origin?.address || '');
  const [destInput, setDestInput] = useState(route.destination?.address || '');
  const [manualDistance, setManualDistance] = useState(route.distanceKm ? String(route.distanceKm) : '');
  const [alternativeDistance, setAlternativeDistance] = useState('');
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const originAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const destAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (route.origin) setOriginInput(route.origin.address);
    if (route.destination) setDestInput(route.destination.address);
  }, [route.origin, route.destination]);

  const geocodeAddress = (address: string, type: 'origin' | 'destination') => {
    if (!address.trim()) return;
    if (!isLoaded) {
      const manualLocation = { lat: 0, lng: 0, address: address.trim() };
      onUpdate(type === 'origin' ? { ...route, origin: manualLocation } : { ...route, destination: manualLocation });
      return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const { lat, lng } = results[0].geometry.location;
        const newLocation = {
          lat: lat(),
          lng: lng(),
          address: results[0].formatted_address
        };

        if (type === 'origin') {
          onUpdate({ ...route, origin: newLocation });
          setOriginInput(newLocation.address);
        } else {
          onUpdate({ ...route, destination: newLocation });
          setDestInput(newLocation.address);
        }

        if (map) {
          map.panTo({ lat: lat(), lng: lng() });
          map.setZoom(12);
        }
      } else {
        const manualLocation = { lat: 0, lng: 0, address: address.trim() };
        onUpdate(type === 'origin' ? { ...route, origin: manualLocation } : { ...route, destination: manualLocation });
      }
    });
  };

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !selecting || !isLoaded) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      if (status === 'OK' && results && results[0]) {
        address = results[0].formatted_address;
      }

      if (selecting === 'origin') {
        onUpdate({
          ...route,
          origin: { lat, lng, address }
        });
      } else {
        onUpdate({
          ...route,
          destination: { lat, lng, address }
        });
      }
      setSelecting(null);
    });
  };

  useEffect(() => {
    if (isLoaded && route.origin && route.destination && route.origin.lat !== 0 && route.destination.lat !== 0) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: { lat: route.origin.lat, lng: route.origin.lng },
          destination: { lat: route.destination.lat, lng: route.destination.lng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            const routeData = result.routes[0].legs[0];
            if (routeData && routeData.distance) {
              const distKm = routeData.distance.value / 1000;
              if (Math.abs(distKm - route.distanceKm) > 0.1) {
                onUpdate({ ...route, distanceKm: distKm });
              }
            }
          } else {
            console.error(`error fetching directions ${result}`);
            setDirections(null);
          }
        }
      );
    } else {
      setDirections(null);
    }
  }, [isLoaded, route.origin, route.destination]);

  const updateManualDistance = (value: string) => {
    setManualDistance(value);
    const distance = Number(value);
    onUpdate({ ...route, distanceKm: Number.isFinite(distance) && distance > 0 ? distance : 0 });
  };

  const currentDistance = route.distanceKm > 0 ? route.distanceKm : Number(manualDistance) || 0;
  const alternativeKm = Number(alternativeDistance) || 0;
  const routeDeltaKm = alternativeKm > 0 && currentDistance > 0 ? alternativeKm - currentDistance : 0;
  const routeDeltaFuel = (routeDeltaKm / 100) * 35;
  const routeDeltaCo2 = routeDeltaFuel * 2.68;
  const useAlternativeRoute = () => {
    if (alternativeKm <= 0) return;
    setManualDistance(String(alternativeKm));
    onUpdate({ ...route, distanceKm: alternativeKm });
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
        <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-400" />
            <h3 className="font-black uppercase tracking-tighter italic">Planificador de Ruta Sustentable</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Cerrar">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-96 p-6 bg-gray-50 border-r border-gray-200 overflow-y-auto flex flex-col">
            <div className="space-y-6 flex-1">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Punto de Salida (Origen)</label>
                <div className="space-y-2">
                  <div className="relative">
                    {isLoaded ? (
                      <Autocomplete
                        onLoad={(autocomplete) => {
                          originAutocompleteRef.current = autocomplete;
                        }}
                        onPlaceChanged={() => {
                          const autocomplete = originAutocompleteRef.current;
                          if (autocomplete) {
                            const place = autocomplete.getPlace();
                            if (place.geometry) {
                              const newLocation = {
                                lat: place.geometry.location.lat(),
                                lng: place.geometry.location.lng(),
                                address: place.formatted_address || place.name
                              };
                              onUpdate({ ...route, origin: newLocation });
                              setOriginInput(newLocation.address);
                              if (map) map.panTo(newLocation);
                            }
                          }
                        }}
                      >
                        <input 
                          type="text"
                          value={originInput}
                          onChange={(e) => setOriginInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && geocodeAddress(originInput, 'origin')}
                          placeholder="Escriba la dirección de salida..."
                          className="w-full p-3 pr-10 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        />
                      </Autocomplete>
                    ) : (
                      <input 
                        type="text"
                        value={originInput}
                        onChange={(e) => setOriginInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && geocodeAddress(originInput, 'origin')}
                        placeholder="Escriba la direccion de salida..."
                        className="w-full p-3 pr-10 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                    )}
                    <button 
                      onClick={() => geocodeAddress(originInput, 'origin')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-500 transition-colors z-10"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => setSelecting('origin')}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${selecting === 'origin' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapIcon className={`w-4 h-4 ${route.origin ? 'text-blue-500' : 'text-gray-300'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Seleccionar en Mapa</span>
                    </div>
                    {route.origin && <MapPin className="w-4 h-4 text-blue-500" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Punto de Destino</label>
                <div className="space-y-2">
                  <div className="relative">
                    {isLoaded ? (
                      <Autocomplete
                        onLoad={(autocomplete) => {
                          destAutocompleteRef.current = autocomplete;
                        }}
                        onPlaceChanged={() => {
                          const autocomplete = destAutocompleteRef.current;
                          if (autocomplete) {
                            const place = autocomplete.getPlace();
                            if (place.geometry) {
                              const newLocation = {
                                lat: place.geometry.location.lat(),
                                lng: place.geometry.location.lng(),
                                address: place.formatted_address || place.name
                              };
                              onUpdate({ ...route, destination: newLocation });
                              setDestInput(newLocation.address);
                              if (map) map.panTo(newLocation);
                            }
                          }
                        }}
                      >
                        <input 
                          type="text"
                          value={destInput}
                          onChange={(e) => setDestInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && geocodeAddress(destInput, 'destination')}
                          placeholder="Escriba la dirección de destino..."
                          className="w-full p-3 pr-10 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
                        />
                      </Autocomplete>
                    ) : (
                      <input 
                        type="text"
                        value={destInput}
                        onChange={(e) => setDestInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && geocodeAddress(destInput, 'destination')}
                        placeholder="Escriba la direccion de destino..."
                        className="w-full p-3 pr-10 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
                      />
                    )}
                    <button 
                      onClick={() => geocodeAddress(destInput, 'destination')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors z-10"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => setSelecting('destination')}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${selecting === 'destination' ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : 'border-gray-200 bg-white hover:border-red-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapIcon className={`w-4 h-4 ${route.destination ? 'text-red-500' : 'text-gray-300'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Seleccionar en Mapa</span>
                    </div>
                    {route.destination && <MapPin className="w-4 h-4 text-red-500" />}
                  </button>
                </div>
              </div>

              {route.distanceKm > 0 && (
                <div className="p-4 bg-blue-600 text-white rounded-xl shadow-lg animate-in slide-in-from-left duration-300">
                  <div className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">Distancia Total</div>
                  <div className="text-2xl font-black italic">{route.distanceKm.toFixed(1)} km</div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Distancia manual (km)</label>
                <input
                  type="number"
                  min="0"
                  value={manualDistance}
                  onChange={(e) => updateManualDistance(e.target.value)}
                  placeholder="Ej: 125"
                  className="w-full p-3 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                />
              </div>

              <div className="p-4 bg-white border border-emerald-100 rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Ruta alternativa</div>
                    <div className="text-[10px] text-gray-400 font-bold">Compare dos rutas antes de confirmar</div>
                  </div>
                  <Navigation className="w-4 h-4 text-emerald-600" />
                </div>
                <input
                  type="number"
                  min="0"
                  value={alternativeDistance}
                  onChange={(e) => setAlternativeDistance(e.target.value)}
                  placeholder="Km de ruta B"
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                />
                {alternativeKm > 0 && currentDistance > 0 && (
                  <div className={`rounded-xl p-3 border ${routeDeltaKm <= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Km</div>
                        <div className="text-sm font-black">{Math.abs(routeDeltaKm).toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest opacity-70">Diesel</div>
                        <div className="text-sm font-black">{Math.abs(routeDeltaFuel).toFixed(1)} L</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest opacity-70">CO2</div>
                        <div className="text-sm font-black">{Math.abs(routeDeltaCo2).toFixed(1)} kg</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] font-bold text-center">
                      La ruta B {routeDeltaKm <= 0 ? 'ahorra' : 'requiere'} estos recursos frente a la ruta actual.
                    </div>
                    <button
                      onClick={useAlternativeRoute}
                      className="mt-3 w-full py-2 rounded-lg bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-800 transition-colors"
                    >
                      Usar ruta B
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <Info className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Instrucciones</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Haga clic en los botones de arriba y luego seleccione un punto en el mapa para establecer el origen y el destino de su envío.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-lg"
              >
                Confirmar Ruta
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-gray-200">
            {!apiKey ? (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center p-12">
                <div className="max-w-md text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <MapIcon className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h4 className="text-lg font-black text-gray-800 uppercase tracking-tighter italic">Ruta manual activa</h4>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    Puede escribir origen, destino y distancia sin seleccionar puntos en el mapa. Si configura <span className="font-bold text-gray-700">VITE_GOOGLE_MAPS_API_KEY</span>, se activara el mapa y el calculo automatico.
                  </p>
                </div>
              </div>
            ) : loadError ? (
              <div className="w-full h-full bg-red-50 flex items-center justify-center p-12">
                <div className="max-w-md text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                  <h4 className="text-lg font-black text-red-800 uppercase tracking-tighter italic">Error al cargar el mapa</h4>
                  <p className="text-xs text-red-600 font-medium">
                    {loadError.message || "Hubo un problema al conectar con los servicios de Google Maps. Verifique su conexión o la validez de su API Key."}
                  </p>
                </div>
              </div>
            ) : isLoaded ? (
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={route.origin || center}
                zoom={6}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={onMapClick}
                options={{
                  disableDefaultUI: false,
                  zoomControl: true,
                }}
              >
                {directions ? (
                  <DirectionsRenderer
                    directions={directions}
                    options={{
                      suppressMarkers: false,
                      polylineOptions: {
                        strokeColor: '#3b82f6',
                        strokeOpacity: 0.8,
                        strokeWeight: 5,
                      },
                    }}
                  />
                ) : (
                  <>
                    {route.origin && <Marker position={route.origin} label="O" />}
                    {route.destination && <Marker position={route.destination} label="D" />}
                    {route.origin && route.destination && (
                      <Polyline
                        path={[route.origin, route.destination]}
                        options={{
                          strokeColor: '#3b82f6',
                          strokeOpacity: 0.8,
                          strokeWeight: 3,
                          geodesic: true
                        }}
                      />
                    )}
                  </>
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cargando Google Maps...</p>
                </div>
              </div>
            )}
            
            {selecting && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest animate-bounce">
                Seleccione el punto de {selecting === 'origin' ? 'origen' : 'destino'} en el mapa
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
