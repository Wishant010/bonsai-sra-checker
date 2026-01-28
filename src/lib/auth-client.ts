import { createAuthClient } from 'better-auth/react';
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [
    passkeyClient(),
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  passkey,
} = authClient;

// Passkey helpers for easier use
export const signInWithPasskey = async () => {
  return authClient.signIn.passkey();
};

export const addPasskey = async (name?: string) => {
  return authClient.passkey.addPasskey({ name });
};
