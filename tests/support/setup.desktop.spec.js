// Desktop real-login setup project (auth-desktop). Performs the real desktop
// login once per partner and writes <env>-<partner>-desktop.json, reused by
// Chromium, Firefox and WebKit.
//
// Logic lives in authSetup.js; this file only selects the device.

import { defineAuthSetup } from './authSetup.js';

defineAuthSetup('desktop');