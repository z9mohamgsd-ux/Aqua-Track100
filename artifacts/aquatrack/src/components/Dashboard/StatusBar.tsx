import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Sun, 
  Moon,
  Cloud,
  CloudRain,
  Sun as SunIcon,
  Clock
} from 'lucide-react';
import type { ConnectionStatus } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  lastUpdated?: Date;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  deviceCount?: number;
  connectedDevices?: number;
}

const weatherData = {
  temp: 24,
  condition: 'partly-cloudy' as 'partly-cloudy' | 'rainy' | 'sunny',
  humidity: 65,
};

const connectionStatusColors = {
  websocket: 'bg-emerald-500',
  polling: 'bg-amber-500',
  disconnected: 'bg-red-500',
};

const connectionStatusIcons = {
  websocket: Wifi,
  polling: RefreshCw,
  disconnected: WifiOff,
};

export function StatusBar({
  connectionStatus,
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  deviceCount = 0,
  connectedDevices = 0,
}: StatusBarProps) {
  const { theme, toggleTheme } = useTheme();
  
  const StatusIcon = connectionStatusIcons[connectionStatus.type];
  const statusColor = connectionStatusColors[connectionStatus.type];

  const getWeatherIcon = () => {
    switch (weatherData.condition) {
      case 'partly-cloudy':
        return <Cloud className="w-4 h-4" />;
      case 'rainy':
        return <CloudRain className="w-4 h-4" />;
      default:
        return <SunIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          <StatusIcon className={`w-4 h-4 ${connectionStatus.type === 'disconnected' ? 'text-red-500' : 'text-emerald-500'}`} />
          <span className="text-sm font-medium">
            {connectionStatus.type === 'websocket' 
              ? 'Live' 
              : connectionStatus.type === 'polling' 
                ? 'Polling' 
                : 'Offline'}
          </span>
        </div>
        
        <div className="hidden sm:block w-px h-4 bg-border" />
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Devices:</span>
          <Badge variant="secondary" className="text-xs">
            {connectedDevices}/{deviceCount} online
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          {getWeatherIcon()}
          <span>{weatherData.temp}°C</span>
          <span className="text-muted-foreground">({weatherData.humidity}% RH)</span>
        </div>
        
        {lastUpdated && (
          <>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="w-9 h-9"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default StatusBar;
