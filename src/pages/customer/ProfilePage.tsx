import { useEffect, useState } from 'react';
import { Lock, MapPin, Plus, Pencil, Trash2, Star, Signal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Address } from '@/lib/types';
import { LEAD_STATUS_LABELS, LEAD_STATUS_VARIANTS, REQUEST_TYPE_LABELS } from '@/lib/operator-campaigns';
import { Badge } from '@/components/ui/Badge';
import { trError } from '@/lib/errors';

export function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [campaignLeads, setCampaignLeads] = useState<{ id: string; campaign_name: string; operator_name: string; operator_color: string; request_type: string; status: string; created_at: string }[]>([]);

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  // Password form
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  // Address form
  const emptyAddr = { title: '', city: '', district: '', neighborhood: '', street: '', building_no: '', apartment_no: '', directions: '', phone: '', is_default: false };
  const [addrForm, setAddrForm] = useState(emptyAddr);

  useEffect(() => {
    if (!user) return;
    setFirstName(profile?.first_name || '');
    setLastName(profile?.last_name || '');
    setPhone(profile?.phone || '');
    loadAddresses();
    loadCampaignLeads();
  }, [user, profile]);

  const loadCampaignLeads = async () => {
    const { data } = await supabase
      .from('operator_leads')
      .select('id, request_type, status, created_at, campaign:operator_campaigns(name), operator:operators(name, color)')
      .order('created_at', { ascending: false });
    setCampaignLeads((data as unknown as { id: string; request_type: string; status: string; created_at: string; campaign: { name: string }[] | null; operator: { name: string; color: string }[] | null }[])?.map(l => ({
      id: l.id, request_type: l.request_type, status: l.status, created_at: l.created_at,
      campaign_name: l.campaign?.[0]?.name || '',
      operator_name: l.operator?.[0]?.name || '',
      operator_color: l.operator?.[0]?.color || '#6366f1',
    })) || []);
  };

  const loadAddresses = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setAddresses((data as Address[]) || []);
    setLoading(false);
  };

  if (!user) return null;

  const handleSaveProfile = async () => {
    setProfileMsg('');
    const { error } = await updateProfile({ first_name: firstName, last_name: lastName, phone });
    if (error) setProfileMsg(error);
    else setProfileMsg('Profil güncellendi.');
    setTimeout(() => setProfileMsg(''), 3000);
  };

  const handleChangePassword = async () => {
    setPasswordMsg('');
    if (newPassword.length < 6) {
      setPasswordMsg('Şifre en az 6 karakter olmalı.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPasswordMsg(trError(error));
    else {
      setPasswordMsg('Şifre güncellendi.');
      setNewPassword('');
      setTimeout(() => { setShowPasswordModal(false); setPasswordMsg(''); }, 2000);
    }
  };

  const openNewAddr = () => {
    setEditingAddr(null);
    setAddrForm(emptyAddr);
    setShowAddrModal(true);
  };

  const openEditAddr = (addr: Address) => {
    setEditingAddr(addr);
    setAddrForm({
      title: addr.title,
      city: addr.city,
      district: addr.district,
      neighborhood: addr.neighborhood,
      street: addr.street,
      building_no: addr.building_no || '',
      apartment_no: addr.apartment_no || '',
      directions: addr.directions || '',
      phone: addr.phone || '',
      is_default: addr.is_default,
    });
    setShowAddrModal(true);
  };

  const handleSaveAddr = async () => {
    if (!addrForm.title || !addrForm.city || !addrForm.district || !addrForm.neighborhood || !addrForm.street) return;

    if (editingAddr) {
      await supabase.from('addresses').update(addrForm).eq('id', editingAddr.id);
    } else {
      await supabase.from('addresses').insert({ ...addrForm, user_id: user.id });
    }

    if (addrForm.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .neq('id', editingAddr?.id || '00000000-0000-0000-0000-000000000000')
        .eq('user_id', user.id);
    }

    setShowAddrModal(false);
    loadAddresses();
  };

  const handleDeleteAddr = async (id: string) => {
    if (!confirm('Bu adresi silmek istediğinize emin misiniz?')) return;
    await supabase.from('addresses').delete().eq('id', id);
    loadAddresses();
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    loadAddresses();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Profilim</h1>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Profile info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-slate-900">Kişisel Bilgiler</h2>
          <div className="space-y-3">
            <Input label="Ad" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label="Soyad" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input label="E-posta" value={user.email || ''} disabled />
            <Input label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSaveProfile}>Kaydet</Button>
            <Button variant="outline" onClick={() => setShowPasswordModal(true)}>
              <Lock className="h-4 w-4" />
              Şifre Değiştir
            </Button>
          </div>
          {profileMsg && <p className="mt-3 text-sm text-emerald-600">{profileMsg}</p>}
        </div>

        {/* Addresses */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Adreslerim</h2>
            <Button size="sm" variant="outline" onClick={openNewAddr}>
              <Plus className="h-4 w-4" />
              Yeni Adres
            </Button>
          </div>

          {loading ? (
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ) : addresses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
              <MapPin className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">Henüz adres eklemediniz.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-900">{addr.title}</p>
                      {addr.is_default && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Varsayılan
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditAddr(addr)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDeleteAddr(addr.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {addr.neighborhood}, {addr.street}, {addr.district}, {addr.city}
                  </p>
                  {addr.phone && <p className="text-xs text-slate-400">Tel: {addr.phone}</p>}
                  {!addr.is_default && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Varsayılan Yap
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <Button variant="danger" onClick={signOut}>
              Çıkış Yap
            </Button>
          </div>
        </div>
      </div>

      {/* Campaign leads */}
      {campaignLeads.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
            <Signal className="h-5 w-5 text-electric-500" /> Kampanya Taleplerim
          </h2>
          <div className="space-y-2">
            {campaignLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: lead.operator_color }}>
                    {lead.operator_name[0]}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{lead.operator_name} — {lead.campaign_name}</p>
                    <p className="text-xs text-slate-500">{REQUEST_TYPE_LABELS[lead.request_type] || lead.request_type} • {new Date(lead.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                </div>
                <Badge variant={LEAD_STATUS_VARIANTS[lead.status as keyof typeof LEAD_STATUS_VARIANTS] || 'default'}>
                  {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] || lead.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Address modal */}
      <Modal open={showAddrModal} onClose={() => setShowAddrModal(false)} title={editingAddr ? 'Adresi Düzenle' : 'Yeni Adres'} size="lg">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Adres Başlığı *" value={addrForm.title} onChange={(e) => setAddrForm({ ...addrForm, title: e.target.value })} placeholder="Ev, İş vs." />
          <Input label="Telefon" value={addrForm.phone} onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })} />
          <Input label="İl *" value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} />
          <Input label="İlçe *" value={addrForm.district} onChange={(e) => setAddrForm({ ...addrForm, district: e.target.value })} />
          <Input label="Mahalle *" value={addrForm.neighborhood} onChange={(e) => setAddrForm({ ...addrForm, neighborhood: e.target.value })} />
          <Input label="Sokak/Cadde *" value={addrForm.street} onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })} />
          <Input label="Bina No" value={addrForm.building_no} onChange={(e) => setAddrForm({ ...addrForm, building_no: e.target.value })} />
          <Input label="Daire No" value={addrForm.apartment_no} onChange={(e) => setAddrForm({ ...addrForm, apartment_no: e.target.value })} />
        </div>
        <div className="mt-3">
          <Input label="Adres Tarifi" value={addrForm.directions} onChange={(e) => setAddrForm({ ...addrForm, directions: e.target.value })} placeholder="Örn: Karşısında market var" />
        </div>
        <label className="mt-3 flex items-center gap-2">
          <input type="checkbox" checked={addrForm.is_default} onChange={(e) => setAddrForm({ ...addrForm, is_default: e.target.checked })} className="rounded" />
          <span className="text-sm text-slate-700">Varsayılan adres olarak ayarla</span>
        </label>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowAddrModal(false)}>İptal</Button>
          <Button className="flex-1" onClick={handleSaveAddr}>{editingAddr ? 'Güncelle' : 'Kaydet'}</Button>
        </div>
      </Modal>

      {/* Password modal */}
      <Modal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Şifre Değiştir">
        <Input label="Yeni Şifre" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" />
        {passwordMsg && <p className="mt-3 text-sm text-emerald-600">{passwordMsg}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowPasswordModal(false)}>İptal</Button>
          <Button className="flex-1" onClick={handleChangePassword}>Şifreyi Güncelle</Button>
        </div>
      </Modal>
    </div>
  );
}
