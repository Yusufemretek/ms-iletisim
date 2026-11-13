import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Smartphone, ShoppingCart, User, Menu, X, Package, Home, LogOut, Wrench, Heart, MessageCircle, ChevronDown, Shield, Bell, Check, XCircle, TrendingUp, RefreshCw, Briefcase, Search, Recycle, Headphones, Tablet, Watch, Flame } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { navigate, useRouter } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import type { Notification } from '@/lib/types';
import { requestNotificationPermission, shouldAskForPermission, markPermissionAsked, showBrowserNotification, getNotificationPermission, setupPushNotifications, isPushSupported } from '@/lib/notifications';
import { statusLabel } from '@/lib/format';
import { hapticLight, isNative } from '@/lib/mobile';

interface NavItem {
  label: string;
  path: string;
  icon: typeof Home;
}

interface NavGroup {
  title: string;
  icon: typeof Home;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Ana Sayfa',
    icon: Home,
    items: [
      { label: 'Ana Sayfa', path: '/', icon: Home },
    ],
  },
  {
    title: 'Alışveriş',
    icon: Package,
    items: [
      { label: 'Ürünler', path: '/urunler', icon: Package },
      { label: 'Telefonlar', path: '/telefonlar', icon: Smartphone },
      { label: '2. El', path: '/ikinci-el-telefonlar', icon: Smartphone },
      { label: 'Aksesuarlar', path: '/aksesuarlar', icon: Package },
    ],
  },
  {
    title: 'Hizmetler',
    icon: Briefcase,
    items: [
      { label: 'Telefonunu Sat', path: '/sell-phone', icon: TrendingUp },
      { label: 'Takas', path: '/trade-in', icon: RefreshCw },
      { label: 'Teknik Servis', path: '/teknik-servis', icon: Wrench },
    ],
  },
  {
    title: 'Sipariş',
    icon: Package,
    items: [
      { label: 'Siparişlerim', path: '/orders', icon: Package },
    ],
  },
  {
    title: 'Destek',
    icon: MessageCircle,
    items: [
      { label: 'Canlı Destek', path: '/support', icon: MessageCircle },
    ],
  },
  {
    title: 'Hesabım',
    icon: User,
    items: [
      { label: 'Favoriler', path: '/favorites', icon: Heart },
      { label: 'Profil', path: '/profile', icon: User },
      { label: 'Gizlilik ve İzinler', path: '/account/privacy', icon: Shield },
    ],
  },
];

const bottomNavItems: NavItem[] = [
  { label: 'Ana Sayfa', path: '/', icon: Home },
  { label: 'Ürünler', path: '/urunler', icon: Package },
  { label: 'Sepet', path: '/cart', icon: ShoppingCart },
  { label: 'Sipariş', path: '/orders', icon: Smartphone },
  { label: 'Hesabım', path: '/profile', icon: User },
];

const desktopCategories = [
  { label: 'Sıfır Telefon', path: '/telefonlar', icon: Smartphone },
  { label: '2. El', path: '/ikinci-el-telefonlar', icon: Recycle },
  { label: 'Aksesuar', path: '/aksesuarlar', icon: Headphones },
  { label: 'Tablet', path: '/tabletler', icon: Tablet },
  { label: 'Akıllı Saat', path: '/akilli-saatler', icon: Watch },
  { label: 'Teknik Servis', path: '/teknik-servis', icon: Wrench },
  { label: 'Telefonunu Sat', path: '/sell-phone', icon: TrendingUp },
  { label: 'Takas', path: '/trade-in', icon: RefreshCw },
  { label: 'Fırsatlar', path: '/urunler?firsat=1', icon: Flame },
];

