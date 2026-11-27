interface TrustedScriptUrl {
  toString(): string;
}

interface TrustedScriptPolicy {
  createScriptURL(value: string): TrustedScriptUrl;
}

interface TrustedTypesApi {
  createPolicy(
    name: string,
    rules: { createScriptURL(value: string): string }
  ): TrustedScriptPolicy;
}

function isAllowedScriptUrl(url: URL): boolean {
  const isGoogleIdentity = url.origin === 'https://accounts.google.com' &&
    url.pathname === '/gsi/client' &&
    !url.search &&
    !url.hash;
  const isRecaptcha = url.origin === 'https://www.google.com' &&
    url.pathname === '/recaptcha/enterprise.js' &&
    url.searchParams.size === 1 &&
    !!url.searchParams.get('render') &&
    !url.hash;
  return isGoogleIdentity || isRecaptcha;
}

const trustedTypesApi = (globalThis as typeof globalThis & { trustedTypes?: TrustedTypesApi }).trustedTypes;
const externalScriptPolicy = trustedTypesApi?.createPolicy('portfolio-scripts', {
  createScriptURL: (value) => {
    const url = new URL(value);
    if (!isAllowedScriptUrl(url)) {
      throw new TypeError('The requested external script URL is not allowed.');
    }
    return url.href;
  }
});

export function createTrustedScriptUrl(value: string): string | TrustedScriptUrl {
  const url = new URL(value);
  if (!isAllowedScriptUrl(url)) {
    throw new TypeError('The requested external script URL is not allowed.');
  }
  return externalScriptPolicy?.createScriptURL(url.href) ?? url.href;
}

export function setTrustedScriptUrl(script: HTMLScriptElement, value: string): void {
  const trustedUrl = createTrustedScriptUrl(value);
  if (!Reflect.set(script, 'src', trustedUrl)) {
    throw new TypeError('The external script URL could not be assigned.');
  }
}
