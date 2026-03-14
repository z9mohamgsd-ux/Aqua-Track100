import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Bell, 
  Moon, 
  Database,
  Shield,
  Save,
  RotateCcw,
  Check
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState({
    notifications: true,
    soundAlerts: true,
    autoRefresh: true,
    refreshInterval: 5,
    dataRetention: 30,
    emailAlerts: false,
    emailAddress: '',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('aquatrack-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({
      notifications: true,
      soundAlerts: true,
      autoRefresh: true,
      refreshInterval: 5,
      dataRetention: 30,
      emailAlerts: false,
      emailAddress: '',
    });
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your monitoring preferences
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button onClick={handleSave} className="gap-2">
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize the look and feel of the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose between light and dark mode
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                Dark
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure how you receive alerts and updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show alert notifications in the dashboard
              </p>
            </div>
            <Switch
              checked={settings.notifications}
              onCheckedChange={(v) => updateSetting('notifications', v)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Sound Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Play sound for critical alerts
              </p>
            </div>
            <Switch
              checked={settings.soundAlerts}
              onCheckedChange={(v) => updateSetting('soundAlerts', v)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Email Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Send alerts to your email address
              </p>
            </div>
            <Switch
              checked={settings.emailAlerts}
              onCheckedChange={(v) => updateSetting('emailAlerts', v)}
            />
          </div>

          {settings.emailAlerts && (
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={settings.emailAddress}
                onChange={(e) => updateSetting('emailAddress', e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Configure data refresh and retention settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Refresh</Label>
              <p className="text-sm text-muted-foreground">
                Automatically refresh data from the server
              </p>
            </div>
            <Switch
              checked={settings.autoRefresh}
              onCheckedChange={(v) => updateSetting('autoRefresh', v)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Refresh Interval (seconds)</Label>
            <p className="text-sm text-muted-foreground">
              How often to fetch new data
            </p>
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.refreshInterval}
              onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value) || 5)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Data Retention (days)</Label>
            <p className="text-sm text-muted-foreground">
              How long to keep historical data
            </p>
            <Input
              type="number"
              min={1}
              max={365}
              value={settings.dataRetention}
              onChange={(e) => updateSetting('dataRetention', parseInt(e.target.value) || 30)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Safety Thresholds
          </CardTitle>
          <CardDescription>
            Current alert thresholds for sensor readings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                pH Range
              </div>
              <p className="font-semibold">6.0 - 8.5</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Temperature
              </div>
              <p className="font-semibold">15°C - 35°C</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Turbidity
              </div>
              <p className="font-semibold">0 - 5 NTU</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Conductivity
              </div>
              <p className="font-semibold">100 - 300 µS/cm</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About AquaTrack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Version:</span> 1.0.0
            </p>
            <p>
              <span className="font-medium text-foreground">Backend:</span>{' '}
              <code className="bg-muted px-1 py-0.5 rounded">http://localhost:5000</code>
            </p>
            <p>
              <span className="font-medium text-foreground">API Endpoint:</span>{' '}
              <code className="bg-muted px-1 py-0.5 rounded">POST /api/sensor-data</code>
            </p>
            <p className="pt-2">
              AquaTrack is a water quality monitoring system that receives data from 
              Arduino/IoT sensors and displays real-time readings with alerts and 
              historical analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
