/**
 * Vendored from: https://github.com/apify/fingerprint-suite
 * Package: fingerprint-injector v2.1.82
 * Source: packages/fingerprint-injector/src/utils.js (compiled dist)
 * License: Apache-2.0
 *
 * DO NOT EDIT. Re-vendor by running:
 *   npm pack fingerprint-injector && tar xf fingerprint-injector-*.tgz package/utils.js
 * and replacing this file's body below the header comment.
 *
 * This file is injected into the MAIN world at document_start by fp_inject_bootstrap.js.
 * It reads window.__fpProfile__ (set by the service worker via chrome.scripting.executeScript)
 * and installs ES6 Proxy overrides on navigator, screen, WebGL, AudioContext, Intl, etc.
 * Function.prototype.toString is patched so all overrides report [native code].
 */
"use strict";
/* eslint-disable no-unused-vars */
const isHeadlessChromium = /headless/i.test(navigator.userAgent) && navigator.plugins.length === 0;
const isChrome = navigator.userAgent.includes('Chrome');
const isFirefox = navigator.userAgent.includes('Firefox');
const isSafari = navigator.userAgent.includes('Safari') &&
    !navigator.userAgent.includes('Chrome');
let slim = null;
function getSlim() {
    if (slim === null) {
        slim = window.slim || false;
        if (typeof window.slim !== 'undefined') {
            delete window.slim;
        }
    }
    return slim;
}
// This file contains utils that are build and included on the window object with some randomized prefix.
// some protections can mess with these to prevent the overrides - our script is first so we can reference the old values.
const cache = {
    Reflect: {
        get: Reflect.get.bind(Reflect),
        apply: Reflect.apply.bind(Reflect),
    },
    // Used in `makeNativeString`
    nativeToStringStr: `${Function.toString}`, // => `function toString() { [native code] }`
};
/**
 * @param masterObject Object to override.
 * @param propertyName Property to override.
 * @param proxyHandler Proxy handled with the new value.
 */
function overridePropertyWithProxy(masterObject, propertyName, proxyHandler) {
    const originalObject = masterObject[propertyName];
    const proxy = new Proxy(masterObject[propertyName], stripProxyFromErrors(proxyHandler));
    redefineProperty(masterObject, propertyName, { value: proxy });
    redirectToString(proxy, originalObject);
}
const prototypeProxyHandler = {
    setPrototypeOf: (target, newProto) => {
        try {
            throw new TypeError('Cyclic __proto__ value');
        }
        catch (e) {
            const oldStack = e.stack;
            const oldProto = Object.getPrototypeOf(target);
            Object.setPrototypeOf(target, newProto);
            try {
                // shouldn't throw if prototype is okay, will throw if there is a prototype cycle (maximum call stack size exceeded).
                // eslint-disable-next-line no-unused-expressions
                target.nonexistentpropertytest;
                return true;
            }
            catch (err) {
                Object.setPrototypeOf(target, oldProto);
                if (oldStack.includes('Reflect.setPrototypeOf'))
                    return false;
                const newError = new TypeError('Cyclic __proto__ value');
                const stack = oldStack.split('\n');
                newError.stack = [stack[0], ...stack.slice(2)].join('\n');
                throw newError;
            }
        }
    },
};
function useStrictModeExceptions(prop) {
    if (['caller', 'callee', 'arguments'].includes(prop)) {
        throw TypeError(`'caller', 'callee', and 'arguments' properties may not be accessed on strict mode functions or the arguments objects for calls to them`);
    }
}
/**
 * @param masterObject Object to override.
 * @param propertyName Property to override.
 * @param proxyHandler ES6 Proxy handler object with a get handle only.
 */
