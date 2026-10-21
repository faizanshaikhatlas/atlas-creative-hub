"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { setDbScope, scopeForUser } from "@/lib/db/projects";

/**
 * Auth context for optional cloud features. When Supabase is not configured the
 * provider still renders and reports `configured: false` / `user: null`, so the
 * UI can hide cloud affordances and the app runs local-only.
 */
const AuthContext = createContext({
  configured: false,
  loading: false,
  user: null,
  session: null,
  dbScope: "guest",
  active: false,
  online: true,
  signInWithPassword: async () => {},
  signUpWithEmail: async () => {},
  signInWithMagicLink: async () => {},
  resetPasswordForEmail: async () => {},
  updatePassword: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState(null);
  // The local-storage scope follows the authenticated identity. "guest" when
  // signed out; "u-<uid>" when signed in. Consumers (e.g. the dashboard) read
  // this and re-query local designs whenever it changes.
  const [dbScope, setScopeState] = useState(scopeForUser(null));
  // Authoritative approval state (server-resolved via /api/me; never inferred on
  // the client). null = unknown/loading; true only for an approved, non-disabled
  // member. Automatic cloud sync is gated on this (the DB RLS enforces it too).
  const [active, setActive] = useState(false);
  // Connectivity, so sync UIs can show an honest "Offline" state.
  const [online, setOnline] = useState(true);

  // Keep the local DB namespace in lock-step with auth: sign-in, sign-out,
  // account switch, and session restore all funnel through `session.user.id`.
  // We set the module-level scope synchronously (so the next local query already
  // targets the right database) and mirror it into state to re-render consumers.
  useEffect(() => {
    const scope = scopeForUser(session?.user?.id ?? null);
    setDbScope(scope);
    setScopeState(scope);
  }, [session?.user?.id]);

  // Resolve approval from the authoritative server endpoint whenever the user
  // changes. Signed-out → not active.
  useEffect(() => {
    if (!configured || !session?.user) { setActive(false); return; }
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (alive) setActive(d?.active === true); })
      .catch(() => { if (alive) setActive(false); });
    return () => { alive = false; };
  }, [configured, session?.user?.id]);

  // Track connectivity for honest sync status.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine !== false);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, [configured]);

  const signInWithPassword = useCallback(async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud is not configured.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  // Email-first public signup. We DON'T ask the user to invent a password here:
  // signInWithOtp with shouldCreateUser creates the (unconfirmed, password-less)
  // account and emails a verification link. Clicking it hits /auth/callback,
  // which exchanges the code for a session and forwards to the password-setup
  // page (/update-password?setup=1) where the user sets their own password.
  //
  // This is the supported Supabase email-first flow — no insecure placeholder
  // password or custom token. The account is created `pending` by the DB trigger
  // (handle_new_user); email verification is NOT approval. An existing email just
  // receives a sign-in link instead (uniform response → no account enumeration).
  const signUpWithEmail = useCallback(async (email) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud is not configured.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/update-password?setup=1")}`
            : undefined,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithMagicLink = useCallback(async (email) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud is not configured.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Invite-only: a magic link must never CREATE an account, only sign in
        // an existing user. (Defense-in-depth with the dashboard's disabled
        // public signups.)
        shouldCreateUser: false,
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    if (error) throw error;
  }, []);

  const resetPasswordForEmail = useCallback(async (email) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Land on the code-exchange callback, which then forwards to the
      // set-new-password page with a valid recovery session.
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=/update-password`
          : undefined,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud is not configured.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = {
    configured,
    loading,
    session,
    dbScope,
    active,
    online,
    user: session?.user ?? null,
    signInWithPassword,
    signUpWithEmail,
    signInWithMagicLink,
    resetPasswordForEmail,
    updatePassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
