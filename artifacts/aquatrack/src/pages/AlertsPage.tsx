import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  Droplets,
  Thermometer,
  Activity,
  Zap,
  RefreshCw,
  CheckCheck
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Alert as AlertType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const parameterIcons = {
  ph: Droplets,
  temperature: Thermometer,
  turbidity: Activity,
  conductivity: Zap,
};

const severityConfig = {
  info: {
    icon: Info,
    className: 'border-blue-500/50 bg-blue-500/10',
    titleColor: 'text-blue-700 dark:text-blue-300',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-500/50 bg-amber-500/10',
    titleColor: 'text-amber-700 dark:text-amber-300',
  },
  critical: {
    icon: AlertCircle,
    className: 'border-red-500/50 bg-red-500/10',
    titleColor: 'text-red-700 dark:text-red-300',
  },
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getActiveAlerts();
      if (response.success) {
        setAlerts(response.data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useWebSocket({
    onAlert: (alert) => {
      setAlerts((prev) => {
        if (prev.find((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    },
    onAlertResolved: (data) => {
      setAlerts((prev) => prev.filter((a) => a.id !== data.alertId));
    },
  });

  const handleResolve = async (alertId: string) => {
    try {
      await apiService.clearAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const handleResolveAll = async () => {
    try {
      await Promise.all(alerts.map((a) => apiService.clearAlert(a.id)));
      setAlerts([]);
    } catch (error) {
      console.error('Error resolving all alerts:', error);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const stats = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Bell className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-amber-600">{stats.warning}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-600">{stats.info}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Info className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Active Alerts
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor and manage system alerts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(f)}
                    className="text-xs capitalize"
                  >
                    {f}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAlerts}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {alerts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResolveAll}
                  className="gap-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  Resolve All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No active alerts</p>
              <p className="text-sm mt-1">
                All systems are operating within normal parameters
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;
                const ParameterIcon = parameterIcons[alert.parameter];

                return (
                  <Alert
                    key={alert.id}
                    className={`${config.className} relative`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${config.titleColor}`} />
                      <div className="flex-1 min-w-0">
                        <AlertTitle className={`flex items-center gap-2 flex-wrap ${config.titleColor}`}>
                          <ParameterIcon className="w-4 h-4" />
                          {alert.parameter.charAt(0).toUpperCase() + alert.parameter.slice(1)} Alert
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${config.titleColor}`}
                          >
                            {alert.severity}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="mt-1">
                          <p>{alert.message}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs opacity-70">
                            <span>Device: {alert.deviceId}</span>
                            <span>Value: {alert.value.toFixed(2)}</span>
                            <span>Threshold: {alert.threshold}</span>
                            <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                          </div>
                        </AlertDescription>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolve(alert.id)}
                            className="gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Alert>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AlertsPage;
