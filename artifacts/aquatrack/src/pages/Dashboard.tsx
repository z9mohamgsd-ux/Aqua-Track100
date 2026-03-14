import { useEffect, useState, useCallback, useMemo } from 'react';
import { SensorCard } from '@/components/Dashboard/SensorCard';
import { Charts } from '@/components/Dashboard/Charts';
import { StatusBar } from '@/components/Dashboard/StatusBar';
import { AlertContainer } from '@/components/Alerts/AlertToast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, Wifi, RefreshCw, AlertTriangle, LayoutGrid, MonitorCheck } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import type { DeviceWithLocation, SensorReading, Alert, SensorStatus } from '@/types';

const THRESHOLDS = {
  ph: { min: 6.0, max: 8.5, unit: '' },
  temperature: { min: 15.0, max: 35.0, unit: '°C' },
  turbidity: { min: 0, max: 5.0, unit: 'NTU' },
  conductivity: { min: 100.0, max: 300.0, unit: 'µS/cm' },
};

function getValueStatus(value: number, min: number, max: number): SensorStatus {
  const warningZone = (max - min) * 0.1;

  if (value < min || value > max) {
    return {
      status: 'danger',
      severity: 'critical',
      message: value < min ? 'Below safe minimum' : 'Above safe maximum',
    };
  }

  if (value < min + warningZone || value > max - warningZone) {
    return {
      status: 'warning',
      severity: 'medium',
      message: 'Approaching unsafe levels',
    };
  }

  return { status: 'safe', severity: 'none', message: 'Within safe range' };
}

