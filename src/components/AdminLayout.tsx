import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { LayoutDashboard, Package, Tag, ShoppingCart, Users, Truck, TrendingUp, BarChart3, Settings, Menu, X, ArrowLeft, Bell, Shield, Wallet, Wrench, RefreshCw, MessageCircle, Megaphone, CreditCard, Check, XCircle, UserCog, Send, Image, ChevronDown, Briefcase, Megaphone as MegaphoneIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import type { Notification } from '@/lib/types';
import { requestNotificationPermission, shouldAskForPermission, markPermissionAsked, showBrowserNotification, getNotificationPermission, setupPushNotifications, isPushSupported } from '@/lib/notifications';
import { hapticLight } from '@/lib/mobile';

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  section?: string;
}

interface NavGroup {
  title: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Genel',
    icon: LayoutDashboard,
    items: [
      { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
      { label: 'Siparişler', path: '/admin/orders', icon: ShoppingCart, section: 'orders' },
      { label: 'Müşteriler', path: '/admin/customers', icon: Users },
      { label: 'Teslimatlar', path: '/admin/deliveries', icon: Truck },
    ],
  },
  {
    title: 'Ürün & Stok',
    icon: Package,
    items: [
      { label: 'Ürünler', path: '/admin/products', icon: Package, section: 'products' },
      { label: 'Kategoriler', path: '/admin/categories', icon: Tag },
      { label: 'Tedarikçiler', path: '/admin/suppliers', icon: Truck, section: 'suppliers' },
      { label: 'Taksit Ayarları', path: '/admin/installments', icon: CreditCard },
    ],
  },
  {
    title: 'Hizmetler',
    icon: Briefcase,
    items: [
      { label: 'Teknik Servis', path: '/admin/services', icon: Wrench, section: 'service' },
      { label: 'Telefon Sat', path: '/admin/sell-phone', icon: TrendingUp, section: 'sell_phone' },
      { label: 'Takas', path: '/admin/trade-ins', icon: RefreshCw, section: 'trade_ins' },
    ],
  },
  {
    title: 'İletişim & Pazarlama',
    icon: MegaphoneIcon,
    items: [
      { label: 'Canlı Destek', path: '/admin/support', icon: MessageCircle, section: 'support' },
      { label: 'Kampanyalar', path: '/admin/campaigns', icon: Megaphone },
      { label: 'Promosyon Bannerları', path: '/admin/banners', icon: Image },
      { label: 'Toplu Bildirim', path: '/admin/broadcast', icon: Send },
    ],
  },
  {
    title: 'Satış & Finans',
    icon: Wallet,
    items: [
      { label: 'Satışlar', path: '/admin/sales', icon: TrendingUp },
      { label: 'Finans', path: '/admin/finance', icon: Wallet },
      { label: 'Raporlar', path: '/admin/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Sistem',
    icon: Settings,
    items: [
      { label: 'Personel Yönetimi', path: '/admin/staff', icon: UserCog },
      { label: 'KVKK & İzinler', path: '/admin/kvkk', icon: Shield },
      { label: 'Ayarlar', path: '/admin/settings', icon: Settings },
    ],
  },
];

const flatNavItems: NavItem[] = navGroups.flatMap(g => g.items);

const NotifPanel = ({ notifications, unreadCount, markAllRead, formatNotifTime, onNavigate }: {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  formatNotifTime: (d: string) => string;
  onNavigate: (id: string | null) => void;
}) => (
  <>
    <div className="fixed inset-0 z-30" onClick={() => { onNavigate(null); }} />
    <div className="absolute right-0 top-full mt-2 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-bold text-slate-800">Bildirimler</span>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-medium text-electric-600 hover:text-electric-700">Tümünü okundu işaretle</button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">Henüz bildirim yok</p>
          </div>
        ) : (
          notifications.map(n => (
            <button
              key={n.id}
              onClick={() => onNavigate(n.order_id)}
              className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${!n.is_read ? 'bg-electric-50' : ''}`}
            >
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.is_read ? 'bg-electric-500' : 'bg-transparent'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                {n.message && <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>}
                <p className="mt-1 text-[10px] text-slate-400">{formatNotifTime(n.created_at)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  </>
);

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, isSuperAdmin, assignedSections, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [noAdmins, setNoAdmins] = useState(false);
  const [checkingAdmins, setCheckingAdmins] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sectionBadges, setSectionBadges] = useState<Record<string, number>>({});
  const [showPermBanner, setShowPermBanner] = useState(false);
  const [expandedAdminGroups, setExpandedAdminGroups] = useState<Set<string>>(new Set(['Genel', 'Ürün & Stok']));
  const loadedOnceRef = useRef(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  const handleNotifToggle = () => {
    setNotifOpen(prev => {
      if (!prev) {
        setTimeout(() => markAllRead(), 300);
      }
      return !prev;
    });
  };

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    }
  }, [user]);

  const loadSectionBadges = useCallback(async () => {
    if (!user || !isAdmin) return;
    const { data } = await supabase.rpc('get_unread_counts_by_section');
    if (data) {
      const badges: Record<string, number> = {};
      for (const row of data as { section: string; unread_count: number }[]) {
        badges[row.section] = row.unread_count;
      }
      setSectionBadges(badges);
    }
  }, [user, isAdmin]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useEffect(() => { loadSectionBadges(); }, [loadSectionBadges]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (shouldAskForPermission()) setShowPermBanner(true);
  }, [user, isAdmin]);

  // Auto-register push for admins who already granted permission
  useEffect(() => {
    if (!user || !isAdmin) return;
    if (!isPushSupported()) return;
    if (getNotificationPermission() !== 'granted') return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setupPushNotifications(user.id, supabaseUrl, supabaseAnonKey);
  }, [user, isAdmin]);

  const handleAllowPush = async () => {
    const granted = await requestNotificationPermission();
    markPermissionAsked();
    setShowPermBanner(false);
    if (granted && user) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      await setupPushNotifications(user.id, supabaseUrl, supabaseAnonKey);
    }
  };
  const handleDismissPush = () => { markPermissionAsked(); setShowPermBanner(false); };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        loadNotifications();
        loadSectionBadges();
        const n = payload.new as Notification;
        if (loadedOnceRef.current && getNotificationPermission() === 'granted') {
          showBrowserNotification(n.title, n.message || '');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        loadNotifications();
        loadSectionBadges();
      })
      .subscribe();
    const timer = setTimeout(() => { loadedOnceRef.current = true; }, 2000);
    return () => { supabase.removeChannel(channel); clearTimeout(timer); };
  }, [user, loadNotifications]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setSectionBadges({});
  };

  const canSeeSection = (section?: string) => {
    if (!section) return true;
    if (isSuperAdmin) return true;
    return assignedSections.includes(section as 'orders' | 'support' | 'service' | 'trade_ins' | 'sell_phone' | 'operator_lead' | 'products' | 'suppliers');
  };

  const toggleAdminGroup = (title: string) => {
    setExpandedAdminGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const formatNotifTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} sa önce`;
    return new Date(date).toLocaleDateString('tr-TR');
  };

  useEffect(() => {
    if (user && !isAdmin) {
      supabase.rpc('admins_count').then(({ data }) => {
        setNoAdmins((data as number) === 0);
        setCheckingAdmins(false);
      });
    } else {
      setCheckingAdmins(false);
    }
  }, [user, isAdmin]);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    await supabase.rpc('bootstrap_first_admin');
    window.location.reload();
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <Bell className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-800">Yetkisiz Erişim</h1>
          <p className="mt-1 text-sm text-slate-500">Admin paneline erişmek için giriş yapmalısınız.</p>
          <button onClick={() => navigate('/login')} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-electric-600 hover:text-electric-700">
            <ArrowLeft className="h-4 w-4" /> Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin && checkingAdmins) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-electric-500" />
      </div>
    );
  }

