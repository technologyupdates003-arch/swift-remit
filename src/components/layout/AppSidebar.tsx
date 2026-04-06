import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Wallet, Send, Clock, Globe, Bitcoin, Shield, Bell, Settings, LogOut, X, Banknote
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Wallet, label: 'My Wallets', path: '/wallets' },
  { icon: Send, label: 'Send Money', path: '/send' },
  { icon: Clock, label: 'Transactions', path: '/transactions' },
  { icon: Globe, label: 'Exchange', path: '/exchange' },
  { icon: Bitcoin, label: 'AbanRemit Crypto', path: '/crypto' },
  { icon: Shield, label: 'KYC Verification', path: '/kyc' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

const AppSidebar = ({ open, onClose }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/30" onClick={onClose} />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto`}
      >
        <div className="flex items-center gap-3 p-6 pb-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Banknote className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-sidebar-accent-foreground">AbanRemit</span>
          <button onClick={onClose} className="ml-auto lg:hidden text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 mt-4 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 mt-auto">
          <button
            onClick={() => { logout(); onClose(); }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent w-full"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
