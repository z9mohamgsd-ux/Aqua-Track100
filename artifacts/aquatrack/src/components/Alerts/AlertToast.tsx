import { useEffect, useRef } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  X, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  Droplets,
  Thermometer,
  Activity,
  Zap,
  CheckCircle
} from 'lucide-react';
import type { Alert as AlertType } from '@/types';
import { cn } from '@/lib/utils';

interface AlertToastProps {
  alert: AlertType;
  onDismiss: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  autoDismiss?: boolean;
  dismissAfter?: number;
}

const parameterIcons = {
  ph: Droplets,
  temperature: Thermometer,
  turbidity: Activity,
  conductivity: Zap,
};

const severityConfig = {
  info: {
    icon: Info,
    variant: 'default' as const,
    className: 'border-blue-500/50 bg-blue-500/10',
    titleColor: 'text-blue-700 dark:text-blue-300',
  },
  warning: {
    icon: AlertTriangle,
    variant: 'default' as const,
    className: 'border-amber-500/50 bg-amber-500/10',
    titleColor: 'text-amber-700 dark:text-amber-300',
  },
  critical: {
    icon: AlertCircle,
    variant: 'destructive' as const,
    className: 'border-red-500/50 bg-red-500/10',
    titleColor: 'text-red-700 dark:text-red-300',
  },
};

const playAlertSound = (severity: string) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (severity === 'critical') {
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } else if (severity === 'warning') {
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (error) {
    console.warn('Could not play alert sound:', error);
  }
};

export function AlertToast({
  alert,
  onDismiss,
  onResolve,
  autoDismiss = false,
  dismissAfter = 10000,
}: AlertToastProps) {
  const config = severityConfig[alert.severity];
  const Icon = config.icon;
  const ParameterIcon = parameterIcons[alert.parameter];
  const hasPlayedSound = useRef(false);

  useEffect(() => {
    if (alert.severity === 'critical' && !hasPlayedSound.current) {
      playAlertSound(alert.severity);
      hasPlayedSound.current = true;
    }
  }, [alert.severity]);

  useEffect(() => {
    if (autoDismiss && dismissAfter > 0) {
      const timer = setTimeout(() => {
        onDismiss(alert.id);
      }, dismissAfter);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, dismissAfter, alert.id, onDismiss]);

  return (
    <Alert
      className={cn(
        'relative pr-8 animate-in slide-in-from-right-full duration-300',
        config.className
      )}
      variant={config.variant}
    >
      <Icon className={cn('h-4 w-4', config.titleColor)} />
      
      <div className="flex-1 min-w-0">
        <AlertTitle className={cn('flex items-center gap-2', config.titleColor)}>
          <ParameterIcon className="w-4 h-4" />
          {alert.parameter.charAt(0).toUpperCase() + alert.parameter.slice(1)} Alert
          <span className="text-xs uppercase tracking-wider opacity-70">
            ({alert.severity})
          </span>
        </AlertTitle>
        
        <AlertDescription className="mt-1">
          <p className="text-sm">{alert.message}</p>
          <div className="flex items-center gap-4 mt-2 text-xs opacity-70">
            <span>Device: {alert.deviceId}</span>
            <span>Value: {alert.value.toFixed(2)}</span>
            <span>Threshold: {alert.threshold}</span>
          </div>
        </AlertDescription>
        
        {onResolve && (
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(alert.id)}
              className="text-xs gap-1"
            >
              <CheckCircle className="w-3 h-3" />
              Mark Resolved
            </Button>
          </div>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => onDismiss(alert.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}

interface AlertContainerProps {
  alerts: AlertType[];
  onDismiss: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  maxVisible?: number;
}

export function AlertContainer({
  alerts,
  onDismiss,
  onResolve,
  maxVisible = 5,
}: AlertContainerProps) {
  const visibleAlerts = alerts.slice(0, maxVisible);
  const remainingCount = alerts.length - maxVisible;

  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-md space-y-2">
      {visibleAlerts.map((alert) => (
        <AlertToast
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
          onResolve={onResolve}
        />
      ))}
      
      {remainingCount > 0 && (
        <div className="text-center">
          <span className="text-sm text-muted-foreground bg-background/80 px-3 py-1 rounded-full">
            +{remainingCount} more alerts
          </span>
        </div>
      )}
    </div>
  );
}

export default AlertToast;
