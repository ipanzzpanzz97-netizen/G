import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.biliktropis.rtxphysics',
  appName: 'Bilik Tropis',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#141710',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
