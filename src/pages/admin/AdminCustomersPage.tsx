import { useEffect, useState } from 'react';
import { Search, Users, ChevronRight, Mail, Phone, MapPin, Ban, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatPrice, formatDate, formatDateTime, ORDER_STATUS_LABELS } from '@/lib/format';
import type { Profile, Address, Order } from '@/lib/types';
import { trError } from '@/lib/errors';

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<(Profile & { order_count?: number; total_spent?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<Address[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [showBanModal, setShowBanModal] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: orders } = await supabase.from('orders').select('user_id, total, status');
    const stats: Record<string, { count: number; spent: number }> = {};
    (orders || []).forEach((o: { user_id: string; total: number; status: string }) => {
      if (!stats[o.user_id]) stats[o.user_id] = { count: 0, spent: 0 };
      stats[o.user_id].count++;
      if (o.status === 'delivered') stats[o.user_id].spent += Number(o.total);
    });
    setCustomers((profiles || []).map((p: Profile) => ({ ...p, order_count: stats[p.id]?.count || 0, total_spent: stats[p.id]?.spent || 0 })));
    setLoading(false);
  };

  const openCustomer = async (customer: Profile) => {
    setSelected(customer);
    setDetailLoading(true);
    const [ordersRes, addrRes] = await Promise.all([
      supabase.from('orders').select('*').eq('user_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('addresses').select('*').eq('user_id', customer.id).order('is_default', { ascending: false }),
    ]);
    setCustomerOrders((ordersRes.data as Order[]) || []);
    setCustomerAddresses((addrRes.data as Address[]) || []);
    setDetailLoading(false);
  };

  const handleBan = async () => {
    if (!selected) return;
    setBanLoading(true);
    const { error: err } = await supabase.from('profiles')
      .update({ is_banned: true, banned_reason: banReason || null, banned_at: new Date().toISOString() })
      .eq('id', selected.id);
    setBanLoading(false);
    if (err) { alert('Hata: ' + trError(err)); return; }
    setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, is_banned: true, banned_reason: banReason || null, banned_at: new Date().toISOString() } : c));
    setSelected({ ...selected, is_banned: true, banned_reason: banReason || null, banned_at: new Date().toISOString() });
    setShowBanModal(false);
    setBanReason('');
  };

  const handleUnban = async () => {
    if (!selected) return;
    setBanLoading(true);
    const { error: err } = await supabase.from('profiles')
      .update({ is_banned: false, banned_reason: null, banned_at: null })
      .eq('id', selected.id);
    setBanLoading(false);
    if (err) { alert('Hata: ' + trError(err)); return; }
    setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, is_banned: false, banned_reason: null, banned_at: null } : c));
    setSelected({ ...selected, is_banned: false, banned_reason: null, banned_at: null });
  };

  const filtered = customers.filter((c) =>
    !search ||
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Müşteriler</h1>
        <p className="mt-1 text-sm text-slate-500">{filtered.length} müşteri</p>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Müşteri ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Müşteri bulunamadı.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Müşteri</th>
                <th className="p-3 font-medium">E-posta</th>
                <th className="p-3 font-medium">Telefon</th>
                <th className="p-3 font-medium">Sipariş</th>
                <th className="p-3 font-medium">Harcama</th>
                <th className="p-3 font-medium">Kayıt</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => openCustomer(c)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                        {(c.first_name?.[0] || c.email[0]).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{c.first_name} {c.last_name}</span>
                        {c.is_banned && <Badge variant="error">Yasaklı</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-slate-500">{c.email}</td>
                  <td className="p-3 text-slate-500">{c.phone || '-'}</td>
                  <td className="p-3 text-slate-600">{c.order_count}</td>
                  <td className="p-3 font-medium text-slate-900">{formatPrice(c.total_spent || 0)}</td>
                  <td className="p-3 text-slate-400">{formatDate(c.created_at)}</td>
                  <td className="p-3"><ChevronRight className="h-4 w-4 text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Müşteri Detayı" size="lg">
        {selected && (
          <div className="space-y-5">
            {/* Info */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-600">
                  {(selected.first_name?.[0] || selected.email[0]).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-slate-900">{selected.first_name} {selected.last_name}</p>
                    {selected.is_banned && <Badge variant="error">Yasaklı</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {selected.email}</span>
                    {selected.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {selected.phone}</span>}
                  </div>
                  {selected.is_banned && selected.banned_reason && (
                    <p className="mt-1 text-xs text-red-600">Yasaklama sebebi: {selected.banned_reason}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-400">Toplam Sipariş</p>
                  <p className="text-lg font-bold text-slate-900">{customerOrders.length}</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-400">Toplam Harcama</p>
                  <p className="text-lg font-bold text-slate-900">{formatPrice(customerOrders.filter((o) => o.status === 'delivered').reduce((s, o) => s + Number(o.total), 0))}</p>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Adresler</h3>
              {customerAddresses.length === 0 ? (
                <p className="text-sm text-slate-400">Adres kaydı yok.</p>
              ) : (
                <div className="space-y-2">
                  {customerAddresses.map((addr) => (
                    <div key={addr.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-900">{addr.title}</p>
                        {addr.is_default && <Badge variant="amber">Varsayılan</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{addr.neighborhood}, {addr.street}, {addr.district}, {addr.city}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Orders */}
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Sipariş Geçmişi</h3>
              {detailLoading ? (
                <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ) : customerOrders.length === 0 ? (
                <p className="text-sm text-slate-400">Sipariş yok.</p>
              ) : (
                <div className="space-y-2">
                  {customerOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{o.order_number}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(o.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={o.status === 'cancelled' ? 'error' : o.status === 'delivered' ? 'success' : 'amber'}>
                          {ORDER_STATUS_LABELS[o.status]}
                        </Badge>
                        <span className="text-sm font-bold text-slate-900">{formatPrice(o.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ban / Unban */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              {selected.is_banned ? (
                <Button variant="outline" onClick={handleUnban} loading={banLoading}>
                  <CheckCircle2 className="h-4 w-4" /> Yasağı Kaldır
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setShowBanModal(true)}>
                  <Ban className="h-4 w-4" /> Müşteriyi Yasakla
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Ban reason modal */}
      <Modal open={showBanModal} onClose={() => setShowBanModal(false)} title="Müşteriyi Yasakla" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <strong>{selected?.first_name} {selected?.last_name}</strong> adlı müşteriyi yasaklamak üzeredesiniz. Yasaklı müşteriler sipariş veremez.
          </p>
          <Input
            label="Yasaklama Sebebi (opsiyonel)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Örn: Problem çıkardı, dolandırıcılık şüphesi"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowBanModal(false)}>İptal</Button>
            <Button variant="danger" className="flex-1" loading={banLoading} onClick={handleBan}>Yasakla</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
