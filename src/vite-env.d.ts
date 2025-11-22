/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PATIENT_REGISTRY?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_GAS_STATION_URL?: string;
  readonly REACT_APP_GAS_STATION_URL?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Image module declarations
declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

