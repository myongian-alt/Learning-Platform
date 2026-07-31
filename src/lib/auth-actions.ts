import { supabase } from '@/lib/supabase';
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

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, full_name: fullName, role });
  if (profileError) throw profileError;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function joinClassWithCode(joinCode: string, studentId: string) {
  const { data: classRow, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('join_code', joinCode.trim().toUpperCase())
    .single();
  if (classError || !classRow) throw new Error('No class found with that code.');

  const { error: joinError } = await supabase
    .from('class_members')
    .insert({ class_id: classRow.id, student_id: studentId });
  if (joinError) throw joinError;

  return classRow.id;
}
