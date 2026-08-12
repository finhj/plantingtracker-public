import React, { useEffect, useState } from "react";
import { supabase, emailToUsername } from "./supabaseClient";
import Login from "./Login.jsx";
import PlantingMap from "./PlantingMap.jsx";
import VersionBadge from './VersionBadge';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</div>;
  }
  if (!session) {
    return <Login />;
  }

  const username = emailToUsername(session.user.email);
  return <PlantingMap username={username} onSignOut={() => supabase.auth.signOut()} />;
}
