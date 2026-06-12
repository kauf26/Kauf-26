/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB_OAUTH_ENABLED?: string;
  readonly VITE_DEV_LOGIN_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
