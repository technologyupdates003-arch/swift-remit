import { Menu, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  onMenuClick: () => void;
}

const AppHeader = ({ onMenuClick }: AppHeaderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initial = user?.full_name?.charAt(0)?.toUpperCase() || user?.phone?.slice(-2) || '?';

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-foreground">
          <Menu className="w-6 h-6" />
        </button>
        <div>
          <p className="text-xs text-primary font-medium">Welcome back</p>
          <p className="text-sm font-semibold text-foreground">
            {user?.full_name || user?.phone || 'User'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/notifications')} className="relative text-muted-foreground">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
          {initial}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
