import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Calendar, 
  TrendingUp,
  Droplets,
  Thermometer,
  Activity
} from 'lucide-react';
import type { SensorReading, TimeRange } from '@/types';
import { format, subHours, subDays, isAfter } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChartsProps {
  data: SensorReading[];
  deviceId?: string;
}

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '1H', label: 'Last Hour' },
  { value: '24H', label: 'Last 24 Hours' },
  { value: '7D', label: 'Last 7 Days' },
  { value: '30D', label: 'Last 30 Days' },
];

export function Charts({ data, deviceId }: ChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [activeCharts, setActiveCharts] = useState({
    ph: true,
    temperature: true,
    turbidity: false,
  });

  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case '1H':
        cutoff = subHours(now, 1);
        break;
      case '24H':
        cutoff = subHours(now, 24);
        break;
      case '7D':
        cutoff = subDays(now, 7);
        break;
      case '30D':
        cutoff = subDays(now, 30);
        break;
      default:
        cutoff = subHours(now, 24);
    }

    return data
      .filter((reading) => {
        const readingDate = new Date(reading.timestamp);
        return isAfter(readingDate, cutoff);
      })
      .map((reading) => ({
        ...reading,
        formattedTime: format(new Date(reading.timestamp), 
          timeRange === '1H' ? 'HH:mm' : 'MMM dd HH:mm'
        ),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [data, timeRange]);

  const downloadCSV = () => {
    const headers = ['Timestamp', 'pH', 'Temperature (°C)', 'Turbidity (NTU)', 'Conductivity (µS/cm)'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map((row) => [
        format(new Date(row.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        row.ph,
        row.temperature,
        row.turbidity,
        row.conductivity,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sensor-data-${deviceId || 'all'}-${timeRange}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const toggleChart = (chart: keyof typeof activeCharts) => {
    setActiveCharts((prev) => ({ ...prev, [chart]: !prev[chart] }));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Sensor Trends
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Historical data visualization
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  {timeRangeOptions.find((o) => o.value === timeRange)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {timeRangeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setTimeRange(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex gap-1">
              <Button
                variant={activeCharts.ph ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleChart('ph')}
                className="gap-1"
              >
                <Droplets className="w-3 h-3" />
                pH
              </Button>
              <Button
                variant={activeCharts.temperature ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleChart('temperature')}
                className="gap-1"
              >
                <Thermometer className="w-3 h-3" />
                Temp
              </Button>
              <Button
                variant={activeCharts.turbidity ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleChart('turbidity')}
                className="gap-1"
              >
                <Activity className="w-3 h-3" />
                Turb
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2">
              <Download className="w-4 h-4" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
            <p>No data available for the selected time range</p>
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="formattedTime" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  yAxisId="left" 
                  tick={{ fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {activeCharts.ph && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="ph"
                    name="pH"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                )}
                
                {activeCharts.temperature && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    name="Temperature (°C)"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                )}
                
                {activeCharts.turbidity && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="turbidity"
                    name="Turbidity (NTU)"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className="text-xs">
            {filteredData.length} readings
          </Badge>
          <Badge variant="outline" className="text-xs">
            Device: {deviceId || 'All devices'}
          </Badge>
          {filteredData.length > 0 && (
            <Badge variant="outline" className="text-xs">
              From: {format(new Date(filteredData[0].timestamp), 'MMM dd, HH:mm')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default Charts;
