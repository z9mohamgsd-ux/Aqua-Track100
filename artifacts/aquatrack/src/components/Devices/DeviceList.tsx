import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Cpu,
  Wifi,
  WifiOff,
  MapPin,
  Clock,
  Droplets,
  Thermometer,
  Activity,
  Zap,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';
import type { DeviceWithLocation } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface DeviceListProps {
  devices: DeviceWithLocation[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onRegister?: (name: string, deviceId: string) => Promise<void>;
  onDelete?: (deviceId: string) => Promise<void>;
}

function SignalIndicator({ status }: { status: 'connected' | 'disconnected' }) {
  const bars = status === 'connected' ? 4 : 0;

  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-sm transition-all ${
            bar <= bars
              ? 'bg-emerald-500 h-full'
              : 'bg-gray-300 dark:bg-gray-600 h-1/2'
          }`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </div>
  );
}

function getDeviceOverallStatus(device: DeviceWithLocation): 'safe' | 'warning' | 'danger' {
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

function getStatusColor(status: 'safe' | 'warning' | 'danger') {
  const colors = {
    safe: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    danger: 'text-red-600 dark:text-red-400 bg-red-500/10',
  };
  return colors[status];
}

export function DeviceList({
  devices,
  onRefresh,
  isRefreshing = false,
  onRegister,
  onDelete,
}: DeviceListProps) {
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const connectedCount = devices.filter((d) => d.status === 'connected').length;
  const disconnectedCount = devices.length - connectedCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !deviceId.trim()) {
      setFormError('Both device name and ID are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onRegister?.(name.trim(), deviceId.trim());
      setName('');
      setDeviceId('');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to register device.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await onDelete?.(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{devices.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Cpu className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="text-2xl font-bold text-emerald-600">{connectedCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Wifi className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold text-red-600">{disconnectedCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <WifiOff className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4" />
            Register New Device
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="device-name" className="text-xs text-muted-foreground">
                Device Name
              </Label>
              <Input
                id="device-name"
                placeholder="e.g. Garden Sensor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="device-id" className="text-xs text-muted-foreground">
                Device ID
              </Label>
              <Input
                id="device-id"
                placeholder="e.g. station-001"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Add Device
              </Button>
            </div>
          </form>
          {formError && (
            <p className="text-xs text-red-500 mt-2">{formError}</p>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            The Device ID must match what your Arduino/ESP32 sends in the{' '}
            <code className="bg-muted px-1 py-0.5 rounded">deviceId</code> field.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Registered Devices</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No devices registered yet.</p>
              <p className="text-xs mt-1">Add your first device using the form above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const overallStatus = getDeviceOverallStatus(device);
                const statusColor = getStatusColor(overallStatus);

                return (
                  <div
                    key={device.deviceId}
                    className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-lg shrink-0 ${statusColor}`}>
                        <Cpu className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold truncate">
                            {device.name || device.deviceId}
                          </span>
                          {device.name && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {device.deviceId}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 ml-auto">
                            <SignalIndicator status={device.status} />
                            <Badge
                              variant={device.status === 'connected' ? 'default' : 'secondary'}
                              className={`text-xs ${
                                device.status === 'connected'
                                  ? 'bg-emerald-500 hover:bg-emerald-600'
                                  : ''
                              }`}
                            >
                              {device.status === 'connected' ? 'Online' : 'Offline'}
                            </Badge>
                          </div>
                        </div>

                        {device.lastSeen ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                            <Clock className="w-3 h-3" />
                            Last seen{' '}
                            {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-2">
                            Waiting for first data...
                          </p>
                        )}

                        {device.location?.latitude && device.location?.longitude && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                            <MapPin className="w-3 h-3" />
                            {device.location.latitude.toFixed(4)},{' '}
                            {device.location.longitude.toFixed(4)}
                          </p>
                        )}

                        {device.readings ? (
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <Droplets className="w-3 h-3" />
                                pH
                              </div>
                              <p className={`font-semibold text-sm ${
                                device.readings.ph < 6 || device.readings.ph > 8.5
                                  ? 'text-red-500'
                                  : device.readings.ph < 6.5 || device.readings.ph > 8
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                              }`}>
                                {device.readings.ph.toFixed(1)}
                              </p>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <Thermometer className="w-3 h-3" />
                                Temp
                              </div>
                              <p className={`font-semibold text-sm ${
                                device.readings.temperature < 15 || device.readings.temperature > 35
                                  ? 'text-red-500'
                                  : device.readings.temperature < 18 || device.readings.temperature > 32
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                              }`}>
                                {device.readings.temperature.toFixed(1)}°
                              </p>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <Activity className="w-3 h-3" />
                                Turb
                              </div>
                              <p className={`font-semibold text-sm ${
                                device.readings.turbidity > 5
                                  ? 'text-red-500'
                                  : device.readings.turbidity > 3
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                              }`}>
                                {device.readings.turbidity.toFixed(1)}
                              </p>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                                <Zap className="w-3 h-3" />
                                Cond
                              </div>
                              <p className={`font-semibold text-sm ${
                                device.readings.conductivity < 100 || device.readings.conductivity > 300
                                  ? 'text-red-500'
                                  : device.readings.conductivity < 150 || device.readings.conductivity > 250
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                              }`}>
                                {device.readings.conductivity.toFixed(0)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-2 p-2 rounded bg-muted/50 text-center">
                            No readings yet — waiting for Arduino data
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 shrink-0"
                      onClick={() => handleDelete(device.deviceId)}
                      disabled={deletingId === device.deviceId}
                    >
                      {deletingId === device.deviceId ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DeviceList;
