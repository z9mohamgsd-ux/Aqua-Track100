import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { MapPage } from '@/pages/MapPage';
import { DevicesPage } from '@/pages/DevicesPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import TicketsPage from '@/pages/TicketsPage';
import TicketDetailPage from '@/pages/TicketDetailPage';
import ControlPanelPage from '@/pages/ControlPanelPage';
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';

function ProtectedApp() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<ErrorBoundary fallbackLabel="Dashboard error"><Dashboard /></ErrorBoundary>} />
            <Route path="/map" element={<ErrorBoundary fallbackLabel="Map error"><MapPage /></ErrorBoundary>} />
            <Route path="/devices" element={<ErrorBoundary fallbackLabel="Devices error"><DevicesPage /></ErrorBoundary>} />
            <Route path="/history" element={<ErrorBoundary fallbackLabel="History error"><HistoryPage /></ErrorBoundary>} />
            <Route path="/alerts" element={<ErrorBoundary fallbackLabel="Alerts error"><AlertsPage /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary fallbackLabel="Settings error"><SettingsPage /></ErrorBoundary>} />
            <Route path="/tickets" element={<ErrorBoundary fallbackLabel="Tickets error"><TicketsPage /></ErrorBoundary>} />
            <Route path="/tickets/:id" element={<ErrorBoundary fallbackLabel="Ticket error"><TicketDetailPage /></ErrorBoundary>} />
            {(user.role === 'owner') && (
              <Route path="/control-panel" element={<ErrorBoundary fallbackLabel="Control Panel error"><ControlPanelPage /></ErrorBoundary>} />
            )}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ProtectedApp />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
