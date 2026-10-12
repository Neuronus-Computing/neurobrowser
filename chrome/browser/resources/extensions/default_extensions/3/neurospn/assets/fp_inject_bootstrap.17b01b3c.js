/**
 * fp_inject_bootstrap.js — NeuroSPN MAIN-world fingerprint injection entry point.
 *
 * Registered as a MAIN-world content script at document_start by the service
 * worker via chrome.scripting.registerContentScripts on connect, and removed
 * via unregisterContentScripts on disconnect.
 *
 * The service worker injects window.__fpProfile__ via tabs.onUpdated so it
 * arrives within ~5–20 ms of navigation start. If it is already present when
 * this script runs we apply immediately; otherwise we poll for up to 100 ms.
 */

(function () {
  'use strict';

  function applyFp(fp) {
    // Remove the transient global so page scripts cannot read our profile.
    delete window.__fpProfile__;

    const nav = fp.fingerprint?.navigator ?? {};
    const scr = fp.fingerprint?.screen ?? {};
    const vc  = fp.fingerprint?.videoCard ?? {};
    const bat = fp.fingerprint?.battery ?? null;
    const ac  = fp.fingerprint?.audioCodecs ?? {};
    const vic = fp.fingerprint?.videoCodecs ?? {};

    // ── navigator scalar overrides ───────────────────────────────────────────
    // overrideInstancePrototype / overrideGetterWithProxy are defined in
    // vendor/apify_fp_utils.js which is loaded before this file.

    const navigatorOverrides = {};
    const NAV_KEYS = [
      'userAgent', 'appVersion', 'platform', 'product', 'productSub',
      'vendor', 'vendorSub', 'appCodeName', 'appName',
      'hardwareConcurrency', 'deviceMemory',
      'language', 'languages',
      'maxTouchPoints', 'doNotTrack',
    ];
    for (const k of NAV_KEYS) {
      if (nav[k] !== undefined && nav[k] !== null) navigatorOverrides[k] = nav[k];
    }
    try { overrideInstancePrototype(window.navigator, navigatorOverrides); } catch (_) {}

    // ── screen overrides ─────────────────────────────────────────────────────
    if (scr.width)       { try { overrideGetterWithProxy(Screen.prototype, 'width',       makeHandler().getterValue(scr.width));       } catch (_) {} }
    if (scr.height)      { try { overrideGetterWithProxy(Screen.prototype, 'height',      makeHandler().getterValue(scr.height));      } catch (_) {} }
    if (scr.availWidth)  { try { overrideGetterWithProxy(Screen.prototype, 'availWidth',  makeHandler().getterValue(scr.availWidth));  } catch (_) {} }
    if (scr.availHeight) { try { overrideGetterWithProxy(Screen.prototype, 'availHeight', makeHandler().getterValue(scr.availHeight)); } catch (_) {} }
    if (scr.colorDepth)  { try { overrideGetterWithProxy(Screen.prototype, 'colorDepth',  makeHandler().getterValue(scr.colorDepth));  } catch (_) {} }
    if (scr.pixelDepth)  { try { overrideGetterWithProxy(Screen.prototype, 'pixelDepth',  makeHandler().getterValue(scr.pixelDepth));  } catch (_) {} }
    if (scr.devicePixelRatio) {
      try { overrideGetterWithProxy(Window.prototype, 'devicePixelRatio', makeHandler().getterValue(scr.devicePixelRatio)); } catch (_) {}
    }
    // Ensure availLeft/Top/isExtended don't reveal secondary monitors.
    try { overrideGetterWithProxy(Screen.prototype, 'availLeft',  makeHandler().getterValue(0));     } catch (_) {}
    try { overrideGetterWithProxy(Screen.prototype, 'availTop',   makeHandler().getterValue(0));     } catch (_) {}
    try { overrideGetterWithProxy(Screen.prototype, 'isExtended', makeHandler().getterValue(false)); } catch (_) {}

    // ── window dimensions ────────────────────────────────────────────────────
    if (scr.outerWidth)  overrideWindowDimensionsProps({ outerWidth:  scr.outerWidth  });
    if (scr.outerHeight) overrideWindowDimensionsProps({ outerHeight: scr.outerHeight });
    if (scr.innerWidth)  overrideWindowDimensionsProps({ innerWidth:  scr.innerWidth  });
    if (scr.innerHeight) overrideWindowDimensionsProps({ innerHeight: scr.innerHeight });

    // ── userAgentData ────────────────────────────────────────────────────────
    if (nav.userAgentData) {
      try { overrideUserAgentData(nav.userAgentData); } catch (_) {}
    }

    // ── WebGL vendor / renderer ──────────────────────────────────────────────
    if (vc.vendor || vc.renderer) {
      try { overrideWebGl({ vendor: vc.vendor ?? '', renderer: vc.renderer ?? '' }); } catch (_) {}
    }

    // ── Battery API ──────────────────────────────────────────────────────────
    if (bat) {
      try { overrideBattery(bat); } catch (_) {}
    }

    // ── Media codecs (canPlayType) ───────────────────────────────────────────
    try { overrideCodecs(ac, vic); } catch (_) {}

    // ── Intl default locale ──────────────────────────────────────────────────
    if (nav.language) {
      try { overrideIntlAPI(nav.language); } catch (_) {}
    }

    // ── Headless / automation fixes ──────────────────────────────────────────
    try { runHeadlessFixes(); } catch (_) {}

    // ── navigator.webdriver ──────────────────────────────────────────────────
    try {
      if ('webdriver' in navigator) {
        overrideGetterWithProxy(Navigator.prototype, 'webdriver', makeHandler().getterValue(false));
      }
    } catch (_) {}

    // ── Canvas 2D noise (deterministic, profile-seeded) ──────────────────────
    // Applies a sub-pixel LSB flip on getImageData/toDataURL/toBlob so the
    // output is consistent across calls (defeating consistency-based "Spoofed"
    // checks) while hiding the real GPU pipeline. Uses overridePropertyWithProxy
    // so .toString() on the replaced functions returns [native code], defeating
    // native-function-check detection.
    try {
      const _cSeed = (((nav.hardwareConcurrency || 4) * 0x9e3779b9) ^ ((scr.width || 1920) * 0x517cc1b7)) >>> 0;
      const _xR = (_cSeed >>> 0) & 1;
      const _xG = (_cSeed >>> 1) & 1;
      const _xB = (_cSeed >>> 2) & 1;

      // Save originals before wrapping to avoid infinite recursion inside the
      // toDataURL/toBlob overrides when we need to read raw pixel data.
      const _origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      const _origToDataURL    = HTMLCanvasElement.prototype.toDataURL;
      const _origToBlob       = HTMLCanvasElement.prototype.toBlob;

      function _xorPixels(imageData) {
        if (!(_xR || _xG || _xB)) return imageData;
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i]     ^= _xR;
          d[i + 1] ^= _xG;
          d[i + 2] ^= _xB;
        }
        return imageData;
      }

      function _noisedCopy(srcCanvas) {
        const tmp = document.createElement('canvas');
        tmp.width  = srcCanvas.width;
        tmp.height = srcCanvas.height;
        const tCtx = tmp.getContext('2d');
        if (!tCtx) return null;
        tCtx.drawImage(srcCanvas, 0, 0);
        const id = Reflect.apply(_origGetImageData, tCtx, [0, 0, tmp.width, tmp.height]);
        _xorPixels(id);
        tCtx.putImageData(id, 0, 0);
        return tmp;
      }

      overridePropertyWithProxy(CanvasRenderingContext2D.prototype, 'getImageData', {
        apply(target, thisArg, args) {
          return _xorPixels(Reflect.apply(target, thisArg, args));
        },
      });

      overridePropertyWithProxy(HTMLCanvasElement.prototype, 'toDataURL', {
        apply(target, thisArg, args) {
          const tmp = _noisedCopy(thisArg);
          return tmp
            ? Reflect.apply(_origToDataURL, tmp, args)
            : Reflect.apply(target, thisArg, args);
        },
      });

      overridePropertyWithProxy(HTMLCanvasElement.prototype, 'toBlob', {
        apply(target, thisArg, args) {
          const tmp = _noisedCopy(thisArg);
          return tmp
            ? Reflect.apply(_origToBlob, tmp, args)
            : Reflect.apply(target, thisArg, args);
        },
      });
    } catch (_) {}

    // ── AudioContext noise (deterministic, profile-seeded) ───────────────────
    // Adds a tiny, fixed delta to audio float arrays so two separate renders
    // always produce identical sums. Replaces Linux ALSA/PulseAudio non-
    // determinism that causes deviceinfo.me's two-render consistency check to
    // flag "Spoofed". Uses overridePropertyWithProxy so .toString() reports
    // [native code].
    try {
      if (typeof AnalyserNode !== 'undefined') {
        const _aSeed = (((nav.hardwareConcurrency || 4) * 0x45d9f3b) ^ ((scr.colorDepth || 24) * 0x1b873593)) >>> 0;
        const _aDelta = ((_aSeed & 0xFFFF) / 0xFFFF) * 1e-8 - 0.5e-8;

        function _audioNoise(arr) {
          for (let i = 0; i < arr.length; i++) arr[i] += _aDelta;
        }

        overridePropertyWithProxy(AnalyserNode.prototype, 'getFloatFrequencyData', {
          apply(target, thisArg, args) {
            Reflect.apply(target, thisArg, args);
            _audioNoise(args[0]);
          },
        });
        overridePropertyWithProxy(AnalyserNode.prototype, 'getFloatTimeDomainData', {
          apply(target, thisArg, args) {
            Reflect.apply(target, thisArg, args);
            _audioNoise(args[0]);
          },
        });
        if (typeof AudioBuffer !== 'undefined') {
          overridePropertyWithProxy(AudioBuffer.prototype, 'getChannelData', {
            apply(target, thisArg, args) {
              const d = Reflect.apply(target, thisArg, args);
              _audioNoise(d);
              return d;
            },
          });
        }
      }
    } catch (_) {}

    console.debug('NeuroSPN: fp_inject_bootstrap applied profile', nav.userAgent?.slice(0, 60));
  }

  // Apply immediately if the SW already injected the profile, otherwise poll
  // for up to 100 ms while the tabs.onUpdated injection arrives (~5–20 ms).
  const immediate = window.__fpProfile__;
  if (immediate) {
    applyFp(immediate);
  } else {
    let ticks = 0;
    const poll = setInterval(() => {
      const pending = window.__fpProfile__;
      if (pending) {
        clearInterval(poll);
        applyFp(pending);
      } else if (++ticks >= 100) {
        clearInterval(poll);
      }
    }, 1);
  }
})();
