import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  History, 
  Download, 
  RefreshCw, 
  Search,
  Calendar,
  Droplets,
  Thermometer,
  Activity,
  Zap
} from 'lucide-react';
import { apiService } from '@/services/api';
import type { SensorReading, DeviceWithLocation } from '@/types';
import { format } from 'date-fns';

export function HistoryPage() {
  const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [hours, setHours] = useState<string>('24');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDevices = useCallback(async () => {
    try {
      const response = await apiService.getAllDevices();
      if (response.success) {
        setDevices(response.data);
        if (response.data.length > 0 && !selectedDevice) {
          setSelectedDevice(response.data[0].deviceId);
        }
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  }, [selectedDevice]);

  const fetchHistory = useCallback(async () => {
    if (!selectedDevice) return;
    
    try {
      setIsLoading(true);
      const response = await apiService.getDeviceHistory(
        selectedDevice,
        parseInt(hours),
        100
      );
      if (response.success) {
        setReadings(response.data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice, hours]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const downloadCSV = () => {
    const headers = ['Timestamp', 'Device ID', 'pH', 'Temperature (°C)', 'Turbidity (NTU)', 'Conductivity (µS/cm)'];
    const csvContent = [
      headers.join(','),
      ...readings.map((row) => [
        format(new Date(row.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        row.deviceId,
        row.ph,
        row.temperature,
        row.turbidity,
        row.conductivity,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `history-${selectedDevice}-${hours}h-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const filteredReadings = readings.filter((r) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      r.deviceId.toLowerCase().includes(searchLower) ||
      r.ph.toString().includes(searchLower) ||
      r.temperature.toString().includes(searchLower) ||
      r.turbidity.toString().includes(searchLower) ||
      r.conductivity.toString().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Data History
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                View and export historical sensor data
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 space-y-2">
              <Label>Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.deviceId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 space-y-2">
              <Label>Time Range</Label>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 1 hour</SelectItem>
                  <SelectItem value="6">Last 6 hours</SelectItem>
                  <SelectItem value="24">Last 24 hours</SelectItem>
                  <SelectItem value="168">Last 7 days</SelectItem>
                  <SelectItem value="720">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search readings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={fetchHistory}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={downloadCSV}
                disabled={readings.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Droplets className="w-4 h-4" />
                Avg pH
              </div>
              <p className="text-lg font-semibold">
                {readings.length > 0
                  ? (readings.reduce((s, r) => s + r.ph, 0) / readings.length).toFixed(2)
                  : '--'}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Thermometer className="w-4 h-4" />
                Avg Temp
              </div>
              <p className="text-lg font-semibold">
                {readings.length > 0
                  ? (readings.reduce((s, r) => s + r.temperature, 0) / readings.length).toFixed(1)
                  : '--'}°C
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Activity className="w-4 h-4" />
                Avg Turbidity
              </div>
              <p className="text-lg font-semibold">
                {readings.length > 0
                  ? (readings.reduce((s, r) => s + r.turbidity, 0) / readings.length).toFixed(1)
                  : '--'} NTU
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Zap className="w-4 h-4" />
                Avg Conductivity
              </div>
              <p className="text-lg font-semibold">
                {readings.length > 0
                  ? (readings.reduce((s, r) => s + r.conductivity, 0) / readings.length).toFixed(0)
                  : '--'} µS/cm
              </p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>pH</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Turbidity</TableHead>
                  <TableHead>Conductivity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredReadings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReadings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(reading.timestamp), 'MMM dd, HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{reading.deviceId}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={
                          reading.ph < 6 || reading.ph > 8.5
                            ? 'text-red-500 font-medium'
                            : reading.ph < 6.5 || reading.ph > 8
                              ? 'text-amber-500'
                              : ''
                        }>
                          {reading.ph.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={
                          reading.temperature < 15 || reading.temperature > 35
                            ? 'text-red-500 font-medium'
                            : reading.temperature < 18 || reading.temperature > 32
                              ? 'text-amber-500'
                              : ''
                        }>
                          {reading.temperature.toFixed(1)}°C
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={
                          reading.turbidity > 5
                            ? 'text-red-500 font-medium'
                            : reading.turbidity > 3
                              ? 'text-amber-500'
                              : ''
                        }>
                          {reading.turbidity.toFixed(1)} NTU
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={
                          reading.conductivity < 100 || reading.conductivity > 300
                            ? 'text-red-500 font-medium'
                            : reading.conductivity < 150 || reading.conductivity > 250
                              ? 'text-amber-500'
                              : ''
                        }>
                          {reading.conductivity.toFixed(0)} µS/cm
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Showing {filteredReadings.length} of {readings.length} readings
            </span>
            <span>
              Device: {selectedDevice || 'None selected'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HistoryPage;
