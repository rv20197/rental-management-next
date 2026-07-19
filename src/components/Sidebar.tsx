'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X, LayoutDashboard, Key, Users, Package, ReceiptText, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLogoutMutation } from '@/api/authApi';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rentals', label: 'Rentals', icon: Key },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/items', label: 'Items', icon: Package },
  { to: '/billings', label: 'Billings', icon: ReceiptText },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logout] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Cookie is cleared best-effort; route to /login regardless.
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden',
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onMobileClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col border-r bg-card text-card-foreground transition-transform md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b p-4 md:border-b-0 md:p-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary md:text-2xl">RentTrack</h1>
            <p className="text-xs text-muted-foreground md:hidden">Manage rentals on the go</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.to;
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors md:py-2',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