function overrideGetterWithProxy(masterObject, propertyName, proxyHandler) {
    const fn = Object.getOwnPropertyDescriptor(masterObject, propertyName).get;
    const fnStr = fn.toString; // special getter function string
    const proxyObj = new Proxy(fn, {
        ...stripProxyFromErrors(proxyHandler),
        ...prototypeProxyHandler,
    });
    redefineProperty(masterObject, propertyName, { get: proxyObj });
    redirectToString(proxyObj, fnStr);
}
/**
 * @param instance Instance to override.
 * @param overrideObj New instance values.
 */
function overrideInstancePrototype(instance, overrideObj) {
    try {
        Object.keys(overrideObj).forEach((key) => {
            if (!(overrideObj[key] === null)) {
                try {
                    overrideGetterWithProxy(Object.getPrototypeOf(instance), key, makeHandler().getterValue(overrideObj[key]));
                }
                catch (e) {
                    console.debug(e);
                }
            }
        });
    }
    catch (e) {
        console.error(e);
    }
}
/**
 * Updates the .toString method in Function.prototype to return a native string representation of the function.
 */
function redirectToString(proxyObj, originalObj) {
    if (getSlim())
        return;
    const handler = {
        setPrototypeOf: (target, newProto) => {
            try {
                throw new TypeError('Cyclic __proto__ value');
            }
            catch (e) {
                if (e.stack.includes('Reflect.setPrototypeOf'))
                    return false;
                throw e;
            }
        },
        apply(target, ctx) {
            if (ctx === Function.prototype.toString) {
                return makeNativeString('toString');
            }
            if (ctx === proxyObj) {
                return makeNativeString(proxyObj.name);
            }
            const hasSameProto = Object.getPrototypeOf(Function.prototype.toString).isPrototypeOf(ctx.toString); // eslint-disable-line no-prototype-builtins
            if (!hasSameProto) {
                return ctx.toString();
            }
            if (Object.getPrototypeOf(ctx) === proxyObj) {
                try {
                    return target.call(ctx);
                }
                catch (err) {
                    err.stack = err.stack.replace('at Object.toString (', 'at Function.toString (');
                    throw err;
                }
            }
            return target.call(ctx);
        },
        get(target, prop, receiver) {
            if (prop === 'toString') {
                return new Proxy(target.toString, {
                    apply(tget, thisArg, argumentsList) {
                        try {
                            return tget.bind(thisArg)(...argumentsList);
                        }
                        catch (err) {
                            if (Object.getPrototypeOf(thisArg) === tget) {
                                err.stack = err.stack.replace('at Object.toString (', 'at Function.toString (');
                            }
                            throw err;
                        }
                    },
                });
            }
            useStrictModeExceptions(prop);
            return Reflect.get(target, prop, receiver);
        },
    };
    const toStringProxy = new Proxy(Function.prototype.toString, stripProxyFromErrors(handler));
    redefineProperty(Function.prototype, 'toString', {
        value: toStringProxy,
    });
}
function makeNativeString(name = '') {
    return cache.nativeToStringStr.replace('toString', name || '');
}
function redefineProperty(masterObject, propertyName, descriptorOverrides = {}) {
    return Object.defineProperty(masterObject, propertyName, {
        ...(Object.getOwnPropertyDescriptor(masterObject, propertyName) || {}),
        ...descriptorOverrides,
    });
}
function stripProxyFromErrors(handler) {
    const newHandler = {};
    const traps = Object.getOwnPropertyNames(handler);
    traps.forEach((trap) => {
        newHandler[trap] = function () {
            try {
                return handler[trap].apply(this, arguments || []); //eslint-disable-line
            }
            catch (err) {
                if (!err || !err.stack || !err.stack.includes(`at `)) {
                    throw err;
                }
                const stripWithBlacklist = (stack, stripFirstLine = true) => {
                    const blacklist = [
                        `at Reflect.${trap} `,
                        `at Object.${trap} `,
                        `at Object.newHandler.<computed> [as ${trap}] `,
                        `at newHandler.<computed> [as ${trap}] `,
                    ];
                    return (err.stack
                        .split('\n')
                        .filter((line, index) => !(index === 1 && stripFirstLine))
                        .filter((line) => !blacklist.some((bl) => line.trim().startsWith(bl)))
                        .join('\n'));
                };
                const stripWithAnchor = (stack, anchor) => {
                    const stackArr = stack.split('\n');
                    anchor =
                        anchor ||
                            `at Object.newHandler.<computed> [as ${trap}] `;
                    const anchorIndex = stackArr.findIndex((line) => line.trim().startsWith(anchor));
                    if (anchorIndex === -1) {
                        return false;
                    }
                    stackArr.splice(1, anchorIndex);
                    return stackArr.join('\n');
                };
                const oldStackLines = err.stack.split('\n');
                Error.captureStackTrace(err);
                const newStackLines = err.stack.split('\n');
                err.stack = [
                    newStackLines[0],
                    oldStackLines[1],
                    ...newStackLines.slice(1),
                ].join('\n');
                if ((err.stack || '').includes('toString (')) {
                    err.stack = stripWithBlacklist(err.stack, false);
                    throw err;
                }
                err.stack =
                    stripWithAnchor(err.stack) || stripWithBlacklist(err.stack);
                throw err;
            }
        };
    });
    return newHandler;
}
function overrideWebGl(webGl) {
    try {
        const getParameterProxyHandler = {
            apply(target, ctx, args) {
                const param = (args || [])[0];
                const result = cache.Reflect.apply(target, ctx, args);
                const debugInfo = ctx.getExtension('WEBGL_debug_renderer_info');
                const UNMASKED_VENDOR_WEBGL = (debugInfo && debugInfo.UNMASKED_VENDOR_WEBGL) || 37445;
                const UNMASKED_RENDERER_WEBGL = (debugInfo && debugInfo.UNMASKED_RENDERER_WEBGL) || 37446;
                if (param === UNMASKED_VENDOR_WEBGL) {
                    return webGl.vendor;
                }
                if (param === UNMASKED_RENDERER_WEBGL) {
                    return webGl.renderer;
                }
                return result;
            },
            get(target, prop, receiver) {
                useStrictModeExceptions(prop);
                return Reflect.get(target, prop, receiver);
            },
        };
        const addProxy = (obj, propName) => {
            overridePropertyWithProxy(obj, propName, getParameterProxyHandler);
        };
        addProxy(WebGLRenderingContext.prototype, 'getParameter');
        addProxy(WebGL2RenderingContext.prototype, 'getParameter');
    }
    catch (err) {
        console.warn(err);
    }
}
const overrideCodecs = (audioCodecs, videoCodecs) => {
    try {
        const codecs = {
            ...Object.fromEntries(Object.entries(audioCodecs).map(([key, value]) => [
                `audio/${key}`,
                value,
            ])),
            ...Object.fromEntries(Object.entries(videoCodecs).map(([key, value]) => [
                `video/${key}`,
                value,
            ])),
        };
        const findCodec = (codecString) => {
            const [mime, codecSpec] = codecString.split(';');
            if (mime === 'video/mp4') {
                if (codecSpec && codecSpec.includes('avc1.42E01E')) {
                    return { name: mime, state: 'probably' };
                }
            }
            const codec = Object.entries(codecs).find(([key]) => key === codecString.split(';')[0]);
            if (codec) {
                return { name: codec[0], state: codec[1] };
            }
            return undefined;
        };
        const canPlayType = {
            apply: function (target, ctx, args) {
                if (!args || !args.length) {
                    return target.apply(ctx, args);
                }
                const [codecString] = args;
                const codec = findCodec(codecString);
                if (codec) {
                    return codec.state;
                }
                return target.apply(ctx, args);
            },
        };
        overridePropertyWithProxy(HTMLMediaElement.prototype, 'canPlayType', canPlayType);
    }
    catch (e) {
        console.warn(e);
    }
};
function overrideBattery(batteryInfo) {
    try {
        const getBattery = {
            ...prototypeProxyHandler,
            apply: async function () {
                return batteryInfo;
            },
        };
        if (navigator.getBattery) {
            overridePropertyWithProxy(Object.getPrototypeOf(navigator), 'getBattery', getBattery);
        }
    }
    catch (e) {
        console.warn(e);
    }
}
function overrideIntlAPI(language) {
    try {
        const innerHandler = {
            construct(Target, [locales, options]) {
                return new Target(locales ?? language, options);
            },
            apply(target, _, [locales, options]) {
                return target(locales ?? language, options);
            },
        };
        overridePropertyWithProxy(window, 'Intl', {
            get(target, key) {
                if (typeof key !== 'string' || key[0].toLowerCase() === key[0])
                    return target[key];
                return new Proxy(target[key], innerHandler);
            },
        });
    }
    catch (e) {
        console.warn(e);
    }
}
function makeHandler() {
    return {
        getterValue: (value) => ({
            apply(target, ctx, args) {
                const ret = cache.Reflect.apply(...arguments); // eslint-disable-line
                if (args && args.length === 0) {
                    return value;
                }
                return ret;
            },
            get(target, prop, receiver) {
                useStrictModeExceptions(prop);
                return Reflect.get(target, prop, receiver);
            },
        }),
    };
}
function overrideScreenByReassigning(target, newProperties) {
    for (const [prop, value] of Object.entries(newProperties)) {
        if (value > 0) {
            target[prop] = value;
        }
    }
}
function overrideWindowDimensionsProps(props) {
    try {
        overrideScreenByReassigning(window, props);
    }
    catch (e) {
        console.warn(e);
    }
}
function overrideDocumentDimensionsProps(props) {
    try {
        // overrideScreenByReassigning(window.document.body, props);
    }
    catch (e) {
        console.warn(e);
    }
}
function replace(target, key, value) {
    if (target?.[key]) {
        target[key] = value;
    }
}
function blockWebRTC() {
    const handler = {
        get: () => {
            return new Proxy(() => { }, handler);
        },
        apply: () => {
            return new Proxy(() => { }, handler);
        },
        construct: () => {
            return new Proxy(() => { }, handler);
        },
    };
    const ConstrProxy = new Proxy(Object, handler);
    const proxy = new Proxy(() => { }, handler);
    replace(navigator.mediaDevices, 'getUserMedia', proxy);
    replace(navigator, 'webkitGetUserMedia', proxy);
    replace(navigator, 'mozGetUserMedia', proxy);
    replace(navigator, 'getUserMedia`', proxy);
    replace(window, 'webkitRTCPeerConnection', proxy);
    replace(window, 'RTCPeerConnection', ConstrProxy);
    replace(window, 'MediaStreamTrack', ConstrProxy);
}
function overrideUserAgentData(userAgentData) {
    try {
        const { brands, mobile, platform, ...highEntropyValues } = userAgentData;
        const getHighEntropyValues = {
            apply: async function (target, ctx, args) {
                const stripErrorStack = (stack) => stack
                    .split('\n')
                    .filter((line) => !line.includes('at Object.apply'))
                    .filter((line) => !line.includes('at Object.get'))
                    .join('\n');
                try {
                    if (!args || !args.length) {
                        return target.apply(ctx, args);
                    }
                    const [hints] = args;
                    await target.apply(ctx, args);
                    const data = { brands, mobile, platform };
                    hints.forEach((hint) => {
                        data[hint] = highEntropyValues[hint];
                    });
                    return data;
                }
                catch (err) {
                    err.stack = stripErrorStack(err.stack);
                    throw err;
                }
            },
        };
        if (window.navigator.userAgentData) {
            overridePropertyWithProxy(Object.getPrototypeOf(window.navigator.userAgentData), 'getHighEntropyValues', getHighEntropyValues);
            overrideInstancePrototype(window.navigator.userAgentData, {
                brands,
                mobile,
                platform,
            });
        }
    }
    catch (e) {
        console.warn(e);
    }
}
function fixWindowChrome() {
    if (isChrome && !window.chrome) {
        Object.defineProperty(window, 'chrome', {
            writable: true,
            enumerable: true,
            configurable: false,
            value: {},
        });
    }
}
function fixPermissions() {
    const isSecure = document.location.protocol.startsWith('https');
    if (isSecure) {
        overrideGetterWithProxy(Notification, 'permission', {
            apply() {
                return 'default';
            },
        });
    }
    if (!isSecure) {
        const handler = {
            apply(target, ctx, args) {
                const param = (args || [])[0];
                const isNotifications = param && param.name && param.name === 'notifications';
                if (!isNotifications) {
                    return cache.Reflect.apply(target, ctx, args);
                }
                return Promise.resolve(Object.setPrototypeOf({
                    state: 'denied',
                    onchange: null,
                }, PermissionStatus.prototype));
            },
        };
        overridePropertyWithProxy(Permissions.prototype, 'query', handler);
    }
}
function fixIframeContentWindow() {
    try {
        const addContentWindowProxy = (iframe) => {
            const contentWindowProxy = {
                get(target, key) {
                    if (key === 'self') {
                        return this;
                    }
                    if (key === 'frameElement') {
                        return iframe;
                    }
                    if (key === '0') {
                        return undefined;
                    }
                    return Reflect.get(target, key);
                },
            };
            if (!iframe.contentWindow) {
                const proxy = new Proxy(window, contentWindowProxy);
                Object.defineProperty(iframe, 'contentWindow', {
                    get() {
                        return proxy;
                    },
                    set(newValue) { },
                    enumerable: true,
                    configurable: false,
                });
            }
        };
        const handleIframeCreation = (target, thisArg, args) => {
            const iframe = target.apply(thisArg, args);
            const _iframe = iframe;
            const _srcdoc = _iframe.srcdoc;
            Object.defineProperty(iframe, 'srcdoc', {
                configurable: true,
                get() {
                    return _srcdoc;
                },
                set(newValue) {
                    addContentWindowProxy(this);
                    Object.defineProperty(iframe, 'srcdoc', {
                        configurable: false,
                        writable: false,
                        value: _srcdoc,
                    });
                    _iframe.srcdoc = newValue;
                },
            });
            return iframe;
        };
        const addIframeCreationSniffer = () => {
            const createElementHandler = {
                get(target, key) {
                    return Reflect.get(target, key);
                },
                apply(target, thisArg, args) {
                    if (`${args[0]}`.toLowerCase() === 'iframe') {
                        return handleIframeCreation(target, thisArg, args);
                    }
                    return target.apply(thisArg, args);
                },
            };
            overridePropertyWithProxy(document, 'createElement', createElementHandler);
        };
        addIframeCreationSniffer();
    }
    catch (err) {
        // suppressed
    }
}
function fixPluginArray() {
    if (window.navigator.plugins.length !== 0) {
        return;
    }
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const ChromiumPDFPlugin = Object.create(Plugin.prototype, {
                description: {
                    value: 'Portable Document Format',
                    enumerable: false,
                },
                filename: { value: 'internal-pdf-viewer', enumerable: false },
                name: { value: 'Chromium PDF Plugin', enumerable: false },
            });
            return Object.create(PluginArray.prototype, {
                length: { value: 1 },
                0: { value: ChromiumPDFPlugin },
            });
        },
    });
}
function runHeadlessFixes() {
    try {
        if (isHeadlessChromium) {
            fixWindowChrome();
            fixPermissions();
            fixIframeContentWindow();
            fixPluginArray();
        }
    }
    catch (e) {
        console.error(e);
    }
}
function overrideStatic() {
    try {
        window.SharedArrayBuffer = undefined;
    }
    catch (e) {
        console.error(e);
    }
}
