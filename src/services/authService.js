import { supabase } from './supabase';

/**
 * Registers a new user with email and password, and triggers Supabase email verification.
 * Stores the role in user_metadata.
 * @param {string} email
 * @param {string} password
 * @param {string} role
 * @returns {Promise<{ user: object|null, error: object|null }>} Supabase response
 */
export async function createAccountWithEmail(email, password, role) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
    },
  });
  // data.user will be null until email is confirmed
  return { user: data?.user ?? null, error };
}
