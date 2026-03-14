import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Droplets,
  Thermometer,
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type { SensorStatus } from '@/types';

interface SensorCardProps {
  title: string;
  value: number;
  unit: string;
  icon: 'ph' | 'temperature' | 'turbidity' | 'conductivity';
  status: SensorStatus;
  min: number;
  max: number;
  history?: number[];
  batteryLevel?: number;
}

const iconMap = {
  ph: Droplets,
  temperature: Thermometer,
  turbidity: Activity,
  conductivity: Zap,
};

const statusColors = {
  safe: {
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/25',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500 hover:bg-emerald-500',
    progress: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/15',
    trendText: 'text-emerald-500',
  },
  warning: {
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/25',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500 hover:bg-amber-500',
    progress: 'bg-amber-500',
    iconBg: 'bg-amber-500/15',
    trendText: 'text-amber-500',
  },
  danger: {
    bg: 'bg-red-500/8',
    border: 'border-red-500/25',
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500 hover:bg-red-500',
    progress: 'bg-red-500',
    iconBg: 'bg-red-500/15',
    trendText: 'text-red-500',
  },
};

function BatteryIcon({ level }: { level: number }) {
  const color =
    level > 50 ? '#10b981' : level > 20 ? '#f59e0b' : '#ef4444';
  const fillWidth = Math.round((level / 100) * 18);

  return (
    <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
      <rect x="0.5" y="0.5" width="18" height="11" rx="2" stroke={color} strokeWidth="1.2" />
      <rect x="1.5" y="1.5" width={fillWidth} height="9" rx="1.2" fill={color} />
      <path d="M19.5 4v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 56;
  const height = 28;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
    </svg>
  );
}

export function SensorCard({
  title,
  value,
  unit,
  icon,
  status,
  min,
  max,
  history = [],
  batteryLevel = 85,
}: SensorCardProps) {
  const Icon = iconMap[icon];
  const colors = statusColors[status.status];
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const trend =
    history.length >= 2
      ? history[history.length - 1] > history[history.length - 2]
        ? 'up'
        : history[history.length - 1] < history[history.length - 2]
        ? 'down'
        : 'stable'
      : 'stable';

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const trendLabel =
    trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable';

  const displayValue =
    typeof value === 'number'
      ? value.toFixed(icon === 'ph' ? 2 : 1)
      : '--';

  const statusLabel =
    status.status === 'safe'
      ? 'SAFE'
      : status.status === 'warning'
      ? 'WARNING'
      : 'ALERT';

  return (
    <Card
      className={`${colors.border} border-2 transition-all duration-300 hover:shadow-md overflow-hidden`}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Row 1: Name + Battery */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${colors.iconBg}`}>
              <Icon className={`w-4 h-4 ${colors.text}`} />
            </div>
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BatteryIcon level={batteryLevel} />
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {batteryLevel}%
            </span>
          </div>
        </div>

        {/* Row 2: Value + Trend + Sparkline */}
        <div className="flex items-end justify-between">
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-bold leading-none ${colors.text}`}>
              {displayValue}
            </span>
            {unit && (
              <span className="text-base text-muted-foreground mb-0.5">{unit}</span>
            )}
            <div
              className={`flex items-center gap-0.5 mb-1 ${colors.trendText}`}
            >
              <TrendIcon className="w-4 h-4" />
              <span className="text-xs font-medium">{trendLabel}</span>
            </div>
          </div>
          <MiniSparkline data={history} color={colors.text} />
        </div>

        {/* Row 3: Status Badge */}
        <div>
          <Badge
            className={`${colors.badge} text-white text-xs px-2 py-0.5 font-semibold tracking-wide`}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* Row 4: Range Bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{min}</span>
            <span>{max}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${colors.progress} rounded-full transition-all duration-500`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SensorCard;
