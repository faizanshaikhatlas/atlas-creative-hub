"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

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
  signInWithPassword: async () => {},
  signUpWithPassword: async () => {},
  signInWithMagicLink: async () => {},
  signInWithOAuth: async () => {},
  resetPasswordForEmail: async () => {},
  updatePassword: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState(null);

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

  const signUpWithPassword = useCallback(async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud is not configured.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    if (error) throw error;
    // Anti-enumeration: signing up with an ALREADY-registered email returns a
    // success-shaped 200 (no error, obfuscated user) and sends NO email. The
    // tell is an empty identities array. Surface it so the UI doesn't show a
    // misleading "check your email" when nothing was sent.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { alreadyRegistered: true, needsEmailConfirmation: false };
    }
    // When email confirmation is required, no session is returned yet.
    return { alreadyRegistered: false, needsEmailConfirmation: !data?.session };
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

  const signInWithOAuth = useCallback(async (provider = "google", next = "/") => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud is not configured.");
    // Land on the same PKCE callback the email flows use; it exchanges the code
    // for a cookie session and forwards to `next`. OAuth sign-in NEVER grants app
    // access by itself — a new Google user is provisioned 'pending' (DB trigger)
    // and stays gated by RLS + requireApproved until an admin approves them.
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safe)}`
        : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
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
    user: session?.user ?? null,
    signInWithPassword,
    signUpWithPassword,
    signInWithMagicLink,
    signInWithOAuth,
    resetPasswordForEmail,
    updatePassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
