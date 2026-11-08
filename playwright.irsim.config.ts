import {defineConfig} from '@playwright/test';
// IR-SIM specs run only through scripts/test-irsim-e2e.mjs (real worker via lab:irsim): no webServer here, so a missing launcher fails instead of starting Vite.
export default defineConfig({testDir:'tests/e2e',testMatch:'irsim-*.spec.ts',timeout:600000,fullyParallel:false,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:4175',headless:true,launchOptions:{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'},screenshot:'only-on-failure'}});
