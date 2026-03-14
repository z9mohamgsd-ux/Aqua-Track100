import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Map,
  Cpu,
  History,
  Bell,
  Settings,
  Droplets,
  Menu,
  X,
  Ticket,
  ShieldCheck,
  Power,
} from 'lucide-react';

interface SidebarProps {
  alertCount?: number;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ alertCount = 0, isOpen, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();

  const mainNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/map', icon: Map, label: 'Map' },
    { to: '/devices', icon: Cpu, label: 'Devices' },
    { to: '/history', icon: History, label: 'History' },
  ];

  const systemNavItems = [
    { to: '/alerts', icon: Bell, label: 'Alerts' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const roleNavItems = [
    { to: '/tickets', icon: Ticket, label: 'Tickets', roles: ['owner', 'admin', 'user'] },
    { to: '/control-panel', icon: ShieldCheck, label: 'Control Panel', roles: ['owner'] },
  ].filter((item) => user && item.roles.includes(user.role));

  const ROLE_LABEL: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    user: 'User',
  };

  const ROLE_COLOR: Record<string, string> = {
    owner: 'text-purple-400',
    admin: 'text-orange-400',
    user: 'text-sidebar-foreground/60',
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
      isActive
        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
    );

  const handleNavClick = () => {
    if (window.innerWidth < 1024) onToggle();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[1900] lg:hidden" onClick={onToggle} />
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="fixed top-4 left-4 z-[2001] lg:hidden"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      <aside
        className={cn(
          'fixed top-0 left-0 z-[2000] h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Scrollable nav area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain sidebar-scroll">
          {/* Logo */}
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">AquaTrack</h1>
                <p className="text-xs text-sidebar-foreground/60">Water Monitoring</p>
              </div>
            </div>
          </div>

          <Separator className="bg-sidebar-border" />

          {/* Main nav */}
          <nav className="p-4 space-y-1">
            <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Main</p>
            {mainNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={handleNavClick} className={navLinkClass}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <Separator className="bg-sidebar-border mx-4 w-auto" />

          {/* System nav */}
          <nav className="p-4 space-y-1">
            <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">System</p>
            {systemNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={handleNavClick} className={navLinkClass}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.to === '/alerts' && alertCount > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs min-w-[20px] h-5 flex items-center justify-center">
                    {alertCount}
                  </Badge>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Role-based nav */}
          {roleNavItems.length > 0 && (
            <>
              <Separator className="bg-sidebar-border mx-4 w-auto" />
              <nav className="p-4 space-y-1">
                <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  {user?.role === 'owner' ? 'Owner' : user?.role === 'admin' ? 'Admin' : 'Account'}
                </p>
                {roleNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={handleNavClick} className={navLinkClass}>
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </>
          )}
        </div>

        {/* Logout — pinned above footer, always visible */}
        <div className="border-t border-sidebar-border">
          <nav className="p-4 space-y-1">
            <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Logout
            </p>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group bg-red-500/8 border border-red-500/20 text-red-400 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-300"
            >
              <span className="flex items-center justify-center w-5 h-5">
                <Power className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              </span>
              <span>Sign out</span>
            </button>
          </nav>
        </div>

        {/* Footer / user info */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white uppercase">
                {user?.email?.charAt(0) ?? '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.email}</p>
              <p className={cn('text-xs font-medium', user?.role ? ROLE_COLOR[user.role] : '')}>
                {user?.role ? ROLE_LABEL[user.role] : ''}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
