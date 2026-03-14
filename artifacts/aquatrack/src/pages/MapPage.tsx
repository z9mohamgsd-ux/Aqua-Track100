import { useEffect, useState, useCallback } from 'react';
import { MapView } from '@/components/Map/MapView';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import type { DeviceWithLocation } from '@/types';

export function MapPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await apiService.getLatestData();
      if (response.success) {
        setDevices(response.data);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useWebSocket({
    userId: user?.id,
    onSensorData: (data) => {
      setDevices((prev) => {
        const index = prev.findIndex((d) => d.deviceId === data.device.deviceId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data.device;
          return updated;
        }
        return [...prev, data.device];
      });
    },
  });

  return (
    <div className="h-[calc(100vh-2rem)] lg:h-[calc(100vh-4rem)] isolate">
      <MapView
        devices={devices}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}

export default MapPage;
