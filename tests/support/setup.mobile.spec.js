// Mobile real-login setup project (auth-mobile). Performs the real mobile login
// once per partner and writes <env>-<partner>-mobile.json, reused by the mobile
// Chromium project. Mobile has a different login DOM, so it cannot reuse the
// desktop storage state.
//
// Logic lives in authSetup.js; this file only selects the device.

import { defineAuthSetup } from './authSetup.js';

defineAuthSetup('mobile');