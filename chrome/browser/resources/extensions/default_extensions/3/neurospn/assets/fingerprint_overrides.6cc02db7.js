/**
 * fingerprint_overrides.js — NeuroSPN browser fingerprint override IIFE.
 *
 * Injected into the page's JavaScript context (NOT the content script context)
 * via a dynamically created <script> tag in content_script.js.
 *
 * Reads window.___NEUROVPN_PROFILE___ (set by content_script.js before injection)
 * and overrides 18 browser APIs to match the target device profile.
 * If no profile is present the script exits immediately with no side-effects.
 */
(function () {
  'use strict';

  const profile = window.___NEUROVPN_PROFILE___;
  if (!profile) return;

  /**
   * Defines a non-writable getter on an object property.
   * Silently ignores errors — some properties cannot be overridden in all contexts.
   *
   * @param {object} obj
   * @param {string} prop
   * @param {*} value
   */
  function define(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, {
        get: () => value,
        configurable: true,
        enumerable: true,
      });
    } catch (_) {
      // Silently ignore — some properties can't be overridden in all contexts
    }
  }

  // 1. navigator.userAgent
  define(Navigator.prototype, 'userAgent', profile.userAgent);

  // 2. navigator.platform
  define(Navigator.prototype, 'platform', profile.platform);

  // 3. navigator.hardwareConcurrency
  define(Navigator.prototype, 'hardwareConcurrency', profile.hardwareConcurrency);

  // 4. navigator.deviceMemory
  define(Navigator.prototype, 'deviceMemory', profile.deviceMemory);

  // 5. navigator.vendor
  define(Navigator.prototype, 'vendor', profile.vendor);

  // 6. navigator.vendorSub
  define(Navigator.prototype, 'vendorSub', profile.vendorSub);

  // 7. navigator.appVersion
  define(Navigator.prototype, 'appVersion', profile.appVersion);

  // 8. navigator.language
  define(Navigator.prototype, 'language', profile.language);

  // 9. navigator.languages (frozen array)
  define(Navigator.prototype, 'languages', Object.freeze([...profile.languages]));

  // 10. screen.width
  define(window.screen, 'width', profile.screenWidth);

  // 11. screen.height
  define(window.screen, 'height', profile.screenHeight);

  // 12. screen.availWidth
  define(window.screen, 'availWidth', profile.availWidth);

  // 13. screen.availHeight
  define(window.screen, 'availHeight', profile.availHeight);

  // 14. screen.colorDepth
  define(window.screen, 'colorDepth', profile.colorDepth);

  // 15. screen.pixelDepth
  define(window.screen, 'pixelDepth', profile.pixelDepth);

  // 16. window.devicePixelRatio
  define(window, 'devicePixelRatio', profile.devicePixelRatio);

  // 17. Intl.DateTimeFormat — inject timezone when none specified by the caller
  const OriginalDTF = Intl.DateTimeFormat;
  const PatchedDTF = function (locale, options = {}) {
    if (!options.timeZone) options = { ...options, timeZone: profile.timezone };
    return new OriginalDTF(locale, options);
  };
  // Copy static methods from the original constructor
  Object.getOwnPropertyNames(OriginalDTF).forEach((key) => {
    try {
      PatchedDTF[key] = OriginalDTF[key];
    } catch (_) {}
  });
  PatchedDTF.prototype = OriginalDTF.prototype;
  try {
    Intl.DateTimeFormat = PatchedDTF;
  } catch (_) {}

  // 18. WebRTC IP leak blocking — intercept RTCPeerConnection to suppress
  //     private-IP ICE candidates that would reveal the real local network.
  const OriginalRTC = window.RTCPeerConnection;
  if (OriginalRTC) {
    const PRIVATE_IP_PATTERN =
      /(\b(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b)/;

    window.RTCPeerConnection = function (config) {
      const pc = new OriginalRTC(config);

      const origAddIceCandidate = pc.addIceCandidate.bind(pc);
      pc.addIceCandidate = function (candidate) {
        if (
          candidate &&
          candidate.candidate &&
          PRIVATE_IP_PATTERN.test(candidate.candidate)
        ) {
          return Promise.resolve(); // block private IP candidates
        }
        return origAddIceCandidate(candidate);
      };

      pc.addEventListener(
        'icecandidate',
        function (e) {
          if (
            e.candidate &&
            e.candidate.candidate &&
            PRIVATE_IP_PATTERN.test(e.candidate.candidate)
          ) {
            e.stopImmediatePropagation();
          }
        },
        true,
      );

      return pc;
    };

    // Copy static properties to the wrapper
    Object.assign(window.RTCPeerConnection, OriginalRTC);
  }

  console.debug('NeuroSPN: fingerprint overrides applied');
})();
