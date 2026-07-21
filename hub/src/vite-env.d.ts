/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROSTER_BACKEND_URL?: string;
  readonly VITE_GRADS_BACKEND_URL?: string;
  readonly VITE_PROJECTS_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
