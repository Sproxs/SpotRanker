/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

// Injected by the `define` block in vite.config.ts. Never read these directly –
// go through src/config/buildInfo.ts, which guards the Vitest case where no
// define block exists.
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