export function Dashboard() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  // Empty set = "All Devices"
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await apiService.getLatestData();
      if (response.success) {
        setDevices(response.data);
        const allReadings = response.data
          .filter((d) => d.readings)
          .map((d) => d.readings!);

        setReadings((prev) => {
          const combined = [...prev, ...allReadings];
          return combined.slice(-1000);
        });
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await apiService.getActiveAlerts();
      if (response.success) {
        setAlerts(response.data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAlerts();
  }, [fetchData, fetchAlerts]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
      fetchAlerts();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchAlerts]);

  const handleSensorData = useCallback((data: any) => {
    if (data.reading) {
      setReadings((prev) => {
        const updated = [...prev, data.reading];
        return updated.slice(-1000);
      });

      setDevices((prev) => {
        const index = prev.findIndex((d) => d.deviceId === data.device.deviceId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data.device };
          return updated;
        }
        return prev;
      });

      setLastUpdated(new Date());
    }
  }, []);

  const handleAlert = useCallback((alert: Alert) => {
    setAlerts((prev) => {
      if (prev.find((a) => a.id === alert.id)) return prev;
      return [alert, ...prev];
    });
  }, []);

  const handleAlertResolved = useCallback((data: { alertId: string }) => {
    setAlerts((prev) => prev.filter((a) => a.id !== data.alertId));
  }, []);

  const { connectionStatus } = useWebSocket({
    userId: user?.id,
    onSensorData: handleSensorData,
    onAlert: handleAlert,
    onAlertResolved: handleAlertResolved,
  });

  const handleDismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId));
  }, []);

  const handleResolveAlert = useCallback(async (alertId: string) => {
    try {
      await apiService.clearAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  }, []);

  // Device filter handlers
  const toggleDeviceSelection = useCallback((deviceId: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, []);

  const selectAllDevices = useCallback(() => {
    setSelectedDeviceIds(new Set());
  }, []);

  // Filtered readings based on selection
  const filteredReadings = useMemo(() => {
    if (selectedDeviceIds.size === 0) return readings;
    return readings.filter((r) => selectedDeviceIds.has(r.deviceId));
  }, [readings, selectedDeviceIds]);

  const latestReadings = useMemo(() => {
    const latest: Record<string, SensorReading> = {};
    filteredReadings.forEach((r) => {
      if (
        !latest[r.deviceId] ||
        new Date(r.timestamp) > new Date(latest[r.deviceId].timestamp)
      ) {
        latest[r.deviceId] = r;
      }
    });
    return latest;
  }, [filteredReadings]);

  const averageValues = useMemo(() => {
    const values = Object.values(latestReadings);
    if (values.length === 0) return null;

    return {
      ph: values.reduce((sum, r) => sum + r.ph, 0) / values.length,
      temperature: values.reduce((sum, r) => sum + r.temperature, 0) / values.length,
      turbidity: values.reduce((sum, r) => sum + r.turbidity, 0) / values.length,
      conductivity: values.reduce((sum, r) => sum + r.conductivity, 0) / values.length,
    };
  }, [latestReadings]);

  const getHistory = (parameter: 'ph' | 'temperature' | 'turbidity' | 'conductivity') => {
    return filteredReadings.slice(-20).map((r) => r[parameter]);
  };

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));
  const connectedDevices = devices.filter((d) => d.status === 'connected').length;
  const isAllSelected = selectedDeviceIds.size === 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AlertContainer
        alerts={visibleAlerts}
        onDismiss={handleDismissAlert}
        onResolve={handleResolveAlert}
      />

      <StatusBar
        connectionStatus={connectionStatus}
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
        deviceCount={devices.length}
        connectedDevices={connectedDevices}
      />

      {/* Device Status + API Hint */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-lg ${
                  connectedDevices > 0 ? 'bg-emerald-500/10' : 'bg-muted'
                }`}
              >
                <Cpu
                  className={`w-6 h-6 ${
                    connectedDevices > 0 ? 'text-emerald-500' : 'text-muted-foreground'
                  }`}
                />
              </div>
              <div>
                <h3 className="font-semibold">Device Status</h3>
                <p className="text-sm text-muted-foreground">
                  {connectedDevices > 0 ? (
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-emerald-500" />
                      {connectedDevices} device{connectedDevices !== 1 ? 's' : ''} online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Waiting for devices...
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono self-start sm:self-auto">
              POST /api/sensor-data
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Device Filter */}
      {devices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
            <LayoutGrid className="w-3.5 h-3.5" />
            View:
          </span>

          <Button
            variant={isAllSelected ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs rounded-full px-3 ${
              isAllSelected ? 'shadow-sm' : ''
            }`}
            onClick={selectAllDevices}
          >
            All Devices
            <Badge
              variant="secondary"
              className={`ml-1.5 text-xs px-1.5 py-0 h-4 ${
                isAllSelected ? 'bg-white/20 text-white' : ''
              }`}
            >
              {devices.length}
            </Badge>
          </Button>

          {devices.map((device) => {
            const isSelected = selectedDeviceIds.has(device.deviceId);
            const isOnline = device.status === 'connected';

            return (
              <Button
                key={device.deviceId}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                className={`h-7 text-xs rounded-full px-3 gap-1.5 ${
                  isSelected ? 'shadow-sm' : ''
                }`}
                onClick={() => toggleDeviceSelection(device.deviceId)}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-400' : 'bg-muted-foreground/40'
                  } ${isSelected ? 'bg-white/70' : ''}`}
                />
                {device.name || device.deviceId}
                {isSelected && (
                  <MonitorCheck className="w-3 h-3 opacity-80" />
                )}
              </Button>
            );
          })}

          {!isAllSelected && (
            <span className="text-xs text-muted-foreground">
              Showing {selectedDeviceIds.size} device{selectedDeviceIds.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Sensor Cards */}
      {averageValues ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SensorCard
            title="pH Level"
            value={averageValues.ph}
            unit={THRESHOLDS.ph.unit}
            icon="ph"
            status={getValueStatus(averageValues.ph, THRESHOLDS.ph.min, THRESHOLDS.ph.max)}
            min={0}
            max={14}
            history={getHistory('ph')}
            batteryLevel={85}
          />
          <SensorCard
            title="Temperature"
            value={averageValues.temperature}
            unit={THRESHOLDS.temperature.unit}
            icon="temperature"
            status={getValueStatus(
              averageValues.temperature,
              THRESHOLDS.temperature.min,
              THRESHOLDS.temperature.max
            )}
            min={0}
            max={50}
            history={getHistory('temperature')}
            batteryLevel={78}
          />
          <SensorCard
            title="Turbidity"
            value={averageValues.turbidity}
            unit={THRESHOLDS.turbidity.unit}
            icon="turbidity"
            status={getValueStatus(
              averageValues.turbidity,
              THRESHOLDS.turbidity.min,
              THRESHOLDS.turbidity.max
            )}
            min={0}
            max={10}
            history={getHistory('turbidity')}
            batteryLevel={92}
          />
          <SensorCard
            title="Conductivity"
            value={averageValues.conductivity}
            unit={THRESHOLDS.conductivity.unit}
            icon="conductivity"
            status={getValueStatus(
              averageValues.conductivity,
              THRESHOLDS.conductivity.min,
              THRESHOLDS.conductivity.max
            )}
            min={0}
            max={500}
            history={getHistory('conductivity')}
            batteryLevel={88}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="p-10">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">
                {selectedDeviceIds.size > 0
                  ? 'No data from selected devices'
                  : 'No sensor data available'}
              </p>
              <p className="text-sm mt-1">
                {selectedDeviceIds.size > 0 ? (
                  'The selected devices have not sent any readings yet.'
                ) : (
                  <>
                    Register a device and send data to{' '}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      POST /api/sensor-data
                    </code>
                  </>
                )}
              </p>
              {selectedDeviceIds.size === 0 && (
                <div className="mt-4 p-4 bg-muted rounded-lg text-left max-w-md mx-auto">
                  <p className="text-xs font-semibold mb-2">Example payload:</p>
                  <pre className="text-xs overflow-x-auto">{`{
  "deviceId": "station-001",
  "ph": 7.2,
  "temperature": 25.1,
  "turbidity": 2.4,
  "conductivity": 210,
  "latitude": 30.0444,
  "longitude": 31.2357
}`}</pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Charts data={filteredReadings} />
    </div>
  );
}

export default Dashboard;
