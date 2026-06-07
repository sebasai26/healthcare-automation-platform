import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const isDemo = localStorage.getItem("marbellafisio_demo_mode") === "true";
    if (isDemo) {
      const mockUser = {
        id: "demo-user-id",
        email: "invitado@marbellafisio.com",
        role: "authenticated",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: { name: "Invitado" },
        created_at: new Date().toISOString(),
      } as User;
      const mockSession = {
        access_token: "demo-access-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "demo-refresh-token",
        user: mockUser,
      } as Session;
      return {
        user: mockUser,
        session: mockSession,
        isLoading: false,
      };
    }
    return {
      user: null,
      session: null,
      isLoading: true,
    };
  });

  useEffect(() => {
    const isDemo = localStorage.getItem("marbellafisio_demo_mode") === "true";
    if (isDemo) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    console.log('[useAuth] Setting up auth listener');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] Auth state changed:', event, session?.user?.email);
        setAuthState({
          user: session?.user ?? null,
          session,
          isLoading: false,
        });
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[useAuth] Got session:', session?.user?.email);
      setAuthState({
        user: session?.user ?? null,
        session,
        isLoading: false,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (localStorage.getItem("marbellafisio_demo_mode") === "true") {
      localStorage.removeItem("marbellafisio_demo_mode");
      setAuthState({
        user: null,
        session: null,
        isLoading: false,
      });
      window.location.reload();
      return;
    }
    await supabase.auth.signOut();
  };

  return {
    ...authState,
    signOut,
    isAuthenticated: !!authState.session,
  };
}
