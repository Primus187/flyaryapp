import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.flyary.app',
  appName: 'Flyary',
  // Bundles the built web app (dist); the former Lovable live-preview server URL is gone.
  webDir: 'dist',
};

export default config;
