import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { useRouter, matchRoute } from '@/lib/router';
import { CustomerLayout } from '@/components/CustomerLayout';
import { AdminLayout } from '@/components/AdminLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { navigate } from '@/lib/router';
import { Home } from 'lucide-react';

// Customer pages
import { HomePage } from '@/pages/customer/HomePage';
import { ProductsPage } from '@/pages/customer/ProductsPage';
import { ProductDetailPage } from '@/pages/customer/ProductDetailPage';
import { CartPage } from '@/pages/customer/CartPage';
import { CheckoutPage } from '@/pages/customer/CheckoutPage';
import { OrdersPage } from '@/pages/customer/OrdersPage';
import { OrderDetailPage } from '@/pages/customer/OrderDetailPage';
import { ProfilePage } from '@/pages/customer/ProfilePage';
import { CustomerServicePage } from '@/pages/customer/CustomerServicePage';
import { UsedPhonesPage } from '@/pages/customer/UsedPhonesPage';
import { SellPhonePage } from '@/pages/customer/SellPhonePage';
import { MySellPhoneRequestsPage } from '@/pages/customer/MySellPhoneRequestsPage';
import { TradeInPage } from '@/pages/customer/TradeInPage';
import { MyTradeInsPage } from '@/pages/customer/MyTradeInsPage';
import { SupportPage } from '@/pages/customer/SupportPage';
import { FavoritesPage } from '@/pages/customer/FavoritesPage';
import { LoginPage, RegisterPage, ResetPasswordPage, UpdatePasswordPage } from '@/pages/customer/AuthPages';

// Admin pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminOrderDetailPage } from '@/pages/admin/AdminOrderDetailPage';
import { AdminProductsPage } from '@/pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminCustomersPage } from '@/pages/admin/AdminCustomersPage';
import { AdminSalesPage } from '@/pages/admin/AdminSalesPage';
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';
import { PosPage } from '@/pages/admin/PosPage';
import { AdminFinancePage } from '@/pages/admin/AdminFinancePage';
import { AdminServicePage } from '@/pages/admin/AdminServicePage';
import { AdminDeliveriesPageNew } from '@/pages/admin/AdminDeliveriesPageNew';
import { AdminUsedDevicesPage } from '@/pages/admin/AdminUsedDevicesPage';
import { AdminSellPhonePage } from '@/pages/admin/AdminSellPhonePage';
import { AdminTradeInsPage } from '@/pages/admin/AdminTradeInsPage';
import { AdminSupportPage } from '@/pages/admin/AdminSupportPage';
import { AdminCampaignsPage } from '@/pages/admin/AdminCampaignsPage';
import { AdminInstallmentsPage } from '@/pages/admin/AdminInstallmentsPage';
import { AdminKvkkPage } from '@/pages/admin/AdminKvkkPage';
import { AdminStaffPage } from '@/pages/admin/AdminStaffPage';
import { AdminBroadcastPage } from '@/pages/admin/AdminBroadcastPage';
import { AdminSuppliersPage } from '@/pages/admin/AdminSuppliersPage';
import { AdminBannersPage } from '@/pages/admin/AdminBannersPage';
import { KvkkPage } from '@/pages/customer/KvkkPage';
import { PrivacyPage } from '@/pages/customer/PrivacyPage';

function AppRoutes() {
  const { route } = useRouter();
  const { user, isAdmin, loading } = useAuth();
  const path = route.path;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  // Auth pages (no layout)
  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  if (path === '/update-password') return <UpdatePasswordPage />;
  if (path === '/kvkk') return <KvkkPage />;

  // Admin routes
  if (path.startsWith('/admin')) {
    return (
      <AdminLayout>
        <AdminRouter path={path} isAdmin={isAdmin} />
      </AdminLayout>
    );
  }

  // Customer routes
  return (
    <CustomerLayout>
      <CustomerRouter path={path} query={route.query} user={user} />
    </CustomerLayout>
  );
}

