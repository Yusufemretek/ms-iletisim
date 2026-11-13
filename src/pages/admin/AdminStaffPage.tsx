import { useEffect, useState, useCallback } from 'react';
import { UserCog, Shield, Mail, Trash2, Plus, Search, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';
import type { AdminSection } from '@/context/AuthContext';
import type { Profile } from '@/lib/types';
import { trError } from '@/lib/errors';

interface StaffMember {
  user_id: string;
  email: string;
  role: string;
  assigned_sections: string[];
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

const ALL_SECTIONS: { key: AdminSection; label: string }[] = [
  { key: 'orders', label: 'Siparişler' },
  { key: 'support', label: 'Canlı Destek' },
  { key: 'service', label: 'Servis Teklifi' },
  { key: 'trade_ins', label: 'Cihaz Takası' },
  { key: 'sell_phone', label: 'Telefon Satış' },
  { key: 'products', label: 'Ürünler' },
  { key: 'suppliers', label: 'Tedarikçiler' },
];

export function AdminStaffPage() {
  const { isSuperAdmin } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newSections, setNewSections] = useState<AdminSection[]>(['orders']);
  const [newRole, setNewRole] = useState<'super_admin' | 'staff'>('staff');
  const [saving, setSaving] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_staff_members');
    if (error) {
      setError(trError(error));
    } else {
      setStaff(data as StaffMember[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', `%${searchEmail.trim()}%`)
      .limit(10);
    setSearchResults((data as Profile[]) || []);
    setSearching(false);
  };

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc('add_staff_member', {
      p_user_id: selectedUserId,
      p_role: newRole,
      p_sections: newSections,
    });
    if (error) {
      setError(trError(error));
    } else {
      setAddModalOpen(false);
      setSelectedUserId(null);
      setSearchEmail('');
      setSearchResults([]);
      setNewSections(['orders']);
      setNewRole('staff');
      loadStaff();
    }
    setSaving(false);
  };

  const handleUpdate = async (member: StaffMember, role: string, sections: string[]) => {
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc('update_staff_member', {
      p_user_id: member.user_id,
      p_role: role,
      p_sections: sections,
    });
    if (error) {
      setError(trError(error));
    } else {
      setEditMember(null);
      loadStaff();
    }
    setSaving(false);
  };

  const handleRemove = async (member: StaffMember) => {
    if (!confirm(`${member.email} personeli olarak kaldırılacak. Emin misiniz?`)) return;
    const { error } = await supabase.rpc('remove_staff_member', { p_user_id: member.user_id });
    if (error) {
      setError(trError(error));
    } else {
      loadStaff();
    }
  };

  const toggleSection = (section: AdminSection, current: AdminSection[], setter: (s: AdminSection[]) => void) => {
    if (current.includes(section)) {
      setter(current.filter(s => s !== section));
    } else {
      setter([...current, section]);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Shield className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-4 text-lg font-bold text-slate-800">Yetkisiz Erişim</h1>
          <p className="mt-1 text-sm text-slate-500">Bu sayfaya sadece süper admin erişebilir.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Personel Yönetimi</h1>
          <p className="mt-1 text-sm text-slate-500">{staff.length} personel</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4" /> Personel Ekle
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <UserCog className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Henüz personel tanımlanmamış.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.user_id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-600">
                    {(member.first_name?.[0] || member.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {member.first_name} {member.last_name}
                      </p>
                      {member.role === 'super_admin' ? (
                        <Badge variant="error">Süper Admin</Badge>
                      ) : (
                        <Badge variant="info">Personel</Badge>
                      )}
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Mail className="h-3.5 w-3.5" /> {member.email}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">Eklenme: {formatDate(member.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditMember(member)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Düzenle
                  </button>
                  {member.role !== 'super_admin' && (
                    <button
                      onClick={() => handleRemove(member)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {member.role === 'staff' && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ALL_SECTIONS.map(s => {
                    const active = member.assigned_sections.includes(s.key);
                    return (
                      <span
                        key={s.key}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                          active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-1 ring-slate-100'
                        }`}
                      >
                        {active && <Check className="mr-1 inline h-3 w-3" />}
                        {s.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add staff modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Personel Ekle" size="lg">
        <div className="space-y-5">
          {/* Step 1: Search user */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Kullanıcı Ara</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="E-posta adresi ile ara..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <Button variant="outline" onClick={searchUsers} loading={searching}>
                Ara
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      selectedUserId === u.id ? 'bg-electric-100 ring-1 ring-electric-300' : 'hover:bg-white'
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-600">
                      {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    {selectedUserId === u.id && <Check className="ml-auto h-4 w-4 text-electric-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Role */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Rol</label>
            <div className="flex gap-2">
              <button
                onClick={() => setNewRole('staff')}
                className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
                  newRole === 'staff' ? 'border-electric-300 bg-electric-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-4 w-4 rounded-full border-2 ${newRole === 'staff' ? 'border-electric-500 bg-electric-500' : 'border-slate-300'}`} />
                  <span className="text-sm font-medium text-slate-800">Personel</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Sadece atanan bölümleri görür</p>
              </button>
              <button
                onClick={() => setNewRole('super_admin')}
                className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
                  newRole === 'super_admin' ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-4 w-4 rounded-full border-2 ${newRole === 'super_admin' ? 'border-red-500 bg-red-500' : 'border-slate-300'}`} />
                  <span className="text-sm font-medium text-slate-800">Süper Admin</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Tüm bölümleri görür, tam yetki</p>
              </button>
            </div>
          </div>

          {/* Step 3: Sections (only for staff) */}
          {newRole === 'staff' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Sorumlu Olduğu Bölümler</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SECTIONS.map(s => {
                  const active = newSections.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSection(s.key, newSections, setNewSections)}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${
                        active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                        active ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                      }`}>
                        {active && <Check className="h-3 w-3 text-white" />}
                      </div>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              <X className="h-4 w-4" /> İptal
            </Button>
            <Button onClick={handleAdd} loading={saving} disabled={!selectedUserId}>
              <Check className="h-4 w-4" /> Ekle
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit staff modal */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Personel Düzenle" size="lg">
        {editMember && (
          <EditStaffForm
            member={editMember}
            onSave={handleUpdate}
            saving={saving}
            toggleSection={toggleSection}
          />
        )}
      </Modal>
    </div>
  );
}

function EditStaffForm({ member, onSave, saving, toggleSection }: {
  member: StaffMember;
  onSave: (member: StaffMember, role: string, sections: string[]) => void;
  saving: boolean;
  toggleSection: (section: AdminSection, current: AdminSection[], setter: (s: AdminSection[]) => void) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [sections, setSections] = useState<AdminSection[]>(member.assigned_sections as AdminSection[]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
            {(member.first_name?.[0] || member.email[0]).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{member.first_name} {member.last_name}</p>
            <p className="text-sm text-slate-500">{member.email}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Rol</label>
        <div className="flex gap-2">
          <button
            onClick={() => setRole('staff')}
            className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
              role === 'staff' ? 'border-electric-300 bg-electric-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full border-2 ${role === 'staff' ? 'border-electric-500 bg-electric-500' : 'border-slate-300'}`} />
              <span className="text-sm font-medium text-slate-800">Personel</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Sadece atanan bölümleri görür</p>
          </button>
          <button
            onClick={() => setRole('super_admin')}
            className={`flex-1 rounded-xl border p-3 text-left transition-colors ${
              role === 'super_admin' ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full border-2 ${role === 'super_admin' ? 'border-red-500 bg-red-500' : 'border-slate-300'}`} />
              <span className="text-sm font-medium text-slate-800">Süper Admin</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Tüm bölümleri görür, tam yetki</p>
          </button>
        </div>
      </div>

      {role === 'staff' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Sorumlu Olduğu Bölümler</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_SECTIONS.map(s => {
              const active = sections.includes(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSection(s.key, sections, setSections)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${
                    active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                    active ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                  }`}>
                    {active && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={() => onSave(member, role, sections)} loading={saving}>
          <Check className="h-4 w-4" /> Kaydet
        </Button>
      </div>
    </div>
  );
}
