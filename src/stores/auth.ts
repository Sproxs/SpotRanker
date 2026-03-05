import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SPOTIFY_CONFIG } from '@/config/spotify';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState
} from '@/utils/pkce';

const STORAGE_KEYS = {
  codeVerifier: 'sp_pkce_verifier',
  oauthState: 'sp_oauth_state',
  accessToken: 'sp_access_token',
  refreshToken: 'sp_refresh_token',
  expiresAt: 'sp_expires_at',
} as const;

export const useAuthStore = defineStore('auth', () => {
  // ---------------------------------------------------------------------------
  // Reactive state
  // ---------------------------------------------------------------------------
  const accessToken = ref<string | null>(localStorage.getItem(STORAGE_KEYS.accessToken));
  const refreshToken = ref<string | null>(localStorage.getItem(STORAGE_KEYS.refreshToken));
  const expiresAt = ref<number>(Number(localStorage.getItem(STORAGE_KEYS.expiresAt)) || 0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------
  const isAuthenticated = computed(() => !!accessToken.value && Date.now() < expiresAt.value);
  const tokenNeedsRefresh = computed(() => !!accessToken.value && Date.now() >= expiresAt.value - 5 * 60 * 1000);

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------
  function persistTokens(access: string, refresh: string | null, expiresIn: number) {
    const expiry = Date.now() + expiresIn * 1000;

    accessToken.value = access;
    refreshToken.value = refresh;
    expiresAt.value = expiry;

    localStorage.setItem(STORAGE_KEYS.accessToken, access);
    if (refresh) localStorage.setItem(STORAGE_KEYS.refreshToken, refresh);
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiry));
  }

  function clearTokens() {
    accessToken.value = null;
    refreshToken.value = null;
    expiresAt.value = 0;
    error.value = null;

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }

  // ---------------------------------------------------------------------------
  // 1. Initiate Login — redirect to Spotify
  // ---------------------------------------------------------------------------
  async function login() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateState();

    // Persist verifier + state so the callback can read them after redirect
    localStorage.setItem(STORAGE_KEYS.codeVerifier, verifier);
    localStorage.setItem(STORAGE_KEYS.oauthState, state);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: SPOTIFY_CONFIG.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      scope: SPOTIFY_CONFIG.scopes.join(' '),
    });

    window.location.href = `${SPOTIFY_CONFIG.authorizeUrl}?${params.toString()}`;
  }

  // ---------------------------------------------------------------------------
  // 2. Handle Callback — exchange code for tokens
  // ---------------------------------------------------------------------------
  async function handleCallback(callbackUrl: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const authError = url.searchParams.get('error');

      // --- Error from Spotify (user denied, etc.) ---
      if (authError) {
        error.value = `Spotify login abgebrochen: ${authError}`;
        return false;
      }

      // --- CSRF check ---
      const storedState = localStorage.getItem(STORAGE_KEYS.oauthState);
      if (!returnedState || returnedState !== storedState) {
        error.value = 'CSRF-Prüfung fehlgeschlagen (state stimmt nicht überein).';
        return false;
      }

      if (!code) {
        error.value = 'Kein Autorisierungscode in der Callback-URL gefunden.';
        return false;
      }

      const storedVerifier = localStorage.getItem(STORAGE_KEYS.codeVerifier);
      if (!storedVerifier) {
        error.value = 'Code-Verifier nicht gefunden. Bitte erneut einloggen.';
        return false;
      }

      // --- Exchange code for tokens ---
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_CONFIG.redirectUri,
        client_id: SPOTIFY_CONFIG.clientId,
        code_verifier: storedVerifier,
      });

      const response = await fetch(SPOTIFY_CONFIG.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        error.value = data.error_description || `Token-Austausch fehlgeschlagen (${response.status}).`;
        return false;
      }

      const data = await response.json();
      persistTokens(data.access_token, data.refresh_token ?? null, data.expires_in);

      // Cleanup PKCE artifacts
      localStorage.removeItem(STORAGE_KEYS.codeVerifier);
      localStorage.removeItem(STORAGE_KEYS.oauthState);

      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unbekannter Fehler beim Token-Austausch.';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Refresh Token
  // ---------------------------------------------------------------------------
  let refreshPromise: Promise<boolean> | null = null;

  async function refreshAccessToken(): Promise<boolean> {
    // Deduplicate concurrent refresh calls
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      if (!refreshToken.value) {
        clearTokens();
        return false;
      }

      try {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken.value,
          client_id: SPOTIFY_CONFIG.clientId,
        });

        const response = await fetch(SPOTIFY_CONFIG.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        if (!response.ok) {
          clearTokens();
          return false;
        }

        const data = await response.json();
        persistTokens(data.access_token, data.refresh_token ?? refreshToken.value, data.expires_in);
        return true;
      } catch {
        clearTokens();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  // ---------------------------------------------------------------------------
  // 4. Get valid access token (auto-refresh if needed)
  // ---------------------------------------------------------------------------
  async function getAccessToken(): Promise<string | null> {
    if (!accessToken.value) return null;

    if (tokenNeedsRefresh.value) {
      const ok = await refreshAccessToken();
      if (!ok) return null;
    }

    return accessToken.value;
  }

  // ---------------------------------------------------------------------------
  // 5. Logout
  // ---------------------------------------------------------------------------
  function logout() {
    clearTokens();
  }

  return {
    // state
    accessToken,
    refreshToken,
    expiresAt,
    isLoading,
    error,
    // computed
    isAuthenticated,
    tokenNeedsRefresh,
    // actions
    login,
    handleCallback,
    refreshAccessToken,
    getAccessToken,
    logout,
  };
});