function AdminRouter({ path, isAdmin }: { path: string; isAdmin: boolean }) {
  if (!isAdmin) return null;

  if (path === '/admin') return <AdminDashboard />;
  if (path === '/admin/pos') return <PosPage />;
  if (path === '/admin/orders') return <AdminOrdersPage />;
  if (path === '/admin/products') return <AdminProductsPage />;
  if (path === '/admin/categories') return <AdminCategoriesPage />;
  if (path === '/admin/customers') return <AdminCustomersPage />;
  if (path === '/admin/deliveries') return <AdminDeliveriesPageNew />;
  if (path === '/admin/services') return <AdminServicePage />;
  if (path === '/admin/finance') return <AdminFinancePage />;
  if (path === '/admin/sales') return <AdminSalesPage />;
  if (path === '/admin/reports') return <AdminReportsPage />;
  if (path === '/admin/settings') return <AdminSettingsPage />;
  if (path === '/admin/used-devices') return <AdminUsedDevicesPage />;
  if (path === '/admin/sell-phone') return <AdminSellPhonePage />;
  if (path === '/admin/trade-ins') return <AdminTradeInsPage />;
  if (path === '/admin/support') return <AdminSupportPage />;
  if (path === '/admin/campaigns') return <AdminCampaignsPage />;
  if (path === '/admin/installments') return <AdminInstallmentsPage />;
  if (path === '/admin/kvkk') return <AdminKvkkPage />;
  if (path === '/admin/staff') return <AdminStaffPage />;
  if (path === '/admin/broadcast') return <AdminBroadcastPage />;
  if (path === '/admin/suppliers') return <AdminSuppliersPage />;
  if (path === '/admin/banners') return <AdminBannersPage />;

  const orderMatch = matchRoute('/admin/orders/:id', path);
  if (orderMatch) return <AdminOrderDetailPage id={orderMatch.id} />;

  return <NotFoundPage />;
}

function CustomerRouter({ path, query, user }: { path: string; query: URLSearchParams; user: ReturnType<typeof useAuth>['user'] }) {
  if (path === '/') return <HomePage />;

  // Turkish clean URLs (primary)
  if (path === '/urunler') return <ProductsPage key={`urunler?${query.toString()}`} query={query} />;
  if (path === '/telefonlar') return <ProductsPage key="telefonlar" query={new URLSearchParams('type=new_phone')} />;
  if (path === '/ikinci-el-telefonlar') return <UsedPhonesPage key="ikinci-el" />;
  if (path === '/aksesuarlar') return <ProductsPage key="aksesuarlar" query={new URLSearchParams('type=accessory')} />;
  if (path === '/tabletler') return <ProductsPage key="tabletler" query={new URLSearchParams('type=tablet')} />;
  if (path === '/akilli-saatler') return <ProductsPage key="akilli-saatler" query={new URLSearchParams('type=smartwatch')} />;
  if (path === '/teknik-servis') return user ? <CustomerServicePage /> : <LoginPage />;

  // Backward-compatible English routes
  if (path === '/products') return <ProductsPage key="products" query={query} />;
  if (path === '/used-phones') return <UsedPhonesPage key="used-phones" />;
  if (path === '/services') return user ? <CustomerServicePage /> : <LoginPage />;

  // Cart
  if (path === '/cart') return <CartPage />;

  // Sell / Trade-in
  if (path === '/sell-phone') return user ? <SellPhonePage /> : <LoginPage />;
  if (path === '/sell-phone-requests') return user ? <MySellPhoneRequestsPage /> : <LoginPage />;
  if (path === '/trade-in') return user ? <TradeInPage /> : <LoginPage />;
  if (path === '/trade-in-requests') return user ? <MyTradeInsPage /> : <LoginPage />;

  // Support
  if (path === '/support') return user ? <SupportPage /> : <LoginPage />;
  if (path === '/favorites') return user ? <FavoritesPage /> : <LoginPage />;

  // Protected routes
  if (path === '/checkout') return user ? <CheckoutPage /> : <LoginPage />;
  if (path === '/orders') return user ? <OrdersPage /> : <LoginPage />;
  if (path === '/profile') return user ? <ProfilePage /> : <LoginPage />;
  if (path === '/account/privacy') return user ? <PrivacyPage /> : <LoginPage />;

  const usedDeviceMatch = matchRoute('/used-phones/:id', path);
  if (usedDeviceMatch) return <UsedPhonesPage />;

  // Product detail by slug (Turkish clean URL: /urun/:slug)
  const productSlugMatch = matchRoute('/urun/:slug', path);
  if (productSlugMatch) return <ProductDetailPage slug={productSlugMatch.slug} />;

  // Product detail by ID (backward compatible: /product/:id)
  const productIdMatch = matchRoute('/product/:id', path);
  if (productIdMatch) return <ProductDetailPage id={productIdMatch.id} />;

  const orderMatch = matchRoute('/order/:id', path);
  if (orderMatch) return user ? <OrderDetailPage id={orderMatch.id} /> : <LoginPage />;

  return <NotFoundPage />;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <Logo size={64} rounded="rounded-2xl" className="mb-6 ring-1 ring-electric-500/20" />
      <h1 className="text-6xl font-bold text-slate-900">404</h1>
      <p className="mt-2 text-lg font-medium text-slate-600">Sayfa Bulunamadı</p>
      <p className="mt-1 text-sm text-slate-400">Aradığınız sayfa taşınmış veya kaldırılmış olabilir.</p>
      <Button className="mt-6" onClick={() => navigate('/')}>
        <Home className="h-4 w-4" /> Ana Sayfaya Dön
      </Button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
