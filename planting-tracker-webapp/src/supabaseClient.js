import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase config. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Usernames are assigned by the farm admin, not self-registered. Supabase Auth
// needs an email under the hood, so a username like "jon" becomes the email
// "jon@farmusers.local" behind the scenes — invisible to whoever's logging in.
export const USER_DOMAIN = "farmusers.local";
export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USER_DOMAIN}`;
}
export function emailToUsername(email) {
  return (email || "").split("@")[0];
}