  if (!isAdmin && !noAdmins) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <Bell className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-800">Yetkisiz Erişim</h1>
          <p className="mt-1 text-sm text-slate-500">Admin yetkisine sahip bir hesapla giriş yapmalısınız.</p>
          <button onClick={() => navigate('/')} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-electric-600 hover:text-electric-700">
            <ArrowLeft className="h-4 w-4" /> Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin && noAdmins) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <Shield className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-800">İlk Admini Oluştur</h1>
          <p className="mt-1 text-sm text-slate-500">Sistemde henüz admin yok. Kendinizi ilk admin olarak atayın.</p>
          <Button className="mt-5 w-full" loading={bootstrapping} onClick={handleBootstrap}>
            <Shield className="h-4 w-4" /> Kendimi Admin Yap
          </Button>
          <button onClick={() => navigate('/')} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <Logo size={36} rounded="rounded-xl" className="ring-1 ring-electric-500/20" />
          <span className="text-lg font-bold tracking-tight text-slate-800">MS <span className="text-electric-500">İletişim</span></span>
          <span className="ml-1 rounded bg-electric-50 px-1.5 py-0.5 text-[10px] font-medium text-electric-600">Admin</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => canSeeSection(item.section));
            if (visibleItems.length === 0) return null;
            const isExpanded = expandedAdminGroups.has(group.title);
            if (group.items.length === 1) {
              const item = group.items[0];
              return (
                <button
                  key={item.path}
                  onClick={() => { hapticLight(); navigate(item.path); }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-electric-600"
                >
                  <item.icon className="h-5 w-5 text-slate-400 group-hover:text-electric-500" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.section && sectionBadges[item.section] > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white shadow-sm">
                      {sectionBadges[item.section] > 9 ? '9+' : sectionBadges[item.section]}
                    </span>
                  )}
                </button>
              );
            }
            return (
              <div key={group.title}>
                <button
                  onClick={() => toggleAdminGroup(group.title)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                >
                  <group.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{group.title}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="ml-2 border-l border-slate-100 pl-1">
                    {visibleItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => { hapticLight(); navigate(item.path); }}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-electric-600"
                      >
                        <item.icon className="h-5 w-5 text-slate-400 group-hover:text-electric-500" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.section && sectionBadges[item.section] > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white shadow-sm">
                            {sectionBadges[item.section] > 9 ? '9+' : sectionBadges[item.section]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button onClick={() => navigate('/')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-400" /> Mağazaya Dön
          </button>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50">
            <X className="h-5 w-5" /> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl border-r border-slate-200">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <div className="flex items-center gap-2">
                <Logo size={36} rounded="rounded-xl" />
                <span className="text-lg font-bold text-slate-800">MS <span className="text-electric-500">İletişim</span></span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {navGroups.map((group) => {
                const visibleItems = group.items.filter(item => canSeeSection(item.section));
                if (visibleItems.length === 0) return null;
                const isExpanded = expandedAdminGroups.has(group.title);
                if (group.items.length === 1) {
                  const item = group.items[0];
                  return (
                    <button
                      key={item.path}
                      onClick={() => { hapticLight(); navigate(item.path); setSidebarOpen(false); }}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <item.icon className="h-5 w-5 text-slate-400 group-hover:text-electric-500" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.section && sectionBadges[item.section] > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white shadow-sm">
                          {sectionBadges[item.section] > 9 ? '9+' : sectionBadges[item.section]}
                        </span>
                      )}
                    </button>
                  );
                }
                return (
                  <div key={group.title}>
                    <button
                      onClick={() => toggleAdminGroup(group.title)}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                    >
                      <group.icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{group.title}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="ml-2 border-l border-slate-100 pl-1">
                        {visibleItems.map((item) => (
                          <button
                            key={item.path}
                            onClick={() => { hapticLight(); navigate(item.path); setSidebarOpen(false); }}
                            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                          >
                            <item.icon className="h-5 w-5 text-slate-400 group-hover:text-electric-500" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.section && sectionBadges[item.section] > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white shadow-sm">
                                {sectionBadges[item.section] > 9 ? '9+' : sectionBadges[item.section]}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="mt-2 border-t border-slate-200 pt-2">
                <button onClick={() => navigate('/')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  <ArrowLeft className="h-5 w-5 text-slate-400" /> Mağazaya Dön
                </button>
                <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50">
                  <X className="h-5 w-5" /> Çıkış Yap
                </button>
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="relative flex-1 flex flex-col min-w-0">
        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-end gap-3 border-b border-slate-200 bg-white px-6">
          <div className="relative">
            <button ref={notifBtnRef} onClick={handleNotifToggle} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-electric-600 transition-colors">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotifPanel
                notifications={notifications}
                unreadCount={unreadCount}
                markAllRead={markAllRead}
                formatNotifTime={formatNotifTime}
                onNavigate={(orderId) => { if (orderId) navigate(`/order/${orderId}`); setNotifOpen(false); }}
              />
            )}
          </div>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-slate-800">Admin Panel</span>
          <div className="relative">
            <button ref={notifBtnRef} onClick={handleNotifToggle} className="relative rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotifPanel
                notifications={notifications}
                unreadCount={unreadCount}
                markAllRead={markAllRead}
                formatNotifTime={formatNotifTime}
                onNavigate={(orderId) => { if (orderId) navigate(`/order/${orderId}`); setNotifOpen(false); }}
              />
            )}
          </div>
        </header>

        {/* Push permission banner */}
        {showPermBanner && (
          <div className="fixed top-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-electric-200 bg-white p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-electric-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">Bildirimleri aç</p>
                <p className="mt-0.5 text-xs text-slate-500">Yeni sipariş, destek talebi ve müşteri işlemlerini tarayıcı bildirimi olarak almak için izin verin.</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={handleAllowPush} className="flex items-center gap-1.5 rounded-lg bg-electric-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-electric-600">
                    <Check className="h-3.5 w-3.5" /> İzin Ver
                  </button>
                  <button onClick={handleDismissPush} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">
                    <XCircle className="h-3.5 w-3.5" /> Şimdi Değil
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
