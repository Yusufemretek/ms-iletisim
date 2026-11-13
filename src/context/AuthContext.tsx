import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { registerPushNotifications, unregisterPushNotifications } from '@/lib/push-notifications';
import type { Profile } from '@/lib/types';
import { trError } from '@/lib/errors';

export type AdminRole = 'super_admin' | 'staff';
export type AdminSection = 'orders' | 'support' | 'service' | 'trade_ins' | 'sell_phone' | 'operator_lead' | 'products' | 'suppliers';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminRole: AdminRole | null;
  assignedSections: AdminSection[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [assignedSections, setAssignedSections] = useState<AdminSection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  const checkAdmin = useCallback(async () => {
    const { data } = await supabase.rpc('is_admin');
    setIsAdmin(Boolean(data));
    if (data) {
      const { data: superData } = await supabase.rpc('is_super_admin');
      setIsSuperAdmin(Boolean(superData));
      setAdminRole(Boolean(superData) ? 'super_admin' : 'staff');
      const { data: sections } = await supabase.rpc('get_my_sections');
      setAssignedSections((sections as AdminSection[]) || []);
    } else {
      setIsSuperAdmin(false);
      setAdminRole(null);
      setAssignedSections([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        Promise.all([loadProfile(data.session.user.id), checkAdmin()]).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession) {
          await Promise.all([loadProfile(newSession.user.id), checkAdmin()]);
          registerPushNotifications(newSession.user.id);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setAdminRole(null);
          setAssignedSections([]);
        }
      })();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, checkAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? trError(error) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    // Pre-check via RPC: auth.users'da bu e-posta zaten kayitli mi?
    // (RLS anon profiles sorgusunu engeller, bu yuzden SECURITY DEFINER RPC kullaniriz)
    const { data: exists, error: rpcErr } = await supabase.rpc('check_email_exists', { p_email: email });
    if (rpcErr) {
      return { error: 'Kayit kontrolu yapilamadi. Lutfen tekrar deneyin.' };
    }
    if (exists) {
      return { error: 'Bu e-posta adresi zaten kayitli. Giris yapmayi deneyin.' };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('been taken')) {
        return { error: 'Bu e-posta adresi zaten kayitli. Giris yapmayi deneyin.' };
      }
      return { error: trError(error) };
    }
    // Profile is auto-created by the on_auth_user_created trigger.
    // If a session was established, update the profile with any extra info.
    if (data.user && data.session) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
      });
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    if (session?.user.id) {
      await unregisterPushNotifications(session.user.id);
    }
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setAdminRole(null);
    setAssignedSections([]);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const updateProfile = useCallback(
    async (data: Partial<Profile>) => {
      if (!session?.user.id) return { error: 'Oturum yok' };
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', session.user.id);
      if (error) return { error: trError(error) };
      await loadProfile(session.user.id);
      return { error: null };
    },
    [session, loadProfile],
  );

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin,
    isSuperAdmin,
    adminRole,
    assignedSections,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
