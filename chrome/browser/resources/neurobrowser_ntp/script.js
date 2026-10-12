import { sendWithPromise } from 'chrome://resources/js/cr.js';
const NEUROCHAT_BASE_URL = "https://neurochat-7i5p.onrender.com";
(function () {
    "use strict";

    const pad = (n) => String(n).padStart(2, "0");

    function formatTime(d) {
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function formatDateShort(d) {
        const yy = String(d.getFullYear()).slice(-2);
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${yy}`;
    }

    const timeEl = document.querySelector(".time");
    const dateEl = document.querySelector(".date");

    function tickClock() {
        const now = new Date();
        if (timeEl) timeEl.textContent = formatTime(now);
        if (dateEl) dateEl.textContent = formatDateShort(now);
    }

    tickClock();
    setInterval(tickClock, 1000 * 15);

    const ENGINES = {
        duckduckgo: { label: "DuckDuckGo", icon: "./assests/icons/Duck.svg" },
        google: { label: "Google", icon: "./assests/icons/Google.svg" },
        yahoo: { label: "Yahoo", icon: "./assests/icons/Yahoo.svg" },
    };


    let MODELS = {};

    function renderModels() {
        const modelRow = document.getElementById("model-row");
        if (!modelRow) return;
        modelRow.textContent = "";

        Object.keys(MODELS).forEach(modelId => {
            const m = MODELS[modelId];
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = "model-pill glass";
            if (modelId === selectedModel) {
                pill.classList.add("is-active");
                pill.setAttribute("aria-selected", "true");
            } else {
                pill.setAttribute("aria-selected", "false");
            }
            pill.setAttribute("role", "tab");
            pill.setAttribute("data-model", modelId);

            const iconBubble = document.createElement("span");
            iconBubble.className = "model-icon-bubble";
            if (modelId === "axiom") {
                iconBubble.classList.add("model-icon-bubble--wide");
            }

            const img = document.createElement("img");
            img.className = "model-icon";
            img.src = m.icon;
            img.alt = "";

            if (modelId === "all") {
                img.width = 16;
                img.height = 16;
            } else if (modelId === "axiom") {
                img.width = 18;
                img.height = 15;
            } else {
                img.width = 18;
                img.height = 18;
            }

            iconBubble.appendChild(img);

            const labelSpan = document.createElement("span");
            labelSpan.className = "model-label";
            labelSpan.textContent = m.label;

            pill.appendChild(iconBubble);
            pill.appendChild(labelSpan);

            pill.addEventListener("click", () => setModel(modelId));

            modelRow.appendChild(pill);
        });
    }

    function getModelIcon(modelId) {
        if (!modelId) return "./assests/icons/ai.svg";
        const idLower = modelId.toLowerCase();
        if (idLower.includes("grok")) {
            return "./assests/icons/grok.svg";
        } else if (idLower.includes("gpt") || idLower.includes("chatgpt")) {
            return "./assests/icons/chatgpt.svg";
        } else if (idLower.includes("gemini")) {
            return "./assests/icons/gemini.svg";
        } else if (idLower.includes("deepseek")) {
            return "./assests/icons/deepseek.svg";
        } else if (idLower.includes("ernie")) {
            return "./assests/icons/ernie.svg";
        } else if (idLower.includes("claude")) {
            return "./assests/icons/claude.svg";
        } else if (idLower.includes("axiom")) {
            return "./assests/icons/axiom.svg";
        } else {
            return "./assests/icons/ai.svg";
        }
    }

    async function getAvailableModels() {
        try {
            const responseStr = await sendWithPromise('getAvailableModels');
            if (!responseStr) return;
            const json = JSON.parse(responseStr);
            if (json && Array.isArray(json.data)) {
                const modelMap = {};
                json.data.forEach(m => {
                    if (m && m.model) {
                        let iconUrl = getModelIcon(m.model);
                        if (m.image) {
                            iconUrl = `chrome://image/?url=${encodeURIComponent(m.image)}`;
                        }
                        modelMap[m.model] = {
                            label: m.name || m.model,
                            icon: iconUrl,
                            id: m.id
                        };
                    }
                });
                MODELS = modelMap;
                renderModels();

                // Select a model from the list because it is necessary:
                if (!MODELS[selectedModel]) {
                    const modelKeys = Object.keys(MODELS);
                    selectedModel = modelKeys.length > 0 ? modelKeys[0] : "";
                }
                if (selectedModel) {
                    setModel(selectedModel);
                }
            }
        } catch (e) {
            console.error("Failed to load models:", e);
        }
    }

    getAvailableModels();

    const root = document.getElementById("ntp-root");
    const featureCards = document.querySelector(".feature-cards");

    let currentAccessToken = "";
    function applySearchAuthFromToken(token) {
        currentAccessToken = token || "";
        if (!root) return;
        const locked = token == null || token === "";
        if (locked) {
            root.setAttribute("data-auth-search", "locked");
        } else {
            root.removeAttribute("data-auth-search");
        }
    }

    function refreshSearchAuth() {
        sendWithPromise('getAccessToken').then(token => {
            applySearchAuthFromToken(token);
        }).catch(() => {
            applySearchAuthFromToken(undefined);
        });
    }

    refreshSearchAuth();
    setInterval(refreshSearchAuth, 500);
    const featureModelCard = document.getElementById("feature-card-selected-model");
    const modeSegments = document.querySelectorAll(".mode-segment");
    const modeWebBtn = document.getElementById("mode-segment-web");
    const modeAiBtn = document.getElementById("mode-segment-ai");
    const webMagnifier = modeWebBtn && modeWebBtn.querySelector(".mode-web-magnifier");
    const webEngineImg = modeWebBtn && modeWebBtn.querySelector(".mode-web-engine-img");
    const webLabel = modeWebBtn && modeWebBtn.querySelector(".mode-web-label");
    const aiIcon = modeAiBtn && modeAiBtn.querySelector(".mode-ai-icon");
    const aiLabel = modeAiBtn && modeAiBtn.querySelector(".mode-ai-label");

    let uiMode = localStorage.getItem("ntp_ui_mode") || "ai";
    let selectedEngine = localStorage.getItem("ntp_selected_engine") || null;
    let selectedModel = localStorage.getItem("ntp_selected_model") || "all";

    function syncWebToggler() {
        if (!modeWebBtn || !webEngineImg || !webMagnifier || !webLabel) return;
        if (selectedEngine && ENGINES[selectedEngine]) {
            const e = ENGINES[selectedEngine];
            modeWebBtn.classList.add("has-engine");
            webEngineImg.removeAttribute("hidden");
            webEngineImg.src = e.icon;
            webLabel.textContent = e.label;
        } else {
            modeWebBtn.classList.remove("has-engine");
            webEngineImg.setAttribute("hidden", "");
            webLabel.textContent = "Web Search";
        }
    }

    function syncFeatureModelCard() {
        if (!featureModelCard) return;
        const m = MODELS[selectedModel];
        if (!m) return;
        const img = featureModelCard.querySelector(".feature-icon");
        const title = featureModelCard.querySelector(".feature-title");
        const sub = featureModelCard.querySelector(".feature-sub");
        if (img) {
            img.src = m.icon;
            img.alt = "";
        }
        if (title) title.textContent = m.label;
        if (sub) sub.textContent = selectedModel === "all" ? "Sees question only" : "Sees question only";
        featureModelCard.setAttribute("data-selected-model", selectedModel);
    }

    function syncAiToggler() {
        if (!aiIcon || !aiLabel) return;
        const m = MODELS[selectedModel];
        if (!m) return;
        aiIcon.src = m.icon;
        aiLabel.textContent = m.label;
    }

    function setUIMode(mode) {
        uiMode = mode;
        localStorage.setItem("ntp_ui_mode", mode);
        if (root) root.setAttribute("data-ui-mode", mode);
        modeSegments.forEach((btn) => {
            const on = btn.dataset.mode === mode;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (featureCards) {
            if (mode === "web") {
                featureCards.setAttribute("aria-hidden", "true");
            } else {
                featureCards.removeAttribute("aria-hidden");
            }
        }
        if (mode === "ai") {
            syncFeatureModelCard();
        }
        document.dispatchEvent(
            new CustomEvent("ntp:mode-change", {
                detail: { mode: uiMode, engine: selectedEngine, model: selectedModel },
                bubbles: true,
            })
        );
    }

    function setEngine(engine) {
        if (!ENGINES[engine]) return;
        selectedEngine = engine;
        localStorage.setItem("ntp_selected_engine", engine);
        document.querySelectorAll(".engine-pill").forEach((pill) => {
            const on = pill.dataset.engine === engine;
            pill.classList.toggle("is-active", on);
            pill.setAttribute("aria-selected", on ? "true" : "false");
        });
        syncWebToggler();
        document.dispatchEvent(
            new CustomEvent("ntp:engine-change", { detail: { engine: selectedEngine }, bubbles: true })
        );
    }

    function setModel(model) {
        if (!MODELS[model]) return;
        selectedModel = model;
        localStorage.setItem("ntp_selected_model", model);
        document.querySelectorAll("#model-row .model-pill").forEach((pill) => {
            const on = pill.dataset.model === model;
            pill.classList.toggle("is-active", on);
            pill.setAttribute("aria-selected", on ? "true" : "false");
        });
        syncAiToggler();
        syncFeatureModelCard();
        document.dispatchEvent(
            new CustomEvent("ntp:model-change", { detail: { model: selectedModel }, bubbles: true })
        );
    }

    modeSegments.forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            if (mode === uiMode) return;
            setUIMode(mode);
        });
    });

    document.querySelectorAll(".engine-pill").forEach((pill) => {
        pill.addEventListener("click", () => setEngine(pill.dataset.engine));
    });

    renderModels();

    setUIMode(uiMode);
    if (selectedEngine) {
        setEngine(selectedEngine);
    } else {
        syncWebToggler();
    }
    setModel(selectedModel);

    const form = document.getElementById("ntp-search-form");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const input = document.getElementById("ntp-query");
            const q = input && input.value.trim();
            if (!q) {
                input && input.focus();
                return;
            }

            if (uiMode === "web") {
                if (selectedEngine && window.chrome && chrome.send) {
                    chrome.send("setDefaultSearchEngine", [selectedEngine]);
                }
                if (window.chrome && chrome.send) {
                    chrome.send("performSearch", [q]);
                }
            } else if (uiMode === "ai") {
                const locked = root && root.getAttribute("data-auth-search") === "locked";
                if (locked) {
                    return;
                }

                const loadingOverlay = document.getElementById("ai-loading-overlay");
                if (loadingOverlay) {
                    loadingOverlay.classList.remove("hidden");
                }

                const modelId = (MODELS[selectedModel] && MODELS[selectedModel].id) || 4;

                sendWithPromise('sendAiMessage', modelId, q, currentAccessToken).then(responseStr => {
                    let groupId = null;
                    if (responseStr && responseStr.trim() !== "") {
                        try {
                            const ipcResult = JSON.parse(responseStr);
                            if (ipcResult.success && ipcResult.body) {
                                const res = JSON.parse(ipcResult.body);
                                if (res && res.data && res.data.group_id) {
                                    groupId = res.data.group_id;
                                }
                            }
                        } catch (e) {
                            console.error("[NeuroChat] Error parsing response JSON:", e);
                        }
                    } else {
                        console.error("[NeuroChat] Received empty result from IPC channel.");
                    }

                    if (groupId) {
                        const redirectUrl = `https://neurochat-web.onrender.com/chat/${groupId}`;
                        if (window.chrome && chrome.send) {
                            chrome.send("openUrl", [redirectUrl]);
                        } else {
                            window.location.href = redirectUrl;
                        }
                    } else {
                        if (loadingOverlay) loadingOverlay.classList.add("hidden");
                        alert("Failed to create chat session. Please try again.");
                    }
                }).catch(err => {
                    console.error("[NeuroChat] Send message failed:", err);
                    if (loadingOverlay) loadingOverlay.classList.add("hidden");
                    alert("Network error. Please try again.");
                });
            }
        });
    }
})();
