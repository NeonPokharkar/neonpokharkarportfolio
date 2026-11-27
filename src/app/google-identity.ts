import { setTrustedScriptUrl } from './trusted-script-url';

interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: { credential: string; state?: string }) => void }): void;
  renderButton(element: HTMLElement, options: {
    theme: 'outline';
    size: 'large';
    text: 'signin_with';
    state: string;
  }): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } };
  }
}

const googleClientId = '1027876493531-mbun8jrtieocia9n0ns5le4q34332mus.apps.googleusercontent.com';
let loadingIdentity: Promise<GoogleIdentity> | undefined;
let initializedIdentity: GoogleIdentity | undefined;
let nextButtonId = 0;
const credentialHandlers = new Map<string, (credential: string) => void>();

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const existing = window.google?.accounts?.id;
  if (existing) {
    return Promise.resolve(existing);
  }
  if (loadingIdentity) {
    return loadingIdentity;
  }

  const loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    setTrustedScriptUrl(script, 'https://accounts.google.com/gsi/client');
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error('Google Sign-In did not load in time.'));
    }, 15000);
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      const identity = window.google?.accounts?.id;
      if (!identity) {
        script.remove();
        reject(new Error('Google Sign-In is unavailable.'));
        return;
      }
      resolve(identity);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error('Could not load Google Sign-In.'));
    };
    document.head.appendChild(script);
  });
  loadingIdentity = loading;
  void loading.then(
    () => { if (loadingIdentity === loading) loadingIdentity = undefined; },
    () => { if (loadingIdentity === loading) loadingIdentity = undefined; }
  );
  return loading;
}

export function renderGoogleSignInButton(
  identity: GoogleIdentity,
  element: HTMLElement,
  onCredential: (credential: string) => void
): () => void {
  if (initializedIdentity !== identity) {
    identity.initialize({
      client_id: googleClientId,
      callback: (response) => {
        const handler = response.state && credentialHandlers.get(response.state);
        if (handler) {
          handler(response.credential);
        } else {
          console.error('Google Sign-In returned a credential for an unknown or closed button.');
        }
      }
    });
    initializedIdentity = identity;
  }
  const state = `portfolio-signin-${++nextButtonId}`;
  credentialHandlers.set(state, onCredential);
  try {
    identity.renderButton(element, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      state
    });
  } catch (error) {
    credentialHandlers.delete(state);
    throw error;
  }
  return () => { credentialHandlers.delete(state); };
}
