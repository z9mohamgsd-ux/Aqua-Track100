import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Layers,
  RefreshCw,
  Droplets,
  Thermometer,
  Activity,
  Zap,
  Search,
  Navigation,
  Crosshair,
} from 'lucide-react';
import type { DeviceWithLocation } from '@/types';
import { format } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const createStatusIcon = (status: 'safe' | 'warning' | 'danger') => {
  const colors = {
    safe: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.716 0 0 6.716 0 15c0 15 15 25 15 25s15-10 15-25c0-8.284-6.716-15-15-15z" fill="${colors[status]}"/>
        <circle cx="15" cy="15" r="8" fill="white"/>
      </svg>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
  });
};

function MapController({
  flyTo,
  onDone,
}: {
  flyTo: [number, number] | null;
  onDone: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (flyTo) {
      map.flyTo(flyTo, 15, { duration: 1.2 });
      onDone();
    }
  }, [flyTo, map, onDone]);

  return null;
}

function MapBoundsFitter({ devices }: { devices: DeviceWithLocation[] }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current) return;

    const validDevices = devices.filter(
      (d) => d.location?.latitude && d.location?.longitude
    );

    if (validDevices.length > 0) {
      fittedRef.current = true;
      const bounds = L.latLngBounds(
        validDevices.map((d) => [d.location!.latitude!, d.location!.longitude!])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [devices, map]);

  return null;
}

interface MapViewProps {
  devices: DeviceWithLocation[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function getDeviceStatus(device: DeviceWithLocation): 'safe' | 'warning' | 'danger' {
  if (!device.readings) return 'safe';

  const { ph, temperature, turbidity, conductivity } = device.readings;

  if (ph < 6 || ph > 8.5) return 'danger';
  if (temperature < 15 || temperature > 35) return 'danger';
  if (turbidity > 5) return 'danger';
  if (conductivity < 100 || conductivity > 300) return 'danger';

  if (ph < 6.5 || ph > 8) return 'warning';
  if (temperature < 18 || temperature > 32) return 'warning';
  if (turbidity > 3) return 'warning';
  if (conductivity < 150 || conductivity > 250) return 'warning';

  return 'safe';
}

export function MapView({ devices, onRefresh, isRefreshing = false }: MapViewProps) {
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const validDevices = devices.filter(
    (d) => d.location?.latitude && d.location?.longitude
  );

  const defaultCenter: [number, number] = [20, 0];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchQuery
        )}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        setFlyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        setSearchError('Location not found. Try a different search.');
      }
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setSearchError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTo([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
      },
      () => {
        setSearchError('Could not get your location.');
        setIsLocating(false);
      }
    );
  };

  const handleTeleport = () => {
    const device = validDevices.find((d) => d.deviceId === selectedDeviceId);
    if (device) {
      setFlyTo([device.location!.latitude!, device.location!.longitude!]);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4" />
              Device Map
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
              >
                <Layers className="w-4 h-4 mr-1" />
                {mapType === 'street' ? 'Satellite' : 'Street'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  disabled={isSearching}
                />
              </div>
              <Button type="submit" size="sm" disabled={isSearching} className="h-8">
                {isSearching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleCurrentLocation}
                disabled={isLocating}
                title="Use my current location"
              >
                {isLocating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
              </Button>
            </form>

            {validDevices.length > 0 && (
              <div className="flex gap-2">
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-0"
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                >
                  <option value="">Jump to device...</option>
                  {validDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.name || d.deviceId}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={handleTeleport}
                  disabled={!selectedDeviceId}
                  title="Center map on selected device"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {searchError && (
            <p className="text-xs text-red-500">{searchError}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 relative min-h-0 overflow-hidden">
        <div className="relative h-full min-h-[400px] overflow-hidden">
          <MapContainer
            center={defaultCenter}
            zoom={2}
            className="h-full w-full rounded-b-lg"
            style={{ minHeight: '400px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={
                mapType === 'satellite'
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              }
            />

            <MapBoundsFitter devices={devices} />
            <MapController flyTo={flyTo} onDone={() => setFlyTo(null)} />

            {validDevices.map((device) => {
              const status = getDeviceStatus(device);

              return (
                <Marker
                  key={device.deviceId}
                  position={[device.location!.latitude!, device.location!.longitude!]}
                  icon={createStatusIcon(status)}
                >
                  <Popup>
                    <div className="p-1 min-w-[180px]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm">
                          {device.name || device.deviceId}
                        </p>
                        <Badge
                          variant={device.status === 'connected' ? 'default' : 'secondary'}
                          className={`text-xs ml-2 ${
                            device.status === 'connected'
                              ? 'bg-emerald-500'
                              : ''
                          }`}
                        >
                          {device.status === 'connected' ? 'Online' : 'Offline'}
                        </Badge>
                      </div>

                      {device.name && (
                        <p className="text-xs text-gray-500 font-mono mb-2">
                          {device.deviceId}
                        </p>
                      )}

                      {device.readings ? (
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <Droplets className="w-3 h-3 text-blue-500" />
                            <span>pH: {device.readings.ph.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Thermometer className="w-3 h-3 text-orange-500" />
                            <span>Temp: {device.readings.temperature.toFixed(1)}°C</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="w-3 h-3 text-purple-500" />
                            <span>Turbidity: {device.readings.turbidity.toFixed(1)} NTU</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-500" />
                            <span>Conductivity: {device.readings.conductivity.toFixed(0)} µS/cm</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">No readings available yet</p>
                      )}

                      {device.lastSeen && (
                        <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                          Last seen: {format(new Date(device.lastSeen), 'MMM dd, HH:mm:ss')}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg z-[400]">
            <p className="text-xs font-semibold mb-2">Status Legend</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs">Safe</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs">Warning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs">Danger</span>
              </div>
            </div>
          </div>

          <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border shadow-lg z-[400]">
            <span className="text-sm font-medium">
              {validDevices.length} device{validDevices.length !== 1 ? 's' : ''} on map
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MapView;
