import { useEffect } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { Profile } from '@/types/database';
import type { Session } from '@supabase/supabase-js';

// Right after sign-up, the profile insert and this fetch can race — retry a couple of times
// on "no rows" (PGRST116) before giving up, instead of leaving the store's profile stuck null.
async function fetchProfile(userId: string, attempt = 0): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    if (error.code === 'PGRST116' && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return fetchProfile(userId, attempt + 1);
    }
    console.warn('[penbook] failed to load profile', error.message);
    return null;
  }
  return data;
}

/** Keeps useAuthStore in sync with Supabase auth state. Mount once, at the app root. */
export function useAuthListener() {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    // supabase-js's onAuthStateChange fires an immediate synthetic `INITIAL_SESSION` event
    // on subscribe, on top of the explicit getSession() call below — two concurrent
    // syncSession runs for the same initial session. Whichever happened to resolve its
    // fetchProfile last would win and could stomp a correct result with a stale/transient
    // one. `generation` makes a run's result a no-op unless it's still the latest one
    // started, so a slower, superseded call can never overwrite a newer one's state.
    let generation = 0;

    async function syncSession(session: Session | null) {
      const thisRun = ++generation;
      setLoading(true);
      setSession(session);
      const profile = session ? await fetchProfile(session.user.id) : null;
      if (!isMounted || thisRun !== generation) return;
      setProfile(profile);
      setLoading(false);
    }

    // A corrupted or otherwise unreadable stored session (stale localStorage from an
    // earlier build, a deleted account, a network hiccup during token refresh) must never
    // leave the app stuck on the loading spinner forever — race it against a timeout and
    // treat a rejection the same as "no session" instead of letting an unhandled rejection
    // silently swallow the only code path that calls setLoading(false).
    const sessionResult = supabase.auth.getSession().then(
      ({ data }) => data.session,
      (error) => {
        console.warn('[penbook] getSession failed, treating as signed out', error);
        return null;
      },
    );
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));

    Promise.race([sessionResult, timeout]).then((session) => {
      if (isMounted) syncSession(session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip the synthetic initial event — the getSession() call above already covers it.
      // Only react to real, subsequent transitions (sign in/out, token refresh, ...).
      if (event === 'INITIAL_SESSION') return;
      if (isMounted) syncSession(session);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading]);
}