export function CustomerLayout({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const { route } = useRouter();
  const currentPath = route.path;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Alışveriş', 'Hizmetler']));
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPermBanner, setShowPermBanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const loadedOnceRef = useRef(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/urunler?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
      setMobileSearchOpen(false);
    }
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

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;
    if (shouldAskForPermission()) {
      setShowPermBanner(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!isPushSupported()) return;
    if (getNotificationPermission() !== 'granted') return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setupPushNotifications(user.id, supabaseUrl, supabaseAnonKey);
  }, [user]);

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

  const handleDismissPush = () => {
    markPermissionAsked();
    setShowPermBanner(false);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          loadNotifications();
          const n = payload.new as Notification;
          if (loadedOnceRef.current && getNotificationPermission() === 'granted') {
            showBrowserNotification(n.title, n.message || '', () => {
              if (n.order_id) navigate(`/order/${n.order_id}`);
              else if (n.service_id) navigate('/teknik-servis');
              else if (n.trade_in_id) navigate('/trade-in-requests');
              else if (n.sell_phone_id) navigate('/sell-phone-requests');
            });
          }
        }
      )
      .subscribe();
    const timer = setTimeout(() => { loadedOnceRef.current = true; }, 2000);
    return () => { supabase.removeChannel(channel); clearTimeout(timer); };
  }, [user, loadNotifications]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markNotificationRead = async (notification: Notification) => {
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id).eq('user_id', user?.id || '');
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const notificationMessage = (notification: Notification) => {
    const message = notification.message || '';
    const match = message.match(/(?:durumu:\s*|status:\s*)([A-Z_]+)/i);
    if (!match) return message;
    const translated = statusLabel(notification.type === 'service' ? 'service' : 'order', match[1]);
    return translated === match[1] ? 'Kaydınızın durumu güncellendi.' : `Kaydınızın yeni durumu: ${translated}.`;
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

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleNav = (path: string) => {
    hapticLight();
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Outside click + ESC for notification panel and search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (notifOpen && notifRef.current && notifButtonRef.current &&
          !notifRef.current.contains(target) && !notifButtonRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (searchOpen && searchRef.current && searchButtonRef.current &&
          !searchRef.current.contains(target) && !searchButtonRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };

    if (notifOpen || searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [notifOpen, searchOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (mobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  // Close notif panel when mobile menu opens
  useEffect(() => {
    if (mobileMenuOpen) {
      setNotifOpen(false);
      setSearchOpen(false);
    }
  }, [mobileMenuOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center px-3 sm:px-4 2xl:px-6">
          {/* Left group: hamburger + logo */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="xl:hidden -ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <Logo size={32} rounded="rounded-xl" className="ring-1 ring-electric-500/20 sm:hidden" />
              <Logo size={40} rounded="rounded-xl" className="ring-1 ring-electric-500/20 hidden sm:flex" />
              <div className="hidden sm:block">
                <span className="block text-lg font-bold leading-tight text-slate-800">
                  MS <span className="text-electric-500">İLETİŞİM</span>
                </span>
                <span className="block text-[10px] font-medium leading-tight text-slate-400">
                  TELEFON | AKSESUAR | SERVİS
                </span>
              </div>
            </button>
          </div>

          {/* Desktop compact search button + dropdown */}
          <div className="hidden md:flex items-center ml-auto shrink-0" ref={searchRef}>
            <button
              ref={searchButtonRef}
              onClick={() => { setSearchOpen(!searchOpen); setNotifOpen(false); }}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-electric-600"
              title="Ara"
            >
              <Search className="h-5 w-5" />
            </button>
            {searchOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Telefon, aksesuar, kulaklık ara..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-10 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-electric-400 focus:bg-white focus:ring-2 focus:ring-electric-100"
                    />
                    <button
                      type="button"
                      onClick={() => setSearchOpen(false)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right action group */}
          <div className="flex items-center gap-1 ml-auto md:ml-2 shrink-0">
            {/* Mobile search button */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="md:hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-electric-600"
              title="Ara"
            >
              <Search className="h-5 w-5" />
            </button>

            <button
              onClick={() => navigate('/favorites')}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-electric-600"
              title="Favoriler"
            >
              <Heart className="h-5 w-5" />
            </button>

            {/* Notification bell */}
            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  ref={notifButtonRef}
                  onClick={() => { setNotifOpen(!notifOpen); setSearchOpen(false); }}
                  className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-electric-600"
                  title="Bildirimler"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-sm font-bold text-slate-800">Bildirimler</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs font-medium text-electric-600 hover:text-electric-700">
                          Tümünü okundu işaretle
                        </button>
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
                            onClick={() => {
                              void markNotificationRead(n);
                              if (n.order_id) navigate(`/order/${n.order_id}`);
                              else if (n.service_id) navigate('/teknik-servis');
                              else if (n.trade_in_id) navigate('/trade-in-requests');
                              else if (n.sell_phone_id) navigate('/sell-phone-requests');
                              setNotifOpen(false);
                            }}
                            className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${!n.is_read ? 'bg-electric-50' : ''}`}
                          >
                            <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.is_read ? 'bg-electric-500' : 'bg-transparent'}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800">{n.title}</p>
                              {n.message && <p className="mt-0.5 break-words text-xs text-slate-500">{notificationMessage(n)}</p>}
                              <p className="mt-1 text-[10px] text-slate-400">{formatNotifTime(n.created_at)}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate('/cart')}
              className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-electric-600"
              title="Sepet"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-electric-500 px-1 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </button>

            {user ? (
              <div className="hidden sm:flex items-center gap-1.5 ml-1">
                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-electric-100 text-xs font-bold text-electric-600">
                    {(profile?.first_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                  </div>
                  <span className="max-w-20 truncate hidden lg:block">{profile?.first_name || 'Profil'}</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-electric-600"
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={signOut}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Çıkış Yap"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 ml-1">
                <button
                  onClick={() => navigate('/login')}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="btn-electric px-4 py-2 text-sm"
                >
                  Kayıt Ol
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop category nav bar */}
        <div className="hidden lg:block border-t border-slate-100 bg-white/80">
          <div className="mx-auto flex max-w-[1600px] items-center gap-0.5 px-4 2xl:px-6">
            {desktopCategories.map((cat) => {
              const isActive = currentPath === cat.path || (cat.path !== '/' && currentPath.startsWith(cat.path));
              return (
                <button
                  key={cat.path}
                  onClick={() => { hapticLight(); navigate(cat.path); }}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-electric-500 text-electric-600'
                      : 'border-transparent text-slate-600 hover:text-electric-600 hover:border-slate-300'
                  }`}
                >
                  <cat.icon className="h-4 w-4 shrink-0" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile menu (drawer) */}
        {mobileMenuOpen && (
          <>
            <div className="xl:hidden fixed inset-0 top-16 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div
              className="xl:hidden fixed left-0 right-0 top-16 z-50 overflow-y-auto border-t border-slate-200 bg-white shadow-xl"
              style={{ maxHeight: 'calc(100dvh - 64px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
            <nav className="flex flex-col p-2">
              {navGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.title);
                if (group.items.length === 1) {
                  return (
                    <button
                      key={group.title}
                      onClick={() => handleNav(group.items[0].path)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <group.icon className="h-5 w-5 text-electric-500 shrink-0" />
                      {group.items[0].label}
                    </button>
                  );
                }
                return (
                  <div key={group.title}>
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <group.icon className="h-5 w-5 text-electric-500 shrink-0" />
                      {group.title}
                      <ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="ml-5 border-l-2 border-slate-100 pl-2">
                        {group.items.map((item) => (
                          <button
                            key={item.path}
                            onClick={() => handleNav(item.path)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 pl-4 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-electric-600"
                          >
                            <item.icon className="h-4 w-4 text-slate-400 shrink-0" />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="mt-2 border-t border-slate-200 pt-2">
                {user ? (
                  <>
                    {isAdmin && (
                      <button
                        onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Smartphone className="h-5 w-5 text-slate-400 shrink-0" /> Admin Panel
                      </button>
                    )}
                    <button
                      onClick={() => { signOut(); setMobileMenuOpen(false); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50"
                    >
                      <LogOut className="h-5 w-5 shrink-0" /> Çıkış Yap
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2 p-2">
                    <button
                      onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
                    >
                      Giriş Yap
                    </button>
                    <button
                      onClick={() => { navigate('/register'); setMobileMenuOpen(false); }}
                      className="flex-1 btn-electric px-3 py-2 text-sm"
                    >
                      Kayıt Ol
                    </button>
                  </div>
                )}
              </div>
            </nav>
            </div>
          </>
        )}
      </header>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileSearchOpen(false)}>
          <div className="absolute top-0 left-0 right-0 bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
              <form onSubmit={(e) => { handleSearch(e); setMobileSearchOpen(false); }} className="flex-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Telefon, aksesuar, kulaklık ara..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-electric-400 focus:bg-white focus:ring-2 focus:ring-electric-100"
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Push permission banner */}
      {showPermBanner && (
        <div className="fixed top-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-electric-200 bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-electric-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Bildirimleri aç</p>
              <p className="mt-0.5 text-xs text-slate-500">Sipariş ve servis durum güncellemelerini tarayıcı bildirimi olarak almak için izin verin.</p>
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

      {/* Main content */}
      <main className="flex-1 pb-28 lg:pb-0 animate-fade-in">{children}</main>

      {/* Footer */}
      <footer className="hidden lg:block border-t border-slate-200 bg-white py-4">
        <div className="mx-auto max-w-7xl px-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} MS İletişim. Tüm hakları saklıdır.</span>
            <span className="text-slate-300">|</span>
            <span>Niğde / Merkez - Yukarı Kayabaşı Mah. Cici Baba Sok. No: 1/B</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <a href="tel:+905010311881" className="text-slate-500 hover:text-electric-600 transition-colors">0501 031 18 81</a>
            <a href="tel:+905010020151" className="text-slate-500 hover:text-electric-600 transition-colors">0501 002 01 51</a>
            <button onClick={() => navigate('/kvkk')} className="text-slate-500 hover:text-electric-600 transition-colors">KVKK</button>
            <button onClick={() => navigate('/account/privacy')} className="text-slate-500 hover:text-electric-600 transition-colors">Gizlilik ve İzinler</button>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button (mobile) */}
      {!mobileMenuOpen && (
        <a
          href={isNative() ? undefined : 'https://wa.me/905010311881'}
          target={isNative() ? undefined : '_blank'}
          rel={isNative() ? undefined : 'noopener noreferrer'}
          onClick={isNative() ? (e) => { e.preventDefault(); window.open('https://wa.me/905010311881', '_system'); } : undefined}
          className="lg:hidden fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-transform active:scale-95"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
          title="WhatsApp ile İletişime Geç"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}

      {/* Bottom nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around px-1 py-1">
          {bottomNavItems.map((item) => {
            const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => { hapticLight(); navigate(item.path); }}
                className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                  isActive ? 'text-electric-600' : 'text-slate-400'
                }`}
              >
                <item.icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-medium leading-none ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                {item.path === '/cart' && count > 0 && (
                  <span className="absolute right-2 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-electric-500 px-1 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute top-0 h-0.5 w-6 rounded-full bg-electric-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
