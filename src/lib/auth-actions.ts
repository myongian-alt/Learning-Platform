import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { UserRole } from '@/types/database';

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Sign up did not return a user.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, full_name: fullName, role })
    .select()
    .single();
  if (profileError) throw profileError;

  // The auth listener's own profile fetch (triggered by the SIGNED_IN event) can race this
  // insert and resolve first, finding no row yet. Push the row we just created directly so
  // the store is correct regardless of that race.
  useAuthStore.getState().setProfile(profile);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function joinClassWithCode(joinCode: string, studentId: string) {
  // `classes` RLS only allows select for a teacher or an existing member, so a student who
  // isn't in the class yet can't look it up directly by code — this RPC is a narrow,
  // security-definer exception that resolves just the id for a valid code.
  const { data: classId, error: lookupError } = await supabase.rpc('find_class_id_by_join_code', {
    code: joinCode,
  });
  if (lookupError || !classId) throw new Error('No class found with that code.');

  const { error: joinError } = await supabase
    .from('class_members')
    .insert({ class_id: classId, student_id: studentId });
  if (joinError) throw joinError;

  return classId;
}
