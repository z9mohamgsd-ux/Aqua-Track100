import { useEffect, useState, useCallback } from 'react';
import { DeviceList } from '@/components/Devices/DeviceList';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { DeviceWithLocation } from '@/types';

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await apiService.getAllDevices();
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

  const handleRegister = useCallback(async (name: string, deviceId: string) => {
    await apiService.registerDevice(name, deviceId);
    await fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async (deviceId: string) => {
    await apiService.deleteDevice(deviceId);
    setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
  }, []);

  useWebSocket({
    onSensorData: (data) => {
      setDevices((prev) => {
        const index = prev.findIndex((d) => d.deviceId === data.device.deviceId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data.device };
          return updated;
        }
        return prev;
      });
    },
    onDeviceRegistered: () => {
      fetchData();
    },
    onDeviceDeleted: ({ deviceId }) => {
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
    },
  });

  return (
    <DeviceList
      devices={devices}
      onRefresh={fetchData}
      isRefreshing={isRefreshing}
      onRegister={handleRegister}
      onDelete={handleDelete}
    />
  );
}

export default DevicesPage;
