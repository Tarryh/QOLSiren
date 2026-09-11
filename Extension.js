// ==UserScript==
// @name         Siren
// @namespace    atsu-tools-combined
// @version      1
// @description  A Extension to Better the Atsumaru Experience
// @match        https://atsu.moe/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // ============================================================
    //  SPREAD FIXER STATE
    // ============================================================
    let offset = parseInt(localStorage.getItem("atsu_offset") || "0");
    let enabled = localStorage.getItem("atsu_enabled") === "true";

    // ============================================================
    //  IMPORT CONFIG
    // ============================================================
    const DEBUG = false;
    const SEARCH_LIMIT = 12;
    const MAX_TITLE_TRIES = 15;
    const BOOKMARK_CHUNK_SIZE = 4;
    const PROGRESS_ENDPOINT = "/api/read/syncProgress";
    const DONT_DOWNGRADE_PROGRESS = true;
    const MARK_PREVIOUS_CHAPTERS = true;
    const PREVIOUS_CHAPTER_WINDOW = 0;
    const MAX_PROGRESS_ITEMS_TOTAL = 100000000000;
    const MAX_PROGRESS_ITEMS_PER_MANGA = 30000;

    const STATUS_MAP = {
        "Reading": "Reading",
        "Completed": "Completed",
        "Dropped": "Dropped",
        "Plan to Read": "PlanToRead",
        "Planned": "PlanToRead",
        "On-Hold": "OnHold",
        "Paused": "OnHold",
        "Re-Reading": "ReReading",
        "Rereading": "ReReading",
    };

    // ============================================================
    //  MISC STATE
    // ============================================================
    let autoReading     = localStorage.getItem("atsu_auto_reading") === "true";
    let markBelowActive = localStorage.getItem("atsu_mark_below") === "true";
    let quickAddList    = localStorage.getItem("atsu_quick_add_list") === "true";

    // ============================================================
    //  SHARED UI PANEL
    // ============================================================
    const panel = document.createElement("div");
    panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(14, 14, 18, 0.96);
        backdrop-filter: blur(14px);
        color: #e8e8f0;
        border-radius: 14px;
        z-index: 999999;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        width: 340px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07);
        cursor: move;
        overflow: hidden;
    `;

    panel.innerHTML = `
        <div id="at-header" style="
            padding: 10px 14px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.02em;">&#9881; Siren</span>
            <button id="at-minimize" title="Minimize" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                line-height: 1;
                padding: 0 2px;
            ">&#8722;</button>
        </div>

        <!-- TAB BAR -->
        <div id="at-tabbar" style="display: flex; gap: 0; padding: 10px 14px 0;">
            <button id="tab-spread" class="at-tab at-tab-active" style="flex:1; border-radius: 8px 0 0 8px;">Spread Fix</button>
            <button id="tab-import" class="at-tab" style="flex:1; border-radius: 0; border-left: none; border-right: none;">Import CSV</button>
            <button id="tab-misc"   class="at-tab" style="flex:1; border-radius: 0; border-left: none; border-right: none;">Misc</button>
            <button id="tab-offline" class="at-tab" style="flex:1; border-radius: 0 8px 8px 0;">Offline</button>
        </div>

        <!-- SPREAD FIX PANE -->
        <div id="pane-spread" class="at-pane" style="padding: 12px 14px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="opacity:0.6; font-size:12px;">Double-page spread offset fix</span>
                <button id="sf-toggle" style="
                    padding: 4px 14px;
                    border-radius: 20px;
                    font-weight: 700;
                    font-size: 12px;
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s;
                ">OFF</button>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center;">
                <span style="opacity:0.6; font-size:12px; flex:1;">Offset</span>
                <button id="sf-minus" class="at-btn-sm">&#8722;</button>
                <span id="sf-offset" style="min-width:28px; text-align:center; font-weight:700; font-size:14px;">0</span>
                <button id="sf-plus" class="at-btn-sm">+</button>
            </div>
            <button id="sf-reset" style="
                width: 100%;
                padding: 7px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.05);
                color: #ccc;
                cursor: pointer;
                font-size: 12px;
            ">Reset offset to 0</button>
        </div>

        <!-- IMPORT PANE -->
        <div id="pane-import" class="at-pane" style="padding: 12px 14px 14px; display:none;">
            <div style="opacity:0.6; font-size:11px; margin-bottom:8px;">Import Comick CSV &#8594; Bookmarks + Continue reading</div>
            <div id="ai-eta" style="font-size:11px; opacity:0.55; margin-bottom:8px;">ETA: &#8212;</div>

            <input id="ai-file" type="file" accept=".csv" style="
                width: 100%;
                margin-bottom: 10px;
                font-size: 12px;
                color: #ccc;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 6px;
                padding: 5px 6px;
                box-sizing: border-box;
            " />

            <label class="at-check-row">
                <input id="ai-progress" type="checkbox" checked />
                <span>Import Continue reading</span>
            </label>
            <label class="at-check-row">
                <input id="ai-nodown" type="checkbox" checked />
                <span>Don't overwrite higher Atsu progress</span>
            </label>
            <label class="at-check-row" style="margin-bottom:10px;">
                <input id="ai-prev" type="checkbox" ${MARK_PREVIOUS_CHAPTERS ? "checked" : ""} />
                <span>Mark previous chapters completed</span>
            </label>

            <button id="ai-run" style="
                width: 100%;
                padding: 8px;
                border-radius: 8px;
                border: none;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: #fff;
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                margin-bottom: 10px;
            ">Start Import</button>

            <div id="ai-log" style="
                white-space: pre-wrap;
                max-height: 200px;
                overflow-y: auto;
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.07);
                padding: 8px;
                border-radius: 8px;
                font-size: 11px;
                line-height: 1.5;
                color: #b0b0c0;
            "></div>
        </div>

        <!-- MISC PANE -->
        <div id="pane-misc" class="at-pane" style="padding: 12px 14px 14px; display:none;">

            <!-- Auto Reading toggle -->
            <div class="at-misc-row">
                <div>
                    <div class="at-misc-title">Set to Reading Automatically</div>
                    <div class="at-misc-desc">Marks a comic as Reading<br>whenever you read a chapter</div>
                </div>
                <button id="misc-auto-reading-toggle" class="at-toggle-btn">OFF</button>
            </div>
            <div id="misc-auto-reading-log" class="at-misc-log"></div>

            <!-- Mark Below Read toggle -->
            <div class="at-misc-row" style="margin-top: 8px;">
                <div>
                    <div class="at-misc-title">Mark Chapters Button</div>
                    <div class="at-misc-desc">Adds a button to mark<br>multiple chapters at once</div>
                </div>
                <button id="misc-mark-below-toggle" class="at-toggle-btn">OFF</button>
            </div>
            <div id="misc-mark-below-log" class="at-misc-log"></div>

            <!-- Quick Add to List toggle -->
            <div class="at-misc-row" style="margin-top: 8px;">
                <div>
                    <div class="at-misc-title">Enable Quick Add to List</div>
                    <div class="at-misc-desc">Add a comic from bookmarks<br>to your list</div>
                </div>
                <button id="misc-quick-add-toggle" class="at-toggle-btn">OFF</button>
            </div>
            <div id="misc-quick-add-log" class="at-misc-log"></div>

            <!-- Siren Bot promo -->
            <div style="margin-top: 12px; padding: 10px 12px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.18); border-radius: 10px;">
                <div style="font-size: 11px; color: #a5b4fc; font-weight: 600; margin-bottom: 4px;">&#129302; Atsumaru Discord Bot</div>
                <div style="font-size: 11px; color: #888; line-height: 1.5;">Need a Atsumaru based discord bot? Siren has one with features ranging from Chapter Notifier, Search Functions, Profile Analysis, Rep Analysis &amp; more.</div>
                <a href="https://discord.com/oauth2/authorize?client_id=1461903946212704379" target="_blank" rel="noopener" style="display: inline-block; margin-top: 6px; font-size: 11px; color: #818cf8; text-decoration: underline; cursor: pointer;">Invite Siren Bot</a>
            </div>

        </div>

        <!-- OFFLINE PANE -->
        <div id="pane-offline" class="at-pane" style="padding: 12px 14px 14px; display:none;">
            <div style="opacity:0.6; font-size:11px; margin-bottom:8px;">Download chapters for offline reading</div>

            <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
                <span style="font-size:11px; color:#888;">Ch.</span>
                <input id="offline-from" type="number" min="1" value="1" style="
                    width:55px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
                    border-radius:6px; color:#e0e0f0; padding:4px 6px; font-size:12px; text-align:center;
                " />
                <span style="font-size:11px; color:#888;">to</span>
                <input id="offline-to" type="number" min="1" value="10" style="
                    width:55px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
                    border-radius:6px; color:#e0e0f0; padding:4px 6px; font-size:12px; text-align:center;
                " />
            </div>
            <button id="offline-batch-dl" style="
                width: 100%;
                padding: 8px;
                border-radius: 8px;
                border: none;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: #fff;
                font-weight: 700;
                font-size: 13px;
                cursor: pointer;
                margin-bottom: 8px;
            ">Download Chapters</button>

            <div style="margin-bottom:6px;">
                <label style="font-size:11px; color:#888;">Scanlator:</label>
                <select id="offline-scanlation" style="
                    width:100%; margin-top:2px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
                    border-radius:6px; color:#e0e0f0; padding:4px 6px; font-size:11px;
                ">
                    <option value="">Auto (best available)</option>
                </select>
            </div>

            <div id="offline-log" style="font-size:11px; color:#888; min-height:14px; margin-bottom:10px;"></div>

            <div style="font-size:12px; font-weight:600; color:#e0e0f0; margin-bottom:6px;">Downloaded Chapters</div>
            <div id="offline-list" style="
                max-height: 200px;
                overflow-y: auto;
            "></div>
            <div id="offline-storage" style="font-size:10px; color:#666; margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);"></div>
        </div>

        <style>
            .at-tab {
                padding: 6px 0;
                border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.04);
                color: #999;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: background 0.15s, color 0.15s;
            }
            .at-tab:hover { background: rgba(255,255,255,0.09); color: #ddd; }
            .at-tab-active {
                background: rgba(99,102,241,0.25) !important;
                color: #a5b4fc !important;
                border-color: rgba(99,102,241,0.4) !important;
            }
            .at-btn-sm {
                width: 30px; height: 30px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(255,255,255,0.07);
                color: #e0e0f0;
                font-size: 18px;
                cursor: pointer;
                line-height: 1;
                transition: background 0.15s;
            }
            .at-btn-sm:hover { background: rgba(255,255,255,0.14); }
            .at-check-row {
                display: flex;
                gap: 8px;
                align-items: center;
                margin-bottom: 6px;
                font-size: 12px;
                color: #ccc;
                cursor: pointer;
            }
            .at-check-row input { accent-color: #6366f1; }
            .at-misc-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
            }
            .at-misc-title {
                font-size: 12px;
                font-weight: 600;
                color: #e0e0f0;
                margin-bottom: 3px;
            }
            .at-misc-desc {
                font-size: 11px;
                color: #888;
                line-height: 1.45;
            }
            .at-toggle-btn {
                padding: 5px 16px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 12px;
                border: none;
                cursor: pointer;
                transition: background 0.2s, color 0.2s;
                min-width: 48px;
                flex-shrink: 0;
                margin-left: 10px;
                background: #333;
                color: #999;
            }
            .at-misc-log {
                font-size: 11px;
                color: #777;
                line-height: 1.5;
                min-height: 14px;
                padding: 2px 2px 0;
            }

            /* Injected "Mark all below highest read" button */
            .atsu-mark-below-btn {
                display: block;
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
                background-color: var(--color-slate2, #282828);
                color: var(--color-foreground, #b8bcc0);
                border: 1px solid #424141;
                border-radius: var(--radius-md, 8px);
                font-family: var(--font-sans, "Geist", system-ui);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                padding: 8px 12px;
                margin-bottom: 8px;
                transition: background 0.15s, color 0.15s;
            }
            .atsu-mark-below-btn:hover:not(:disabled) {
                background-color: var(--color-slate3, #313234);
                color: var(--color-foreground2, #f9f8f6);
            }
            .atsu-mark-below-btn.atsu-confirm {
                background-color: oklch(57.7% .245 27.325);
                color: #fff;
                border-color: oklch(44.4% .177 26.899);
            }
            .atsu-mark-below-btn.atsu-confirm:hover {
                background-color: oklch(63.7% .237 25.331);
            }
            .atsu-mark-below-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            /* Quick Add to List button injected on bookmarks */
            .atsu-add-list-btn {
                background: rgba(99,102,241,0.15);
                color: #a5b4fc;
                border: 1px solid rgba(99,102,241,0.3);
                border-radius: 6px;
                font-size: 12.5px;
                font-weight: 600;
                cursor: pointer;
                padding: 5px 14px;
                white-space: nowrap;
                transition: background 0.15s, color 0.15s;
                margin-left: 12px;
            }
            .atsu-add-list-btn:hover {
                background: rgba(99,102,241,0.3);
                color: #c7d2fe;
            }
            .atsu-add-list-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .atsu-add-list-btn.atsu-added {
                background: rgba(74,222,128,0.15);
                color: #4ade80;
                border-color: rgba(74,222,128,0.3);
                cursor: default;
            }
            .atsu-list-dropdown {
                position: absolute;
                z-index: 999999;
                background: rgba(14, 14, 18, 0.97);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 8px;
                padding: 6px 0;
                min-width: 180px;
                max-height: 240px;
                overflow-y: auto;
                box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            }
            .atsu-list-dropdown-item {
                display: block;
                width: 100%;
                padding: 7px 14px;
                background: none;
                border: none;
                color: #ccc;
                font-size: 12px;
                text-align: left;
                cursor: pointer;
                transition: background 0.1s;
            }
            .atsu-list-dropdown-item:hover {
                background: rgba(99,102,241,0.2);
                color: #e0e0f0;
            }

            /* Offline reader styles */
            .atsu-offline-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 10px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px;
                margin-bottom: 4px;
            }
            .atsu-offline-read-btn, .atsu-offline-del-btn {
                background: none;
                border: 1px solid rgba(255,255,255,0.12);
                color: #ccc;
                border-radius: 6px;
                width: 28px; height: 28px;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: background 0.15s;
            }
            .atsu-offline-read-btn:hover { background: rgba(99,102,241,0.3); color: #a5b4fc; }
            .atsu-offline-del-btn:hover { background: rgba(239,68,68,0.3); color: #f87171; }
        </style>
    `;

    document.body.appendChild(panel);

    // ============================================================
    //  MINIMIZE
    // ============================================================
    let minimized = false;
    const minimizeBtn = panel.querySelector("#at-minimize");
    const tabBar = panel.querySelector("#at-tabbar");

    minimizeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        minimized = !minimized;
        tabBar.style.display = minimized ? "none" : "flex";
        panel.querySelectorAll(".at-pane").forEach(p => p.style.display = "none");
        if (!minimized) showPane(activeTab);
        minimizeBtn.innerHTML = minimized ? "+" : "&#8722;";
        panel.querySelector("#at-header").style.paddingBottom = minimized ? "10px" : "0";
    });

    // ============================================================
    //  TABS
    // ============================================================
    let activeTab = localStorage.getItem("atsu_active_tab") || "spread";

    const tabDefs = [
        { id: "tab-spread",  pane: "pane-spread",  key: "spread"  },
        { id: "tab-import",  pane: "pane-import",  key: "import"  },
        { id: "tab-misc",    pane: "pane-misc",    key: "misc"    },
        { id: "tab-offline", pane: "pane-offline", key: "offline" },
    ];

    function showPane(key) {
        tabDefs.forEach(({ id, pane, key: k }) => {
            panel.querySelector("#" + pane).style.display = k === key ? "block" : "none";
            panel.querySelector("#" + id).classList.toggle("at-tab-active", k === key);
        });
        activeTab = key;
        localStorage.setItem("atsu_active_tab", key);
    }

    tabDefs.forEach(({ id, key }) => {
        panel.querySelector("#" + id).addEventListener("click", () => showPane(key));
    });

    // Restore saved tab
    showPane(activeTab);

    // ============================================================
    //  DRAGGING
    // ============================================================
    let isDragging = false, dragX, dragY;
    panel.querySelector("#at-header").addEventListener("mousedown", e => {
        isDragging = true;
        dragX = e.clientX - panel.offsetLeft;
        dragY = e.clientY - panel.offsetTop;
    });
    document.addEventListener("mousemove", e => {
        if (!isDragging) return;
        panel.style.left   = (e.clientX - dragX) + "px";
        panel.style.top    = (e.clientY - dragY) + "px";
        panel.style.bottom = "auto";
        panel.style.right  = "auto";
    });
    document.addEventListener("mouseup", () => isDragging = false);

    // ============================================================
    //  SPREAD FIXER LOGIC
    // ============================================================
    const sfToggle      = panel.querySelector("#sf-toggle");
    const sfMinus       = panel.querySelector("#sf-minus");
    const sfPlus        = panel.querySelector("#sf-plus");
    const sfReset       = panel.querySelector("#sf-reset");
    const sfOffsetLabel = panel.querySelector("#sf-offset");

    function updateSpreadUI() {
        sfToggle.textContent = enabled ? "ON" : "OFF";
        sfToggle.style.background = enabled ? "#4ade80" : "#333";
        sfToggle.style.color = enabled ? "#000" : "#999";
        sfOffsetLabel.textContent = offset;
    }

    function saveSpread() {
        localStorage.setItem("atsu_offset", offset);
        localStorage.setItem("atsu_enabled", enabled);
    }

    sfToggle.addEventListener("click", () => { enabled = !enabled; saveSpread(); updateSpreadUI(); applyFix(); });
    sfMinus.addEventListener("click",  () => { offset--; saveSpread(); updateSpreadUI(); applyFix(); });
    sfPlus.addEventListener("click",   () => { offset++; saveSpread(); updateSpreadUI(); applyFix(); });
    sfReset.addEventListener("click",  () => { offset = 0; saveSpread(); updateSpreadUI(); applyFix(); });

    updateSpreadUI();

    function applyFix() {
        if (!enabled || offset === 0) return;
        const imgs = [...document.querySelectorAll("img")].filter(img => img.src.includes("/static/pages/"));
        if (!imgs.length) return;
        imgs.forEach(img => { if (!img.dataset.atsuOrigSrc) img.dataset.atsuOrigSrc = img.src; });
        const available = new Set();
        imgs.forEach(img => {
            const m = img.dataset.atsuOrigSrc.match(/(\d+)(\.\w+)$/);
            if (m) available.add(parseInt(m[1], 10));
        });
        if (!available.size) return;
        const minPage = Math.min(...available), maxPage = Math.max(...available);
        imgs.forEach(img => {
            const src = img.dataset.atsuOrigSrc;
            const m = src.match(/(\d+)(\.\w+)$/);
            if (!m) return;
            const target = parseInt(m[1], 10) + offset;
            if (target < minPage || target > maxPage || !available.has(target)) { img.src = src; return; }
            const parts = src.split("/"); parts.pop(); parts.push(target + m[2]);
            img.src = parts.join("/");
        });
    }

    const spreadObserver = new MutationObserver(() => {
        if (!enabled) return;
        clearTimeout(window._atsuFixTimer);
        window._atsuFixTimer = setTimeout(applyFix, 500);
    });
    spreadObserver.observe(document.body, { childList: true, subtree: true });

    // ============================================================
    //  Save original fetch BEFORE any patching
    // ============================================================
    const _origFetch = window.fetch.bind(window);

    // ============================================================
    //  MISC — AUTO SET TO READING
    // ============================================================
    const autoReadingBtn = panel.querySelector("#misc-auto-reading-toggle");
    const autoReadingLog = panel.querySelector("#misc-auto-reading-log");

    function updateAutoReadingUI() {
        autoReadingBtn.textContent = autoReading ? "ON" : "OFF";
        autoReadingBtn.style.background = autoReading ? "#4ade80" : "#333";
        autoReadingBtn.style.color = autoReading ? "#000" : "#999";
    }

    autoReadingBtn.addEventListener("click", () => {
        autoReading = !autoReading;
        localStorage.setItem("atsu_auto_reading", autoReading);
        updateAutoReadingUI();
        autoReadingLog.textContent = autoReading ? "Active — watching for reads..." : "";
    });

    updateAutoReadingUI();
    if (autoReading) autoReadingLog.textContent = "Active — watching for reads...";

    const alreadyMarkedReading = new Set();

    async function markAsReading(mangaId, mangaType) {
        if (alreadyMarkedReading.has(mangaId)) return;
        alreadyMarkedReading.add(mangaId);
        const payload = [{
            mangaId,
            status: "Reading",
            type: mangaType || "Manga",
            synced: false,
            ts: Date.now(),
        }];
        try {
            const res = await _origFetch("/api/user/syncBookmarks", {
                method: "POST", credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                autoReadingLog.textContent = `Set to Reading: ${mangaId}`;
            } else {
                autoReadingLog.textContent = `Failed (${res.status}) for ${mangaId}`;
                alreadyMarkedReading.delete(mangaId);
            }
        } catch (e) {
            autoReadingLog.textContent = `Error: ${e.message}`;
            alreadyMarkedReading.delete(mangaId);
        }
    }

    // Intercept fetch — watch for syncProgress (auto-reading)
    window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : (input?.url || "");
        if (autoReading && url.includes(PROGRESS_ENDPOINT) && (init?.method || "GET").toUpperCase() === "POST") {
            try {
                const body = JSON.parse(init.body || "{}");
                const progressItems = Array.isArray(body.progress) ? body.progress : [];
                const seen = new Map();
                for (const item of progressItems) {
                    if (item.mangaId && !seen.has(item.mangaId))
                        seen.set(item.mangaId, item.strip ? "Manhwa" : "Manga");
                }
                for (const [mangaId, mangaType] of seen) markAsReading(mangaId, mangaType);
            } catch (_) {}
        }
        return _origFetch(input, init);
    };

    // ============================================================
    //  MISC — MARK ALL BELOW AS READ
    // ============================================================
    const markBelowBtn = panel.querySelector("#misc-mark-below-toggle");
    const markBelowLog = panel.querySelector("#misc-mark-below-log");

    function updateMarkBelowUI() {
        markBelowBtn.textContent = markBelowActive ? "ON" : "OFF";
        markBelowBtn.style.background = markBelowActive ? "#4ade80" : "#333";
        markBelowBtn.style.color = markBelowActive ? "#000" : "#999";
    }

    markBelowBtn.addEventListener("click", () => {
        markBelowActive = !markBelowActive;
        localStorage.setItem("atsu_mark_below", markBelowActive);
        updateMarkBelowUI();
        if (markBelowActive) {
            injectMarkBelowButton();
            markBelowLog.textContent = "Active";
        } else {
            removeMarkBelowButton();
            markBelowLog.textContent = "";
        }
    });

    updateMarkBelowUI();

    // -------------------------------------------------------
    //  Helpers
    // -------------------------------------------------------

    // ✅ NEW: URL guard — only inject on manga/comic detail pages
    function isOnMangaPage() {
        return /\/(manga|comic|title)\/[^/]+/.test(window.location.pathname);
    }

    function getCurrentMangaInfo() {
        const mp = window.mangaPage?.mangaPage;
        if (mp?.id) return { mangaId: mp.id, title: mp.title || "Unknown", type: mp.type || "Manga", chapters: mp.chapters || [], total: mp.totalChapterCount || 0, unresolvedId: false };
        return null;
    }

    function getPathBasedMangaInfo() {
        const path = window.location.pathname;
        const mangaMatch = path.match(/\/(manga|comic|title)\/([^/?#]+)/);
        const mangaSlug = mangaMatch?.[2];
        if (!mangaSlug) return null;

        const titleGuess = document.title.split(/[|\-\u2013\u2014]/)[0].trim() || mangaSlug.replace(/[-_]+/g, " ");
        return {
            mangaId: mangaSlug,
            title: titleGuess,
            type: "Manga",
            chapters: [],
            total: 0,
            unresolvedId: true,
        };
    }

    async function resolveCurrentMangaInfo() {
        const direct = getCurrentMangaInfo();
        if (direct) return direct;

        const pathInfo = getPathBasedMangaInfo();
        if (!pathInfo) return null;

        // Mobile userscript sandboxes often cannot access window.mangaPage.
        // Fall back to search so we can recover a real manga ID from the slug/title.
        try {
            const slugWords = pathInfo.mangaId.replace(/[-_]+/g, " ").trim();
            const titleGuess = (pathInfo.title || "").trim();
            const queries = [...new Set([titleGuess, slugWords].filter(Boolean))];

            for (const q of queries) {
                const items = await atsuSearch(q);
                if (!items.length) continue;
                const best = pickBestMatch(items, titleGuess || slugWords, [slugWords, titleGuess].filter(Boolean));
                if (best?.id) {
                    return {
                        mangaId: best.id,
                        title: best.title || best.englishTitle || pathInfo.title,
                        type: best.type || "Manga",
                        chapters: [],
                        total: 0,
                        unresolvedId: false,
                    };
                }
            }
        } catch (_) {}

        return pathInfo;
    }

    // Find the highest chapter number that has progress (i.e. has been read)
    function getHighestReadChapterNumber(info) {
        // First, check if there's a continueReading field with the last read chapter
        const mp = window.mangaPage?.mangaPage;
        if (mp?.continueReading?.number) {
            const highestFromContinue = Number(mp.continueReading.number);
            if (Number.isFinite(highestFromContinue)) {
                console.log("[atsu] ✓ found highest read via continueReading:", highestFromContinue);
                return highestFromContinue;
            }
        }

        // Fallback: try progress field (for older data structures)
        let highest = -1;
        for (const c of info.chapters) {
            if (c.progress != null) {
                const n = Number(c.number);
                if (n > highest) highest = n;
            }
        }
        if (highest >= 0) {
            console.log("[atsu] ✓ found highest read via progress field:", highest);
            return highest;
        }

        // If still not found, log detailed debug info
        console.log("[atsu] ✗ could not find read progress via continueReading or progress field");
        console.log("[atsu] DEBUG: continueReading =", mp?.continueReading);
        return null;
    }

    function buildMarkBelowPayload(mangaId, mangaType, targetNumber, allChapters) {
        const isStrip = !["manga"].includes((mangaType || "").toLowerCase());
        const toMark = allChapters
            .filter(c => Number(c.number) <= targetNumber)
            .sort((a, b) => Number(a.number) - Number(b.number));

        // Deduplicate by chapter number (only keep first occurrence to avoid counting multiple translations)
        const seen = new Set();
        const deduped = toMark.filter(c => {
            const num = Number(c.number);
            if (seen.has(num)) return false;
            seen.add(num);
            return true;
        });

        const now = Date.now();
        return deduped.map((c, i) => ({
            mangaScanlationId: c.scanlationMangaId,
            mangaId,
            chapterId: c.id,
            page: Math.max(0, (Number(c.pageCount) || 1) - 1),
            frac: 1,
            pages: Number(c.pageCount) || 1,
            ts: now + i,
            strip: isStrip,
        }));
    }

    // -------------------------------------------------------
    //  Find a suitable container inside the manga page.
    //  Returns null if no real container is found — never
    //  falls back to document.body to avoid injecting on
    //  the wrong page when window.mangaPage is stale.
    // -------------------------------------------------------
    function findChapterListContainer() {
        // Method 1: Find buttons like "Mark as read" or "Clear History" and use their container
        const buttons = [...document.querySelectorAll('button')];
        const actionBtn = buttons.find(btn =>
            btn.textContent.includes("Mark as read") ||
            btn.textContent.includes("Clear History") ||
            btn.textContent.includes("mark as")
        );

        if (actionBtn) {
            console.log("[atsu] Method 1: found action button, checking container hierarchy");
            let el = actionBtn.parentElement;
            for (let i = 0; i < 3; i++) {
                if (el && el.querySelectorAll('button').length >= 2) {
                    console.log("[atsu] Method 1 SUCCESS: using ancestor with multiple buttons");
                    return el;
                }
                el = el?.parentElement;
            }
            console.log("[atsu] Method 1 FALLBACK: using direct parent of action button");
            return actionBtn.parentElement;
        }

        // Method 2: Find via rate inputs (original)
        const inputs = [...document.querySelectorAll('input[placeholder="Rate 0-10"]')];
        console.log("[atsu] Method 2: rate inputs found:", inputs.length);
        if (inputs.length > 0) {
            let el = inputs[0].parentElement;
            while (el && el !== document.body) {
                if (el.querySelectorAll('input[placeholder="Rate 0-10"]').length > 1) {
                    console.log("[atsu] Method 2 SUCCESS: container (via rate inputs):", el.tagName, el.className.slice(0, 80));
                    return el;
                }
                el = el.parentElement;
            }
            el = inputs[0];
            for (let i = 0; i < 6; i++) { if (el.parentElement) el = el.parentElement; }
            console.log("[atsu] Method 2 FALLBACK: container (via rate inputs):", el.tagName, el.className.slice(0, 80));
            return el;
        }

        // Method 3: Look for chapter container by searching for visible list items/elements
        console.log("[atsu] Method 3: trying chapter/list selectors...");
        const potentialContainers = document.querySelectorAll('[class*="chapter"], ul, [class*="list"]');
        for (const container of potentialContainers) {
            const childCount = container.querySelectorAll('button, [class*="chapter"], li').length;
            if (childCount > 0 && container.offsetHeight > 200) {
                console.log("[atsu] Method 3 SUCCESS: found container with visible children");
                return container;
            }
        }

        // Method 4: Find the main content area
        console.log("[atsu] Method 4: trying main/primary content selectors...");
        const main = document.querySelector('main, [role="main"], .content, [class*="manga"], [class*="primary"]');
        if (main && main.offsetHeight > 0) {
            console.log("[atsu] Method 4 SUCCESS: container (via main selector):", main.tagName, main.className.slice(0, 80));
            return main;
        }

        // ✅ CHANGED: return null instead of document.body — prevents injection on wrong pages
        console.log("[atsu] WARNING: no specific container found, aborting injection");
        return null;
    }

    let confirmTimeout = null;

    async function doMarkBelowHighest(btn, highestRead) {
        const info = getCurrentMangaInfo();
        if (!info) {
            markBelowLog.textContent = "Could not read manga info.";
            return;
        }

        // First click — show confirmation with countdown
        if (!btn.classList.contains("atsu-confirm")) {
            btn.classList.add("atsu-confirm");

            let secs = 5;
            btn.textContent = `Confirm (${secs}s)`;

            confirmTimeout = setInterval(() => {
                secs--;
                if (secs <= 0) {
                    clearInterval(confirmTimeout);
                    confirmTimeout = null;
                    btn.classList.remove("atsu-confirm");
                    btn.textContent = `Mark Chapters`;
                    btn.disabled = false;
                } else {
                    btn.textContent = `Confirm (${secs}s)`;
                }
            }, 1000);
            return;
        }

        // Second click — actually do it
        clearInterval(confirmTimeout);
        confirmTimeout = null;
        btn.classList.remove("atsu-confirm");
        btn.disabled = true;
        btn.textContent = "Marking...";
        markBelowLog.textContent = "Fetching chapters...";

        try {
            let allChapters = info.chapters;
            if (info.chapters.length < info.total) {
                const res = await _origFetch(`/api/manga/allChapters?mangaId=${encodeURIComponent(info.mangaId)}`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    allChapters = data?.chapters || allChapters;
                }
            }

            const payload = buildMarkBelowPayload(info.mangaId, info.type, highestRead, allChapters);

            if (!payload.length) {
                markBelowLog.textContent = "No chapters to mark.";
                btn.disabled = false;
                btn.textContent = `Mark Chapters`;
                return;
            }

            // Split into batches to avoid 504 timeouts on large chapter counts
            const INITIAL_BATCH_SIZE = 20;
            const MIN_BATCH_SIZE = 1;
            let totalMarked = 0;
            let currentBatchSize = INITIAL_BATCH_SIZE;

            for (let i = 0; i < payload.length; ) {
                const batch = payload.slice(i, i + currentBatchSize);
                btn.textContent = `Marking... (${Math.min(totalMarked + batch.length, payload.length)}/${payload.length})`;
                markBelowLog.textContent = `Posting batch (size ${currentBatchSize})...`;

                let success = false;
                let attemptCount = 0;

                // Retry logic: keep halving batch size until it succeeds
                while (!success && currentBatchSize >= MIN_BATCH_SIZE) {
                    attemptCount++;
                    const retryBatch = payload.slice(i, i + currentBatchSize);
                    
                    try {
                        const res = await _origFetch(PROGRESS_ENDPOINT, {
                            method: "POST", credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ progress: retryBatch, deletedChapters: [] }),
                        });

                        if (res.ok) {
                            success = true;
                            totalMarked += retryBatch.length;
                            i += currentBatchSize;
                            btn.textContent = `Marking... (${Math.min(totalMarked, payload.length)}/${payload.length})`;
                            
                            // Try to increase batch size back to initial if we reduced it
                            if (currentBatchSize < INITIAL_BATCH_SIZE) {
                                currentBatchSize = Math.min(currentBatchSize * 2, INITIAL_BATCH_SIZE);
                                markBelowLog.textContent = `Batch succeeded, increasing size to ${currentBatchSize}`;
                            }
                        } else {
                            throw new Error(`HTTP ${res.status}`);
                        }
                    } catch (e) {
                        if (currentBatchSize > MIN_BATCH_SIZE) {
                            // Halve the batch size and retry with 5 second delay
                            currentBatchSize = Math.floor(currentBatchSize / 2);
                            if (currentBatchSize < MIN_BATCH_SIZE) currentBatchSize = MIN_BATCH_SIZE;
                            markBelowLog.textContent = `Batch failed (${e.message}), retrying with size ${currentBatchSize} in 5s...`;
                            await sleep(5000); // 5 second delay before retry
                        } else {
                            // At size 1 - wait 1 minute and retry
                            markBelowLog.textContent = `Batch failed at size 1, waiting 60s before retry...`;
                            await sleep(60000); // 1 minute delay
                            // Loop continues, will try again with size 1
                        }
                    }
                }

                if (success) {
                    // Add delay between batches to avoid overwhelming server
                    if (i < payload.length) {
                        await sleep(500);
                    }
                }
            }

            btn.textContent = `Done (${payload.length})`;
            markBelowLog.textContent = `Done — ${payload.length} chapters marked.`;
        } catch (e) {
            btn.disabled = false;
            btn.textContent = `Mark Chapters`;
            markBelowLog.textContent = `Error: ${e.message}`;
        }
    }

    function injectMarkBelowButton() {
        if (document.querySelector(".atsu-mark-below-btn")) {
            console.log("[atsu] button already injected");
            return;
        }

        // ✅ NEW: URL guard — bail immediately if not on a manga detail page
        if (!isOnMangaPage()) {
            console.log("[atsu] not on a manga page (URL check), skipping injection");
            return;
        }

        const info = getCurrentMangaInfo();
        if (!info) {
            console.log("[atsu] ✗ no manga info found - page may not be fully loaded");
            console.log("[atsu] window.mangaPage?.mangaPage =", window.mangaPage?.mangaPage);
            return;
        }

        // Don't show button if not on a manga page (no chapters loaded)
        if (!info.chapters || info.chapters.length === 0) {
            console.log("[atsu] ✗ not on a manga page (no chapters)");
            return;
        }

        console.log("[atsu] ✓ got manga info, ID:", info.mangaId);

        const highestRead = getHighestReadChapterNumber(info);

        if (highestRead === null && info.chapters.length === 0) {
            console.log("[atsu] ✗ no chapters available on this manga");
            return;
        }

        if (highestRead === null) {
            console.log("[atsu] ℹ no chapters marked as read yet, but showing button with default (Ch.1)");
        } else {
            console.log("[atsu] ✓ found highest read chapter:", highestRead);
        }

        const container = findChapterListContainer();

        // ✅ CHANGED: null means no real container found — abort instead of using body
        if (!container) {
            console.log("[atsu] ✗ FAILED: could not find chapter list container — not injecting");
            return;
        }
        console.log("[atsu] ✓ found container:", container.tagName, container.className.slice(0, 60));

        // Safety check: make sure container is actually in the visible document
        if (!document.body.contains(container)) {
            console.log("[atsu] ✗ WARNING: container found but not in visible DOM");
            return;
        }
        console.log("[atsu] ✓ container is in visible DOM");

        console.log("[atsu] injecting mark below button");

        // Use highest read if available, otherwise default to 1
        const defaultChapter = highestRead !== null ? highestRead : 1;

        const btn = document.createElement("button");
        btn.className = "atsu-mark-below-btn";
        btn.textContent = `Mark Chapters`;
        btn.title = highestRead !== null
            ? `Mark all chapters up to Chapter ${highestRead} as read (need confirmation)`
            : `Select a chapter number to mark up to`;
        btn.dataset.chapterNumber = defaultChapter;

        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            // If already in confirm state, proceed with marking
            if (btn.classList.contains("atsu-confirm")) {
                doMarkBelowHighest(btn, Number(btn.dataset.chapterNumber));
                return;
            }

            // First click: verify the comic title is correct
            const isCorrectComic = confirm(`Is this the correct comic?\n\n"${info.title}"`);
            if (!isCorrectComic) {
                location.reload();
                return;
            }

            // Second click: ask user for chapter number
            const chapterNum = prompt(`Which chapter number do you want to mark up to?`, String(defaultChapter));

            if (chapterNum !== null && chapterNum.trim() !== "") {
                const num = Number(chapterNum);
                if (Number.isFinite(num) && num > 0) {
                    btn.dataset.chapterNumber = num;
                    // Show confirmation state
                    btn.classList.add("atsu-confirm");
                    let secs = 5;
                    btn.textContent = `Confirm (${secs}s)`;
                    confirmTimeout = setInterval(() => {
                        secs--;
                        if (secs <= 0) {
                            clearInterval(confirmTimeout);
                            btn.classList.remove("atsu-confirm");
                            btn.textContent = `Mark Chapters`;
                        } else {
                            btn.textContent = `Confirm (${secs}s)`;
                        }
                    }, 1000);
                } else {
                    alert("Please enter a valid chapter number");
                }
            }
        });

        container.prepend(btn);
        const injected = document.querySelector(".atsu-mark-below-btn");
        if (injected) {
            console.log("[atsu] ✓ button injected successfully and verified in DOM");
        } else {
            console.log("[atsu] ✗ WARNING: button created but not found in DOM after prepend");
        }
    }

    function removeMarkBelowButton() {
        clearInterval(confirmTimeout);
        confirmTimeout = null;
        document.querySelectorAll(".atsu-mark-below-btn").forEach(el => el.remove());
    }

    // Re-run injection on DOM mutations (SPA navigation / lazy loads)
    const markBelowObserver = new MutationObserver(() => {
        if (!markBelowActive) return;
        clearTimeout(window._atsuMarkBelowTimer);
        window._atsuMarkBelowTimer = setTimeout(() => {
            const info = getCurrentMangaInfo();
            // Remove button if not on manga page (no chapters) or URL doesn't match
            if (!isOnMangaPage() || !info || !info.chapters || info.chapters.length === 0) {
                removeMarkBelowButton();
            } else {
                injectMarkBelowButton();
            }
        }, 400);
    });
    markBelowObserver.observe(document.body, { childList: true, subtree: true });

    if (markBelowActive) {
        markBelowLog.textContent = "Active";

        let lastUrl = window.location.href;
        let lastMangaId = null;

        // Retry injection when page first loads
        const tryInject = () => {
            if (!isOnMangaPage()) return;
            const info = getCurrentMangaInfo();
            if (info?.chapters && info.chapters.length > 0 && info.mangaId !== lastMangaId) {
                lastMangaId = info.mangaId;
                injectMarkBelowButton();
            }
        };
        setTimeout(tryInject, 1000);
        setTimeout(tryInject, 2000);
        setTimeout(tryInject, 3500);
        setTimeout(tryInject, 5000);

        // Listen for URL changes (navigation via browser or spa)
        window.addEventListener("popstate", () => {
            console.log("[atsu] URL changed (popstate), clearing button");
            removeMarkBelowButton();
            aggressiveRetry();
        });

        // Aggressively retry injecting until successful
        let retryInterval = null;
        const aggressiveRetry = () => {
            if (retryInterval) clearInterval(retryInterval);
            
            retryInterval = setInterval(() => {
                if (!isOnMangaPage()) {
                    lastMangaId = null;
                    clearInterval(retryInterval);
                    return;
                }
                
                const info = getCurrentMangaInfo();
                if (info?.chapters && info.chapters.length > 0 && info.mangaId !== lastMangaId) {
                    console.log("[atsu] Got new manga data, injecting button");
                    lastMangaId = info.mangaId;
                    injectMarkBelowButton();
                    clearInterval(retryInterval);
                }
            }, 200);
        };

        // Also check every 500ms if URL changed (handles SPA navigation)
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log("[atsu] URL changed (spa), clearing button");
                lastUrl = currentUrl;
                removeMarkBelowButton();
                aggressiveRetry();
            }
        }, 500);
    }

    // ============================================================
    //  MISC — QUICK ADD TO LIST
    // ============================================================
    const quickAddBtn = panel.querySelector("#misc-quick-add-toggle");
    const quickAddLog = panel.querySelector("#misc-quick-add-log");

    function updateQuickAddUI() {
        quickAddBtn.textContent = quickAddList ? "ON" : "OFF";
        quickAddBtn.style.background = quickAddList ? "#4ade80" : "#333";
        quickAddBtn.style.color = quickAddList ? "#000" : "#999";
    }

    quickAddBtn.addEventListener("click", () => {
        quickAddList = !quickAddList;
        localStorage.setItem("atsu_quick_add_list", quickAddList);
        updateQuickAddUI();
        if (quickAddList) {
            quickAddLog.textContent = "Active — watching bookmarks page...";
            injectAddListButtons();
        } else {
            quickAddLog.textContent = "";
            removeAddListButtons();
        }
    });

    updateQuickAddUI();
    if (quickAddList) quickAddLog.textContent = "Active — watching bookmarks page...";

    let cachedUserLists = null;
    let cachedListsTime = 0;

    async function fetchUserLists(forceRefresh) {
        // Cache for 30 seconds
        if (!forceRefresh && cachedUserLists && Date.now() - cachedListsTime < 30000) return cachedUserLists;
        try {
            const res = await _origFetch("/api/user/userMangaLists/getLists", { credentials: "include" });
            if (!res.ok) return null;
            const data = await res.json();
            cachedUserLists = data?.lists || [];
            cachedListsTime = Date.now();
            return cachedUserLists;
        } catch (e) {
            console.log("[atsu] Failed to fetch lists:", e);
            return null;
        }
    }

    async function fetchListDetail(listId) {
        try {
            const res = await _origFetch(`/api/user/userMangaLists/getList?listId=${encodeURIComponent(listId)}`, { credentials: "include" });
            if (!res.ok) return null;
            const data = await res.json();
            return data?.list || null;
        } catch (e) {
            return null;
        }
    }

    async function addMangaToList(listId, mangaId) {
        // Get existing manga in the list
        const listDetail = await fetchListDetail(listId);
        if (!listDetail) throw new Error("Failed to fetch list");

        const existingManga = (listDetail.manga || []).map((m, idx) => ({
            mangaId: m.id,
            index: m.index != null ? m.index : idx
        }));

        // Check if already in list
        if (existingManga.some(m => m.mangaId === mangaId)) return "already";

        // Add new manga at the end
        const nextIndex = existingManga.length > 0
            ? Math.max(...existingManga.map(m => m.index)) + 1
            : 0;
        existingManga.push({ mangaId, index: nextIndex });

        const res = await _origFetch("/api/user/userMangaLists/updateList", {
            method: "PATCH", credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ listId, formData: existingManga }),
        });
        if (!res.ok) throw new Error(`updateList ${res.status}`);
        cachedUserLists = null; // Invalidate cache
        return "added";
    }

    function closeAllDropdowns() {
        document.querySelectorAll(".atsu-list-dropdown").forEach(d => d.remove());
    }

    function showListDropdown(anchorBtn, mangaId) {
        closeAllDropdowns();

        const dropdown = document.createElement("div");
        dropdown.className = "atsu-list-dropdown";
        dropdown.textContent = "Loading lists...";
        dropdown.style.cssText += "padding: 10px 14px; font-size: 12px; color: #888;";

        // Position near button
        const rect = anchorBtn.getBoundingClientRect();
        dropdown.style.position = "fixed";
        dropdown.style.left = rect.left + "px";
        dropdown.style.top = (rect.bottom + 4) + "px";
        document.body.appendChild(dropdown);

        // Close on outside click
        const onOutside = (e) => {
            if (!dropdown.contains(e.target) && e.target !== anchorBtn) {
                dropdown.remove();
                document.removeEventListener("click", onOutside, true);
            }
        };
        setTimeout(() => document.addEventListener("click", onOutside, true), 0);

        // Fetch and populate
        fetchUserLists(false).then(lists => {
            if (!lists || lists.length === 0) {
                dropdown.textContent = "No lists found";
                return;
            }
            dropdown.textContent = "";
            dropdown.style.cssText = dropdown.style.cssText.replace("padding: 10px 14px; font-size: 12px; color: #888;", "");

            for (const list of lists) {
                const item = document.createElement("button");
                item.className = "atsu-list-dropdown-item";
                item.textContent = list.title;
                item.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    dropdown.remove();
                    document.removeEventListener("click", onOutside, true);

                    anchorBtn.disabled = true;
                    anchorBtn.textContent = "Adding...";

                    try {
                        const result = await addMangaToList(list.id, mangaId);
                        if (result === "already") {
                            anchorBtn.textContent = "Already in list";
                            anchorBtn.classList.add("atsu-added");
                        } else {
                            anchorBtn.textContent = "Added \u2713";
                            anchorBtn.classList.add("atsu-added");
                        }
                        quickAddLog.textContent = `Added to "${list.title}"`;
                    } catch (err) {
                        anchorBtn.textContent = "Failed";
                        anchorBtn.disabled = false;
                        quickAddLog.textContent = `Error: ${err.message}`;
                        setTimeout(() => {
                            if (anchorBtn.textContent === "Failed") {
                                anchorBtn.textContent = "+ List";
                            }
                        }, 2000);
                    }
                });
                dropdown.appendChild(item);
            }
        });
    }

    function getMangaIdFromBookmarkCard(card) {
        // Look for a link to /manga/<id> or /comic/<id> inside the card
        const link = card.querySelector('a[href*="/manga/"], a[href*="/comic/"], a[href*="/title/"]');
        if (link) {
            const m = link.getAttribute("href").match(/\/(manga|comic|title)\/([^/]+)/);
            if (m) return m[2];
        }
        return null;
    }

    function injectAddListButtons() {
        if (!quickAddList) return;
        if (!window.location.pathname.includes("/bookmarks")) return;

        // Find all bookmark cards that don't already have our button
        // Look for links that go to manga pages — their parent cards are bookmark entries
        const allLinks = document.querySelectorAll('a[href*="/manga/"], a[href*="/comic/"], a[href*="/title/"]');
        const processed = new Set();

        for (const link of allLinks) {
            // Walk up to find the card container (usually 2-4 levels up)
            let card = link;
            for (let i = 0; i < 5; i++) {
                if (!card.parentElement || card.parentElement === document.body) break;
                card = card.parentElement;
                // A "card" typically has a certain min height and contains an image
                if (card.offsetHeight > 40 && card.querySelector('img')) break;
            }

            if (processed.has(card)) continue;
            processed.add(card);

            // Skip if already injected
            if (card.querySelector(".atsu-add-list-btn")) continue;

            const mangaId = getMangaIdFromBookmarkCard(card);
            if (!mangaId) continue;

            const btn = document.createElement("button");
            btn.className = "atsu-add-list-btn";
            btn.textContent = "+ List";
            btn.title = "Add to a list";
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
                showListDropdown(btn, mangaId);
            });

            // Place button after the last column in the row
            // Find the last child element of the card (the Continue column)
            const lastCol = card.lastElementChild;
            if (lastCol) {
                lastCol.style.position = "relative";
                lastCol.style.display = "flex";
                lastCol.style.alignItems = "center";
                lastCol.style.gap = "8px";
                lastCol.appendChild(btn);
            } else {
                card.appendChild(btn);
            }
        }
    }

    function removeAddListButtons() {
        closeAllDropdowns();
        document.querySelectorAll(".atsu-add-list-btn").forEach(el => el.remove());
    }

    // Re-inject on DOM changes (bookmarks page lazy-loads)
    const quickAddObserver = new MutationObserver(() => {
        if (!quickAddList) return;
        clearTimeout(window._atsuQuickAddTimer);
        window._atsuQuickAddTimer = setTimeout(() => {
            if (window.location.pathname.includes("/bookmarks")) {
                injectAddListButtons();
            } else {
                removeAddListButtons();
            }
        }, 500);
    });
    quickAddObserver.observe(document.body, { childList: true, subtree: true });

    // Initial injection
    if (quickAddList) {
        setTimeout(injectAddListButtons, 1500);
        setTimeout(injectAddListButtons, 3000);
    }

    // Close dropdowns on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllDropdowns();
    });

    // ============================================================
    //  OFFLINE READER — IndexedDB + Download + Viewer
    // ============================================================
    const OFFLINE_DB_NAME = "atsu_offline_db";
    const OFFLINE_DB_VERSION = 1;
    const OFFLINE_STORE = "chapters";

    function openOfflineDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
                    db.createObjectStore(OFFLINE_STORE, { keyPath: "id" });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveChapterOffline(chapter) {
        const db = await openOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_STORE, "readwrite");
            tx.objectStore(OFFLINE_STORE).put(chapter);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getAllOfflineChapters() {
        const db = await openOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_STORE, "readonly");
            const req = tx.objectStore(OFFLINE_STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function getOfflineChapter(id) {
        const db = await openOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_STORE, "readonly");
            const req = tx.objectStore(OFFLINE_STORE).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteOfflineChapter(id) {
        const db = await openOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OFFLINE_STORE, "readwrite");
            tx.objectStore(OFFLINE_STORE).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function detectChapterImages() {
        const imgs = [...document.querySelectorAll("img")]
            .filter(img => img.src && img.src.includes("/static/pages/"));
        const seen = new Set();
        return imgs.filter(img => {
            if (seen.has(img.src)) return false;
            seen.add(img.src);
            return true;
        }).map(img => img.src);
    }

    function detectChapterInfo() {
        const path = window.location.pathname;
        const mangaMatch = path.match(/\/(manga|comic|title)\/([^/]+)/);
        const mangaSlug = mangaMatch?.[2] || "unknown";

        const mp = window.mangaPage?.mangaPage;
        const mangaId = mp?.id || mangaSlug;
        const mangaTitle = mp?.title || document.title.split(/[|\-\u2013\u2014]/)[0].trim() || "Unknown";

        const chMatch = path.match(/\/(\d+(?:\.\d+)?)\/?$/);
        let chapterNumber = chMatch?.[1] || null;

        if (!chapterNumber) {
            const headings = document.querySelectorAll("h1, h2, h3, [class*='chapter']");
            for (const el of headings) {
                const m = el.textContent.match(/ch(?:apter)?\.?\s*(\d+(?:\.\d+)?)/i);
                if (m) { chapterNumber = m[1]; break; }
            }
        }
        chapterNumber = chapterNumber || "0";
        return { mangaId, mangaTitle, chapterNumber };
    }

    const offlineLog = panel.querySelector("#offline-log");
    const offlineListEl = panel.querySelector("#offline-list");
    const offlineBatchBtn = panel.querySelector("#offline-batch-dl");
    const offlineFromInput = panel.querySelector("#offline-from");
    const offlineToInput = panel.querySelector("#offline-to");
    const offlineScanlationSel = panel.querySelector("#offline-scanlation");
    const offlineStorageEl = panel.querySelector("#offline-storage");

    // Populate scanlation dropdown when manga info is available
    async function refreshScanlationList() {
        const info = await resolveCurrentMangaInfo();
        if (!info) return;
        try {
            const res = await _origFetch(`/api/manga/allChapters?mangaId=${encodeURIComponent(info.mangaId)}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            const chapters = data?.chapters || [];
            const groups = new Map();
            for (const c of chapters) {
                const gid = c.scanlationMangaId || "unknown";
                if (!groups.has(gid)) {
                    groups.set(gid, { id: gid, name: c.groupName || c.scanlationName || gid, count: 0 });
                }
                groups.get(gid).count++;
            }
            offlineScanlationSel.innerHTML = '<option value="">Auto (best available)</option>';
            for (const [gid, g] of groups) {
                const opt = document.createElement("option");
                opt.value = gid;
                opt.textContent = `${g.name} (${g.count} ch)`;
                offlineScanlationSel.appendChild(opt);
            }
        } catch (_) {}
    }

    // Update storage usage display
    async function updateStorageIndicator() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                const used = est.usage || 0;
                const quota = est.quota || 0;
                const fmt = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : b < 1073741824 ? (b / 1048576).toFixed(1) + " MB" : (b / 1073741824).toFixed(2) + " GB";
                const pct = quota > 0 ? ((used / quota) * 100).toFixed(1) : "?";
                offlineStorageEl.innerHTML = `Storage: ${fmt(used)} / ${fmt(quota)} (${pct}%)`;
            } else {
                offlineStorageEl.textContent = "Storage API not available";
            }
        } catch (_) { offlineStorageEl.textContent = ""; }
    }

    // Batch chapter download
    offlineBatchBtn.addEventListener("click", async () => {
        const info = await resolveCurrentMangaInfo();
        if (!info) { offlineLog.textContent = "Navigate to a manga page first."; return; }

        // Confirm the detected manga is correct
        const confirmed = confirm(`Is this the right comic?\n\n"${info.title}"\n\nClick OK to continue, or Cancel to refresh the page.`);
        if (!confirmed) {
            window.location.reload();
            return;
        }

        const fromNum = Number(offlineFromInput.value);
        const toNum = Number(offlineToInput.value);
        if (!Number.isFinite(fromNum) || !Number.isFinite(toNum) || fromNum < 1 || toNum < fromNum) {
            offlineLog.textContent = "Invalid chapter range.";
            return;
        }

        offlineBatchBtn.disabled = true;
        offlineLog.textContent = "Fetching chapter list...";

        try {
            const chaptersRes = await _origFetch(`/api/manga/allChapters?mangaId=${encodeURIComponent(info.mangaId)}`, { credentials: "include" });
            if (!chaptersRes.ok) {
                if (info.unresolvedId) {
                    throw new Error(`Could not resolve manga ID on this page (HTTP ${chaptersRes.status}). Open the manga title page and try again.`);
                }
                throw new Error(`HTTP ${chaptersRes.status}`);
            }
            const chaptersData = await chaptersRes.json();
            const allChapters = chaptersData?.chapters || [];

            // Filter by scanlation if user picked one
            const selectedScanlation = offlineScanlationSel.value;
            const filtered = selectedScanlation
                ? allChapters.filter(c => c.scanlationMangaId === selectedScanlation)
                : allChapters;

            // Build map: chapter number -> best chapter object (deduplicate)
            const chapterMap = new Map();
            for (const c of filtered) {
                const num = Number(c.number);
                if (!Number.isFinite(num)) continue;
                const prev = chapterMap.get(num);
                if (!prev || (Number(c.index) || 0) > (Number(prev.index) || 0)) chapterMap.set(num, c);
            }

            // Gather chapters in range
            const toDownload = [];
            for (let n = fromNum; n <= toNum; n+=0.5) {
                if (chapterMap.has(n)) toDownload.push({ num: n, ch: chapterMap.get(n) });
            }

            if (!toDownload.length) {
                offlineLog.textContent = `No chapters found in range ${fromNum}-${toNum}.`;
                offlineBatchBtn.disabled = false;
                return;
            }

            offlineLog.textContent = `Found ${toDownload.length} chapters. Starting download...`;

            let completed = 0;
            for (const { num, ch } of toDownload) {
                completed++;
                offlineBatchBtn.textContent = `Downloading... (${completed}/${toDownload.length})`;
                offlineLog.textContent = `Ch.${num}: fetching pages...`;

                try {
                    // Fetch chapter page list
                    const pageRes = await _origFetch(`/api/read/chapter?mangaId=${encodeURIComponent(info.mangaId)}&chapterId=${encodeURIComponent(ch.id)}`, { credentials: "include" });
                    if (!pageRes.ok) {
                        offlineLog.textContent = `Ch.${num}: failed to get page list (${pageRes.status})`;
                        continue;
                    }
                    const pageData = await pageRes.json();
                    const pages = pageData?.readChapter?.pages || [];

                    if (!pages.length) {
                        offlineLog.textContent = `Ch.${num}: no pages found, skipping.`;
                        continue;
                    }

                    // Download page images in parallel batches for speed
                    const PAGE_BATCH = 12;
                    const imageBlobs = new Array(pages.length);
                    for (let batch = 0; batch < pages.length; batch += PAGE_BATCH) {
                        const slice = pages.slice(batch, batch + PAGE_BATCH);
                        const promises = slice.map(async (pg, j) => {
                            const idx = batch + j;
                            const pageUrl = pg?.image || "";
                            if (!pageUrl) return;
                            const imgRes = await _origFetch(pageUrl);
                            if (!imgRes.ok) throw new Error(`Page ${idx + 1}: HTTP ${imgRes.status}`);
                            imageBlobs[idx] = await imgRes.blob();
                        });
                        await Promise.all(promises);
                        offlineLog.textContent = `Ch.${num}: ${Math.min(batch + PAGE_BATCH, pages.length)}/${pages.length} pages...`;
                    }
                    // Remove empty slots (pages with no URL)
                    const finalBlobs = imageBlobs.filter(Boolean);

                    await saveChapterOffline({
                        id: `${info.mangaId}_ch${num}`,
                        mangaId: info.mangaId,
                        mangaTitle: info.title,
                        mangaType: info.type || "Manga",
                        chapterNumber: String(num),
                        images: finalBlobs,
                        pageCount: finalBlobs.length,
                        downloadedAt: Date.now(),
                        url: window.location.href,
                    });
                    offlineLog.textContent = `Ch.${num}: saved (${finalBlobs.length} pages).`;
                } catch (e) {
                    offlineLog.textContent = `Ch.${num}: error — ${e.message}`;
                }
            }

            offlineLog.textContent = `Batch complete: ${completed} chapters processed.`;
        } catch (e) {
            offlineLog.textContent = `Batch failed: ${e.message}`;
        }

        offlineBatchBtn.disabled = false;
        offlineBatchBtn.textContent = "Download Chapters";
        refreshOfflineList();
        updateStorageIndicator();
    });

    async function refreshOfflineList() {
        try {
            const chapters = await getAllOfflineChapters();
            if (!chapters.length) {
                offlineListEl.innerHTML = '<div style="opacity:0.5; font-size:11px; padding:8px;">No downloaded chapters yet.</div>';
                return;
            }
            offlineListEl.innerHTML = "";

            // Group chapters by manga
            const mangaGroups = new Map();
            for (const ch of chapters) {
                const key = ch.mangaId || ch.mangaTitle || "Unknown";
                if (!mangaGroups.has(key)) mangaGroups.set(key, { title: ch.mangaTitle || "Unknown", chapters: [] });
                mangaGroups.get(key).chapters.push(ch);
            }

            for (const [mangaId, group] of mangaGroups) {
                group.chapters.sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));

                // Manga header (collapsible)
                const header = document.createElement("div");
                header.style.cssText = `
                    display:flex; align-items:center; gap:6px; padding:7px 8px; cursor:pointer;
                    background:rgba(255,255,255,0.04); border-radius:6px; margin-bottom:2px;
                    user-select:none; transition:background 0.15s;
                `;
                header.addEventListener("mouseenter", () => header.style.background = "rgba(255,255,255,0.08)");
                header.addEventListener("mouseleave", () => header.style.background = "rgba(255,255,255,0.04)");

                const arrow = document.createElement("span");
                arrow.textContent = "▶";
                arrow.style.cssText = "font-size:9px; color:#888; transition:transform 0.2s; flex-shrink:0;";

                const mangaTitle = document.createElement("span");
                mangaTitle.style.cssText = "font-size:12px; font-weight:600; color:#e0e0f0; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
                mangaTitle.textContent = group.title;

                const chCount = document.createElement("span");
                chCount.style.cssText = "font-size:10px; color:#666; flex-shrink:0;";
                chCount.textContent = `${group.chapters.length} ch`;

                // Delete all for this manga
                const delAllBtn = document.createElement("button");
                delAllBtn.title = "Delete all chapters";
                delAllBtn.innerHTML = "&#10005;";
                delAllBtn.style.cssText = `
                    background:none; border:none; color:#666; cursor:pointer;
                    font-size:11px; padding:0 4px; flex-shrink:0; transition:color 0.15s; line-height:1;
                `;
                delAllBtn.addEventListener("mouseenter", () => delAllBtn.style.color = "#ef4444");
                delAllBtn.addEventListener("mouseleave", () => delAllBtn.style.color = "#666");
                delAllBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    for (const ch of group.chapters) await deleteOfflineChapter(ch.id);
                    refreshOfflineList();
                    updateStorageIndicator();
                });

                header.appendChild(arrow);
                header.appendChild(mangaTitle);
                header.appendChild(chCount);
                header.appendChild(delAllBtn);

                // Chapter list (collapsed by default)
                const chapterList = document.createElement("div");
                chapterList.style.cssText = "display:none; padding-left:6px; margin-bottom:4px;";

                let expanded = false;
                header.addEventListener("click", () => {
                    expanded = !expanded;
                    chapterList.style.display = expanded ? "block" : "none";
                    arrow.style.transform = expanded ? "rotate(90deg)" : "rotate(0deg)";
                });

                for (const ch of group.chapters) {
                    const row = document.createElement("div");
                    row.className = "atsu-offline-row";

                    const info = document.createElement("div");
                    info.style.cssText = "flex:1; min-width:0;";
                    const metaEl = document.createElement("div");
                    metaEl.style.cssText = "font-size:11px; color:#ccc;";
                    metaEl.textContent = `Ch. ${ch.chapterNumber} \u00b7 ${ch.pageCount} pages`;
                    info.appendChild(metaEl);
                    row.appendChild(info);

                    const readBtn = document.createElement("button");
                    readBtn.className = "atsu-offline-read-btn";
                    readBtn.title = "Read";
                    readBtn.innerHTML = "&#9654;";
                    readBtn.addEventListener("click", () => openOfflineReader(ch.id));
                    row.appendChild(readBtn);

                    const delBtn = document.createElement("button");
                    delBtn.className = "atsu-offline-del-btn";
                    delBtn.title = "Delete";
                    delBtn.innerHTML = "&#10005;";
                    delBtn.addEventListener("click", async () => {
                        await deleteOfflineChapter(ch.id);
                        refreshOfflineList();
                        updateStorageIndicator();
                    });
                    row.appendChild(delBtn);

                    chapterList.appendChild(row);
                }

                offlineListEl.appendChild(header);
                offlineListEl.appendChild(chapterList);
            }
        } catch (e) {
            offlineListEl.innerHTML = "";
            const errEl = document.createElement("div");
            errEl.style.cssText = "color:#ef4444; font-size:11px;";
            errEl.textContent = e.message;
            offlineListEl.appendChild(errEl);
        }
    }

    async function openOfflineReader(chapterId) {
        const chapter = await getOfflineChapter(chapterId);
        if (!chapter) { offlineLog.textContent = "Chapter not found in storage."; return; }

        // Get all downloaded chapters for this manga to enable navigation
        const allOffline = await getAllOfflineChapters();
        const sameMangas = allOffline
            .filter(c => c.mangaId === chapter.mangaId)
            .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));

        // Determine if manga (traditional) or strip (manhwa/manhua) for settings
        const isManga = ["manga"].includes((chapter.mangaType || "Manga").toLowerCase());
        const settingsKey = isManga ? "manga" : "strip";

        const savedWidth = parseInt(localStorage.getItem(`atsu_reader_width_${settingsKey}`) || localStorage.getItem("atsu_reader_width") || "900", 10);
        const savedGap = parseInt(localStorage.getItem(`atsu_reader_gap_${settingsKey}`) || localStorage.getItem("atsu_reader_gap") || "0", 10);
        const savedBg = localStorage.getItem(`atsu_reader_bg_${settingsKey}`) || localStorage.getItem("atsu_reader_bg") || "#000000";
        const defaultDir = isManga ? "right" : "down";
        const defaultMode = isManga ? "double" : "single";
        const savedDir = localStorage.getItem(`atsu_reader_dir_${settingsKey}`) || defaultDir;
        const savedMode = localStorage.getItem(`atsu_reader_mode_${settingsKey}`) || defaultMode;
        const savedOffset = localStorage.getItem(`atsu_reader_offset_first_${settingsKey}`) === "true";

        let currentDir = savedDir;
        let currentMode = savedMode;
        let offsetFirst = savedOffset;
        let currentPage = 0;

        const overlay = document.createElement("div");
        overlay.id = "atsu-offline-reader";
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: ${savedBg}; z-index: 9999999;
            overflow-y: auto; display: flex;
            flex-direction: column; align-items: center;
        `;

        // Settings toggle arrow (top-left corner)
        const settingsToggle = document.createElement("button");
        settingsToggle.innerHTML = "&#9660;";
        settingsToggle.title = "Reader Settings";
        settingsToggle.style.cssText = `
            position: fixed; top: 10px; left: 14px;
            z-index: 10000001; background: rgba(30,30,36,0.92);
            border: 1px solid rgba(255,255,255,0.12); color: #ccc;
            width: 34px; height: 34px; border-radius: 8px;
            cursor: pointer; font-size: 14px; display: flex;
            align-items: center; justify-content: center;
            backdrop-filter: blur(8px); transition: transform 0.2s;
        `;

        // Settings panel (hidden by default)
        const settingsPanel = document.createElement("div");
        settingsPanel.style.cssText = `
            position: fixed; top: 52px; left: 14px;
            z-index: 10000001; background: rgba(14,14,18,0.96);
            border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
            padding: 14px 16px; min-width: 240px;
            backdrop-filter: blur(14px); display: none;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', system-ui, sans-serif;
        `;

        // --- Title ---
        const titleEl = document.createElement("div");
        titleEl.textContent = chapter.mangaTitle;
        titleEl.style.cssText = "font-size:13px; font-weight:700; color:#e0e0f0; margin-bottom:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
        settingsPanel.appendChild(titleEl);

        // --- Chapter navigation row: ◀ [dropdown] ▶ ---
        const navRow = document.createElement("div");
        navRow.style.cssText = "display:flex; align-items:center; gap:6px; margin-bottom:12px;";

        const prevBtn = document.createElement("button");
        prevBtn.innerHTML = "&#9664;";
        prevBtn.title = "Previous Chapter";
        prevBtn.style.cssText = `
            width:32px; height:32px; border-radius:6px; border:1px solid rgba(255,255,255,0.12);
            background:rgba(255,255,255,0.07); color:#e0e0f0; cursor:pointer; font-size:14px;
            display:flex; align-items:center; justify-content:center;
        `;

        const chapterSelect = document.createElement("select");
        chapterSelect.style.cssText = `
            flex:1; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
            border-radius:6px; color:#e0e0f0; padding:5px 8px; font-size:12px; cursor:pointer;
        `;
        for (const c of sameMangas) {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `Ch. ${c.chapterNumber}`;
            if (c.id === chapterId) opt.selected = true;
            chapterSelect.appendChild(opt);
        }

        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = "&#9654;";
        nextBtn.title = "Next Chapter";
        nextBtn.style.cssText = prevBtn.style.cssText;

        navRow.appendChild(prevBtn);
        navRow.appendChild(chapterSelect);
        navRow.appendChild(nextBtn);
        settingsPanel.appendChild(navRow);

        // Helper to navigate chapters
        const curIdx = () => sameMangas.findIndex(c => c.id === chapterSelect.value);
        const navigate = (targetId) => {
            cleanup();
            openOfflineReader(targetId);
        };
        prevBtn.addEventListener("click", () => {
            const i = curIdx();
            if (i > 0) navigate(sameMangas[i - 1].id);
        });
        nextBtn.addEventListener("click", () => {
            const i = curIdx();
            if (i < sameMangas.length - 1) navigate(sameMangas[i + 1].id);
        });
        chapterSelect.addEventListener("change", () => navigate(chapterSelect.value));

        // Update nav button states
        const updateNavBtns = () => {
            const i = curIdx();
            prevBtn.disabled = i <= 0;
            prevBtn.style.opacity = i <= 0 ? "0.3" : "1";
            nextBtn.disabled = i >= sameMangas.length - 1;
            nextBtn.style.opacity = i >= sameMangas.length - 1 ? "0.3" : "1";
        };
        updateNavBtns();

        // --- Direction: Down / Left / Right ---
        const dirRow = document.createElement("div");
        dirRow.style.cssText = "margin-bottom:10px;";
        const dirLabel = document.createElement("div");
        dirLabel.style.cssText = "font-size:11px; color:#888; margin-bottom:4px;";
        dirLabel.textContent = "Direction:";
        const dirBtns = document.createElement("div");
        dirBtns.style.cssText = "display:flex; gap:0; border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.12);";
        const dirOptions = ["down", "left", "right"];
        const dirBtnEls = {};
        const dirBtnStyle = (active) => `flex:1; padding:5px 0; border:none; font-size:11px; font-weight:600; cursor:pointer; text-align:center; transition:background 0.15s, color 0.15s; background:${active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.04)"}; color:${active ? "#a5b4fc" : "#888"};`;
        for (const d of dirOptions) {
            const btn = document.createElement("button");
            btn.textContent = d === "down" ? "\u2193 Down" : d === "left" ? "\u2190 Left" : "\u2192 Right";
            btn.style.cssText = dirBtnStyle(d === currentDir);
            btn.addEventListener("click", () => {
                currentDir = d;
                localStorage.setItem(`atsu_reader_dir_${settingsKey}`, d);
                for (const [k, b] of Object.entries(dirBtnEls)) b.style.cssText = dirBtnStyle(k === d);
                renderPages();
            });
            dirBtnEls[d] = btn;
            dirBtns.appendChild(btn);
        }
        dirRow.appendChild(dirLabel);
        dirRow.appendChild(dirBtns);
        settingsPanel.appendChild(dirRow);

        // --- Mode: Single Page / Double Spread ---
        const modeRow = document.createElement("div");
        modeRow.style.cssText = "margin-bottom:10px;";
        const modeLabel = document.createElement("div");
        modeLabel.style.cssText = "font-size:11px; color:#888; margin-bottom:4px;";
        modeLabel.textContent = "Page mode:";
        const modeBtns = document.createElement("div");
        modeBtns.style.cssText = "display:flex; gap:0; border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.12);";
        const modeOptions = ["single", "double"];
        const modeBtnEls = {};
        const modeBtnStyle = (active) => `flex:1; padding:5px 0; border:none; font-size:11px; font-weight:600; cursor:pointer; text-align:center; transition:background 0.15s, color 0.15s; background:${active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.04)"}; color:${active ? "#a5b4fc" : "#888"};`;
        for (const m of modeOptions) {
            const btn = document.createElement("button");
            btn.textContent = m === "single" ? "Single Page" : "Double Spread";
            btn.style.cssText = modeBtnStyle(m === currentMode);
            btn.addEventListener("click", () => {
                currentMode = m;
                localStorage.setItem(`atsu_reader_mode_${settingsKey}`, m);
                for (const [k, b] of Object.entries(modeBtnEls)) b.style.cssText = modeBtnStyle(k === m);
                offsetRow.style.display = m === "double" ? "block" : "none";
                renderPages();
            });
            modeBtnEls[m] = btn;
            modeBtns.appendChild(btn);
        }
        modeRow.appendChild(modeLabel);
        modeRow.appendChild(modeBtns);
        settingsPanel.appendChild(modeRow);

        // --- Offset (double spread only) ---
        const offsetRow = document.createElement("div");
        offsetRow.style.cssText = `margin-bottom:10px; display:${currentMode === "double" ? "block" : "none"};`;
        const offsetCheck = document.createElement("label");
        offsetCheck.style.cssText = "display:flex; align-items:center; gap:6px; font-size:11px; color:#ccc; cursor:pointer;";
        const offsetInput = document.createElement("input");
        offsetInput.type = "checkbox";
        offsetInput.checked = offsetFirst;
        offsetInput.style.cssText = "accent-color:#6366f1;";
        offsetCheck.appendChild(offsetInput);
        offsetCheck.appendChild(document.createTextNode("First page is solo (cover offset)"));
        offsetInput.addEventListener("change", () => {
            offsetFirst = offsetInput.checked;
            localStorage.setItem(`atsu_reader_offset_first_${settingsKey}`, offsetFirst);
            renderPages();
        });
        offsetRow.appendChild(offsetCheck);
        settingsPanel.appendChild(offsetRow);

        // --- Strip Width slider ---
        const widthRow = document.createElement("div");
        widthRow.style.cssText = "margin-bottom:10px;";
        const widthLabel = document.createElement("div");
        widthLabel.style.cssText = "font-size:11px; color:#888; margin-bottom:3px;";
        widthLabel.textContent = `Strip width: ${savedWidth}px`;
        const widthSlider = document.createElement("input");
        widthSlider.type = "range"; widthSlider.min = "300"; widthSlider.max = "1920";
        widthSlider.value = String(savedWidth);
        widthSlider.style.cssText = "width:100%; accent-color:#6366f1; cursor:pointer;";
        widthRow.appendChild(widthLabel);
        widthRow.appendChild(widthSlider);
        settingsPanel.appendChild(widthRow);

        // --- Strip Gap slider ---
        const gapRow = document.createElement("div");
        gapRow.style.cssText = "margin-bottom:10px;";
        const gapLabel = document.createElement("div");
        gapLabel.style.cssText = "font-size:11px; color:#888; margin-bottom:3px;";
        gapLabel.textContent = `Strip gap: ${savedGap}px`;
        const gapSlider = document.createElement("input");
        gapSlider.type = "range"; gapSlider.min = "0"; gapSlider.max = "20";
        gapSlider.value = String(savedGap);
        gapSlider.style.cssText = "width:100%; accent-color:#6366f1; cursor:pointer;";
        gapRow.appendChild(gapLabel);
        gapRow.appendChild(gapSlider);
        settingsPanel.appendChild(gapRow);

        // --- Progress indicator ---
        const progressEl = document.createElement("div");
        progressEl.style.cssText = "font-size:11px; color:#999; margin-bottom:10px; text-align:center;";
        progressEl.textContent = `Page 1 / ${chapter.images.length}`;
        settingsPanel.appendChild(progressEl);

        // --- Background color ---
        const bgRow = document.createElement("div");
        bgRow.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:12px;";
        const bgLabel = document.createElement("div");
        bgLabel.style.cssText = "font-size:11px; color:#888;";
        bgLabel.textContent = "Background:";
        const bgInput = document.createElement("input");
        bgInput.type = "color";
        bgInput.value = savedBg;
        bgInput.style.cssText = "width:32px; height:24px; border:1px solid rgba(255,255,255,0.12); border-radius:4px; background:none; cursor:pointer; padding:0;";
        const bgPresets = document.createElement("div");
        bgPresets.style.cssText = "display:flex; gap:4px;";
        for (const color of ["#000000", "#1a1a2e", "#ffffff", "#1e1e1e"]) {
            const swatch = document.createElement("button");
            swatch.style.cssText = `width:20px; height:20px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); background:${color}; cursor:pointer; padding:0;`;
            swatch.addEventListener("click", () => {
                bgInput.value = color;
                overlay.style.background = color;
                localStorage.setItem(`atsu_reader_bg_${settingsKey}`, color);
            });
            bgPresets.appendChild(swatch);
        }
        bgRow.appendChild(bgLabel);
        bgRow.appendChild(bgInput);
        bgRow.appendChild(bgPresets);
        settingsPanel.appendChild(bgRow);

        bgInput.addEventListener("input", () => {
            overlay.style.background = bgInput.value;
            localStorage.setItem(`atsu_reader_bg_${settingsKey}`, bgInput.value);
        });

        // --- Close button ---
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close Reader";
        closeBtn.style.cssText = `
            width:100%; background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.4);
            padding: 7px 16px; border-radius: 6px;
            cursor: pointer; font-weight: 700; font-size: 12px; transition: background 0.15s;
        `;
        settingsPanel.appendChild(closeBtn);

        let settingsOpen = false;
        settingsToggle.addEventListener("click", () => {
            settingsOpen = !settingsOpen;
            settingsPanel.style.display = settingsOpen ? "block" : "none";
            settingsToggle.style.transform = settingsOpen ? "rotate(180deg)" : "rotate(0deg)";
        });

        overlay.appendChild(settingsToggle);
        overlay.appendChild(settingsPanel);

        const imgContainer = document.createElement("div");
        imgContainer.style.cssText = `max-width: ${savedWidth}px; width: 100%; transition: max-width 0.15s;`;

        widthSlider.addEventListener("input", () => {
            const w = widthSlider.value;
            imgContainer.style.maxWidth = w + "px";
            widthLabel.textContent = `Strip width: ${w}px`;
            localStorage.setItem(`atsu_reader_width_${settingsKey}`, w);
        });

        gapSlider.addEventListener("input", () => {
            const g = gapSlider.value;
            gapLabel.textContent = `Strip gap: ${g}px`;
            localStorage.setItem(`atsu_reader_gap_${settingsKey}`, g);
            renderPages();
        });

        // Create object URLs once
        const objectUrls = chapter.images.map(blob => URL.createObjectURL(blob));
        const totalPages = objectUrls.length;

        // Build page spreads for double mode
        function buildSpreads() {
            const spreads = [];
            let i = 0;
            if (currentMode === "double" && offsetFirst && totalPages > 0) {
                spreads.push([0]);
                i = 1;
            }
            while (i < totalPages) {
                if (currentMode === "double" && i + 1 < totalPages) {
                    spreads.push([i, i + 1]);
                    i += 2;
                } else {
                    spreads.push([i]);
                    i++;
                }
            }
            return spreads;
        }

        // Build end-of-chapter navigation bar
        function buildEndNav() {
            const idx = curIdx();
            const bar = document.createElement("div");
            bar.style.cssText = "display:flex; justify-content:center; align-items:center; gap:12px; padding:30px 0 40px;";

            const btnStyle = `padding:10px 24px; border-radius:8px; border:1px solid rgba(255,255,255,0.15);
                background:rgba(99,102,241,0.2); color:#c7d2fe; font-size:13px; font-weight:700;
                cursor:pointer; transition:background 0.15s;`;
            const disabledStyle = `padding:10px 24px; border-radius:8px; border:1px solid rgba(255,255,255,0.06);
                background:rgba(255,255,255,0.03); color:#555; font-size:13px; font-weight:700; cursor:default;`;

            const prevCh = document.createElement("button");
            prevCh.textContent = "\u25C0 Previous Chapter";
            if (idx > 0) {
                prevCh.style.cssText = btnStyle;
                prevCh.addEventListener("click", () => navigate(sameMangas[idx - 1].id));
            } else {
                prevCh.style.cssText = disabledStyle;
                prevCh.disabled = true;
            }

            const nextCh = document.createElement("button");
            nextCh.textContent = "Next Chapter \u25B6";
            if (idx < sameMangas.length - 1) {
                nextCh.style.cssText = btnStyle;
                nextCh.addEventListener("click", () => navigate(sameMangas[idx + 1].id));
            } else {
                nextCh.style.cssText = disabledStyle;
                nextCh.disabled = true;
            }

            bar.appendChild(prevCh);
            bar.appendChild(nextCh);
            return bar;
        }

        function renderPages() {
            imgContainer.innerHTML = "";
            const gap = parseInt(gapSlider.value, 10);

            if (currentDir === "down") {
                // Vertical scroll mode
                overlay.style.overflowY = "auto";
                overlay.style.overflowX = "hidden";
                imgContainer.style.display = "block";

                if (currentMode === "single") {
                    for (let i = 0; i < totalPages; i++) {
                        const img = document.createElement("img");
                        img.src = objectUrls[i];
                        img.style.cssText = `width:100%; display:block; margin-bottom:${gap}px;`;
                        imgContainer.appendChild(img);
                    }
                } else {
                    const spreads = buildSpreads();
                    for (const spread of spreads) {
                        const row = document.createElement("div");
                        row.style.cssText = `display:flex; justify-content:center; gap:${gap}px; margin-bottom:${gap}px;`;
                        for (const idx of spread) {
                            const img = document.createElement("img");
                            img.src = objectUrls[idx];
                            img.style.cssText = spread.length === 2 ? "width:50%; display:block;" : "width:100%; display:block;";
                            row.appendChild(img);
                        }
                        imgContainer.appendChild(row);
                    }
                }

                // Append chapter nav at bottom of scroll
                imgContainer.appendChild(buildEndNav());

                // Re-attach scroll progress
                overlay.onscroll = () => {
                    const viewMid = overlay.scrollTop + overlay.clientHeight / 2;
                    let pg = 1;
                    const children = imgContainer.children;
                    for (let i = 0; i < children.length; i++) {
                        if (children[i].offsetTop + children[i].offsetHeight / 2 <= viewMid) pg = i + 1;
                    }
                    if (currentMode === "single") {
                        progressEl.textContent = `Page ${pg} / ${totalPages}`;
                    } else {
                        const spreads = buildSpreads();
                        progressEl.textContent = `Spread ${pg} / ${spreads.length}`;
                    }
                };
            } else {
                // Horizontal smooth-scroll mode (left or right)
                overlay.style.overflowY = "hidden";
                overlay.style.overflowX = "hidden";
                overlay.onscroll = null;

                const isRTL = currentDir === "left";

                imgContainer.style.cssText = `
                    display: flex;
                    flex-direction: row;
                    height: 100vh;
                    width: 100vw;
                    max-width: 100vw;
                    overflow-x: auto;
                    overflow-y: hidden;
                    scroll-snap-type: x mandatory;
                    -webkit-overflow-scrolling: touch;
                    direction: ${isRTL ? "rtl" : "ltr"};
                `;

                const spreads = currentMode === "single"
                    ? objectUrls.map((_, i) => [i])
                    : buildSpreads();

                currentPage = Math.max(0, Math.min(currentPage, spreads.length - 1));

                for (const spread of spreads) {
                    const displayOrder = isRTL ? [...spread].reverse() : [...spread];
                    const slide = document.createElement("div");
                    slide.style.cssText = `
                        flex: 0 0 100vw;
                        width: 100vw;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        scroll-snap-align: start;
                        gap: ${gap}px;
                        direction: ltr;
                    `;
                    for (const idx of displayOrder) {
                        const img = document.createElement("img");
                        img.src = objectUrls[idx];
                        img.style.cssText = spread.length === 2
                            ? "max-height:100vh; max-width:50vw; object-fit:contain; user-select:none; -webkit-user-drag:none;"
                            : "max-height:100vh; max-width:100vw; object-fit:contain; user-select:none; -webkit-user-drag:none;";
                        slide.appendChild(img);
                    }
                    imgContainer.appendChild(slide);
                }

                // End-of-chapter navigation slide
                const endSlide = document.createElement("div");
                endSlide.style.cssText = `
                    flex: 0 0 100vw; width: 100vw; height: 100vh;
                    display: flex; align-items: center; justify-content: center;
                    scroll-snap-align: start; direction: ltr;
                `;
                endSlide.appendChild(buildEndNav());
                imgContainer.appendChild(endSlide);

                // Scroll to current page
                if (currentPage > 0) {
                    imgContainer.scrollLeft = currentPage * imgContainer.clientWidth * (isRTL ? -1 : 1);
                }

                // Track scroll position for progress
                imgContainer.addEventListener("scroll", () => {
                    const scrollPos = Math.abs(imgContainer.scrollLeft);
                    const slideW = imgContainer.clientWidth || 1;
                    const pg = Math.round(scrollPos / slideW);
                    currentPage = Math.max(0, Math.min(pg, spreads.length - 1));
                    if (currentMode === "single") {
                        const pageIdx = spreads[currentPage]?.[0];
                        progressEl.textContent = `Page ${(pageIdx ?? 0) + 1} / ${totalPages}`;
                    } else {
                        progressEl.textContent = `Spread ${currentPage + 1} / ${spreads.length}`;
                    }
                });
            }
        }

        overlay.appendChild(imgContainer);
        renderPages();

        // Keyboard navigation for horizontal modes
        const onKey = (e) => {
            if (currentDir === "down") return;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const isRTL = currentDir === "left";
                const goNext = currentDir === "right" ? e.key === "ArrowRight" : e.key === "ArrowLeft";
                const slideW = imgContainer.clientWidth || 1;
                const delta = goNext ? slideW : -slideW;
                imgContainer.scrollBy({ left: isRTL ? -delta : delta, behavior: "smooth" });
            }
        };
        document.addEventListener("keydown", onKey);

        document.body.appendChild(overlay);

        const cleanup = () => {
            objectUrls.forEach(u => URL.revokeObjectURL(u));
            overlay.remove();
            document.removeEventListener("keydown", onEsc);
            document.removeEventListener("keydown", onKey);
        };
        closeBtn.addEventListener("click", cleanup);
        const onEsc = (e) => { if (e.key === "Escape") cleanup(); };
        document.addEventListener("keydown", onEsc);
    }

    // Load offline list on startup
    refreshOfflineList();
    updateStorageIndicator();
    refreshScanlationList();

    // ============================================================
    //  IMPORT UTILS
    // ============================================================
    const log   = (...a) => DEBUG && console.log("[atsu-import]", ...a);
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function normTitle(s) {
        return (s ?? "").toString().toLowerCase()
            .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    }

    function splitSynonyms(s) {
        if (!s) return [];
        return s.split(",").map(x => x.trim()).filter(Boolean);
    }

    function parseCsvLine(line) {
        const out = []; let cur = "", inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
            else cur += ch;
        }
        out.push(cur);
        return out;
    }

    function parseCsv(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length);
        if (lines.length < 2) return [];
        const header = parseCsvLine(lines[0]).map(h => h.trim());
        return lines.slice(1).map(line => {
            const cols = parseCsvLine(line);
            const obj = {};
            header.forEach((h, j) => obj[h] = (cols[j] ?? "").trim());
            return obj;
        });
    }

    function comickDateToTs(s) {
        if (!s || s === "0000-00-00") return Date.now();
        const t = new Date(s + "T00:00:00").getTime();
        return Number.isFinite(t) ? t : Date.now();
    }

    function fmtMs(ms) {
        ms = Math.max(0, Math.floor(ms));
        const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
        if (h > 0) return `${h}h ${m}m ${ss}s`;
        if (m > 0) return `${m}m ${ss}s`;
        return `${ss}s`;
    }

    function computeThrottle(totalRows, estimatedProgressItems, mangaCount) {
        const p = Math.max(0, Number(estimatedProgressItems) || 0);
        let postDelay = 300;  // Reduced from 2500 — adaptive batching handles load
        if (p > 50) postDelay = 350;
        if (p > 200) postDelay = 400;
        if (p > 600) postDelay = 500;
        if (p > 1200) postDelay = 600;
        if (p > 2500) postDelay = 750;
        if (p > 5000) postDelay = 1000;
        if ((Number(mangaCount) || 0) > 120) postDelay = Math.max(postDelay, 500);
        if ((Number(mangaCount) || 0) > 250) postDelay = Math.max(postDelay, 700);
        let maxTitleTries = MAX_TITLE_TRIES;
        if (totalRows > 250) maxTitleTries = 10;
        if (totalRows > 500) maxTitleTries = 8;
        return { searchDelay: 20, postDelay, maxTitleTries };
    }

    function makeEtaTracker(totalMsPlanned) {
        const start = Date.now(); let doneMs = 0;
        const etaEl = panel.querySelector("#ai-eta");
        const set = msg => { if (etaEl) etaEl.textContent = msg; };
        return {
            bumpDone(ms) {
                doneMs += ms;
                set(`ETA: ${fmtMs(Math.max(0, totalMsPlanned - doneMs))} - Elapsed: ${fmtMs(Date.now() - start)}`);
            },
            setStage(stage) {
                set(`Stage: ${stage} - ETA: ${fmtMs(Math.max(0, totalMsPlanned - doneMs))} - Elapsed: ${fmtMs(Date.now() - start)}`);
            },
        };
    }

    // ============================================================
    //  IMPORT API CALLS
    // ============================================================
    function atsuSearchUrl(q) {
        return `/collections/manga/documents/search?${new URLSearchParams({
            q, limit: String(SEARCH_LIMIT),
            query_by: "title,englishTitle,otherNames",
            query_by_weights: "3,2,1",
            include_fields: "id,title,englishTitle,type,isAdult",
            num_typos: "4,3,2",
        })}`;
    }

    async function atsuSearch(q) {
        const res = await _origFetch(atsuSearchUrl(q), { credentials: "include" });
        if (!res.ok) return [];
        return ((await res.json()).hits || []).map(h => h.document).filter(Boolean);
    }

    function pickBestMatch(items, wantedTitle, wantedSyns) {
        const wanted = normTitle(wantedTitle);
        const synSet = new Set(wantedSyns.map(normTitle));
        let best = null, bestScore = -1;
        for (const it of items) {
            const t1 = normTitle(it.title), t2 = normTitle(it.englishTitle);
            let score = 0;
            if (t1 === wanted || t2 === wanted) score += 100;
            if (synSet.has(t1) || synSet.has(t2)) score += 70;
            if (t1.includes(wanted) || t2.includes(wanted) || wanted.includes(t1)) score += 25;
            if (score > bestScore) { bestScore = score; best = it; }
        }
        return bestScore >= 50 ? best : null;
    }

    async function findMangaId(title, synonyms, maxTries, searchDelay, eta) {
        for (const q of [title, ...synonyms].slice(0, maxTries)) {
            const items = await atsuSearch(q);
            await sleep(searchDelay); eta.bumpDone(searchDelay);
            const best = pickBestMatch(items, title, synonyms);
            if (best?.id) return best.id;
        }
        return null;
    }

    async function getAllChapters(mangaId) {
        const res = await _origFetch(`/api/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`, { credentials: "include" });
        return res.ok ? (await res.json()) : null;
    }

    function buildBestChapterMap(allChaptersResp) {
        const best = new Map();
        for (const c of (allChaptersResp?.chapters || [])) {
            const num = Number(c.number);
            if (!Number.isFinite(num)) continue;
            const prev = best.get(num);
            if (!prev || (Number(c.index) || 0) > (Number(prev.index) || 0)) best.set(num, c);
        }
        return best;
    }

    async function getMangaPage(mangaId) {
        const res = await _origFetch(`/api/manga/page?id=${encodeURIComponent(mangaId)}`, { credentials: "include" });
        if (!res.ok) return null;
        return (await res.json()).mangaPage || null;
    }

    async function syncBookmarksImport(events) {
        const res = await _origFetch("/api/user/syncBookmarks", {
            method: "POST", credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(events),
        });
        if (!res.ok) throw new Error(`syncBookmarks ${res.status}`);
        return res.json().catch(() => ({}));
    }

    async function syncProgressImport(progressItems) {
        const res = await _origFetch(PROGRESS_ENDPOINT, {
            method: "POST", credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ progress: progressItems, deletedChapters: [] }),
        });
        if (!res.ok) throw new Error(`syncProgress ${res.status}`);
        return res.json().catch(() => ({}));
    }

    function appendLog(msg) {
        const el = panel.querySelector("#ai-log");
        el.textContent += msg + "\n";
        el.scrollTop = el.scrollHeight;
    }

    // ============================================================
    //  MAIN IMPORT RUNNER
    // ============================================================
    async function runImport(csvText, doProgress, noDowngradeProgress, markPrevChapters) {
        const rows = parseCsv(csvText);
        let estProgressItems = doProgress ? rows.length : 0;
        if (doProgress && markPrevChapters) estProgressItems = rows.length * Math.min(80, MAX_PROGRESS_ITEMS_PER_MANGA);

        const throttle0 = computeThrottle(rows.length, estProgressItems, rows.length);
        let { searchDelay: SD, postDelay: PD, maxTitleTries: MTT } = throttle0;

        appendLog(`Loaded rows: ${rows.length}`);
        appendLog(`Search delay: ${SD}ms | POST delay: ${PD}ms`);
        appendLog(`Max title tries: ${MTT}`);
        appendLog(`No-downgrade: ${noDowngradeProgress ? "ON" : "OFF"} | Mark previous: ${markPrevChapters ? "ON" : "OFF"}`);
        appendLog("");

        const mangaIdCache = new Map(), mangaPageCache = new Map();
        const allChaptersCache = new Map(), bestChapterMapCache = new Map();

        const estPrepMs = rows.length * SD * 2;
        const estPostMs = (Math.ceil(rows.length / BOOKMARK_CHUNK_SIZE) + rows.length) * PD;
        const eta = makeEtaTracker(estPrepMs + estPostMs + rows.length * 250);

        async function cachedMangaId(row) {
            const key = normTitle(row.title || "");
            if (mangaIdCache.has(key)) return mangaIdCache.get(key);
            const id = await findMangaId(row.title || "", splitSynonyms(row.synonyms || ""), MTT, SD, eta);
            mangaIdCache.set(key, id); return id;
        }
        async function cachedMangaPage(id) {
            if (mangaPageCache.has(id)) return mangaPageCache.get(id);
            const mp = await getMangaPage(id);
            mangaPageCache.set(id, mp); await sleep(SD); eta.bumpDone(SD); return mp;
        }
        async function cachedBestMap(id) {
            if (bestChapterMapCache.has(id)) return bestChapterMapCache.get(id);
            if (!allChaptersCache.has(id)) {
                allChaptersCache.set(id, await getAllChapters(id));
                await sleep(SD); eta.bumpDone(SD);
            }
            const m = buildBestChapterMap(allChaptersCache.get(id));
            bestChapterMapCache.set(id, m); return m;
        }

        const bookmarkEvents = [];
        const progressByManga = new Map();
        const mangaIdSet = new Set();
        let skippedNoStatus = 0, skippedNoMatch = 0, skippedNoRead = 0;
        let skippedNoChapter = 0, skippedNoDowngrade = 0, totalProgressPlanned = 0;
        const baseTs = Date.now();

        eta.setStage("Searching + mapping");

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const atsuStatus = STATUS_MAP[(row.type || "").trim()];
            if (!atsuStatus) { skippedNoStatus++; continue; }

            const mangaId = await cachedMangaId(row);
            if (!mangaId) { skippedNoMatch++; appendLog(`No match: ${row.title}`); continue; }
            mangaIdSet.add(mangaId);

            const mangaPage = await cachedMangaPage(mangaId);
            const realType = mangaPage?.type || "Manga";

            bookmarkEvents.push({ mangaId, status: atsuStatus, synced: false, ts: baseTs + i, type: realType });

            if (doProgress) {
                const readNumRaw = (row.read || "").trim();
                if (!readNumRaw) { skippedNoRead++; continue; }
                const readNum = Number(readNumRaw);
                if (!Number.isFinite(readNum)) { skippedNoRead++; continue; }

                if (noDowngradeProgress) {
                    const existing = Number(mangaPage?.continueReading?.number);
                    if (Number.isFinite(existing) && existing > readNum) {
                        skippedNoDowngrade++;
                        appendLog(`Skip (higher exists): ${row.title} Atsu=${existing} > CSV=${readNum}`);
                        continue;
                    }
                }

                const bestMap = await cachedBestMap(mangaId);
                if (!bestMap.has(readNum)) { skippedNoChapter++; appendLog(`No ch.${readNum} for ${row.title}`); continue; }

                let numsToMark = Array.from(bestMap.keys()).filter(n => n <= readNum).sort((a, b) => a - b);
                if (!markPrevChapters) numsToMark = [readNum];
                else if (PREVIOUS_CHAPTER_WINDOW > 0) numsToMark = numsToMark.slice(-PREVIOUS_CHAPTER_WINDOW);
                if (numsToMark.length > MAX_PROGRESS_ITEMS_PER_MANGA) numsToMark = numsToMark.slice(-MAX_PROGRESS_ITEMS_PER_MANGA);

                let arr = progressByManga.get(mangaId);
                if (!arr) { arr = []; progressByManga.set(mangaId, arr); }
                const baseTsForSeries = comickDateToTs(row.last_read);

                for (let idx = 0; idx < numsToMark.length; idx++) {
                    if (totalProgressPlanned >= MAX_PROGRESS_ITEMS_TOTAL) break;
                    const c = bestMap.get(numsToMark[idx]);
                    if (!c?.id) continue;
                    const pages = Number(c.pageCount) || 1;
                    arr.push({
                        mangaScanlationId: c.scanlationMangaId, mangaId,
                        chapterId: c.id, page: Math.max(0, pages - 1), frac: 1,
                        pages, ts: baseTsForSeries + idx,
                        strip: !["manga"].includes((realType || "").toLowerCase()),
                    });
                    totalProgressPlanned++;
                }
            }

            if (bookmarkEvents.length % 15 === 0) appendLog(`Prepared ${bookmarkEvents.length} items...`);
        }

        const throttle = computeThrottle(rows.length, totalProgressPlanned, mangaIdSet.size);
        PD = throttle.postDelay;

        appendLog("");
        appendLog(`Series found: ${mangaIdSet.size} | Bookmarks: ${bookmarkEvents.length} | Progress items: ${totalProgressPlanned}`);
        appendLog(`Skipped - no status: ${skippedNoStatus}, no match: ${skippedNoMatch}, no read: ${skippedNoRead}`);
        appendLog(`Skipped - no chapter: ${skippedNoChapter}, higher exists: ${skippedNoDowngrade}`);
        appendLog("");

        eta.setStage("Posting bookmarks");
        let errB = 0, postedB = 0;
        
        // Adaptive batching for bookmarks
        const BOOKMARK_BATCH_SIZE = 20;
        const MIN_BOOKMARK_BATCH = 1;
        
        for (let i = 0; i < bookmarkEvents.length; ) {
            const batch = bookmarkEvents.slice(i, i + BOOKMARK_BATCH_SIZE);
            let success = false;
            let currentSize = BOOKMARK_BATCH_SIZE;
            
            while (!success && currentSize >= MIN_BOOKMARK_BATCH) {
                try {
                    const retryBatch = bookmarkEvents.slice(i, i + currentSize);
                    await syncBookmarksImport(retryBatch);
                    success = true;
                    postedB += retryBatch.length;
                    i += currentSize;
                    appendLog(`Bookmarks: ${postedB}/${bookmarkEvents.length}`);
                    
                    // Try to increase batch size if we reduced it
                    if (currentSize < BOOKMARK_BATCH_SIZE) {
                        currentSize = Math.min(currentSize * 2, BOOKMARK_BATCH_SIZE);
                    }
                } catch (e) {
                    if (currentSize > MIN_BOOKMARK_BATCH) {
                        currentSize = Math.floor(currentSize / 2);
                        if (currentSize < MIN_BOOKMARK_BATCH) currentSize = MIN_BOOKMARK_BATCH;
                        appendLog(`Bookmark batch failed, retrying with size ${currentSize} in 5s...`);
                        await sleep(5000); // 5 second delay before retry
                    } else {
                        // At size 1 - wait 1 minute and retry
                        appendLog(`Bookmark batch failed at size 1, waiting 60s before retry...`);
                        await sleep(60000); // 1 minute delay
                        // Loop continues, will try again with size 1
                    }
                }
            }
        }
        appendLog(`Bookmarks done. Errors: ${errB}`);

        if (!doProgress || progressByManga.size === 0) {
            appendLog("Continue reading import skipped.");
            eta.setStage("Done"); return;
        }

        appendLog("");
        appendLog(`Syncing progress (${progressByManga.size} series)...`);
        eta.setStage("Posting progress");
        let errM = 0, postedM = 0;
        
        // Adaptive batching for progress items (same approach as mark chapters)
        const INITIAL_BATCH_SIZE = 50;
        const MIN_BATCH_SIZE = 1;
        
        for (const [mangaId, items] of progressByManga) {
            if (!items.length) continue;
            
            let itemsPosted = 0;
            let currentBatchSize = INITIAL_BATCH_SIZE;
            
            for (let i = 0; i < items.length; ) {
                let success = false;
                
                // Retry logic: keep halving batch size until it succeeds
                while (!success && currentBatchSize >= MIN_BATCH_SIZE) {
                    const batch = items.slice(i, i + currentBatchSize);
                    try {
                        await syncProgressImport(batch);
                        success = true;
                        itemsPosted += batch.length;
                        i += currentBatchSize;
                        
                        // Try to increase batch size back to initial if we reduced it
                        if (currentBatchSize < INITIAL_BATCH_SIZE) {
                            currentBatchSize = Math.min(currentBatchSize * 2, INITIAL_BATCH_SIZE);
                            appendLog(`Progress batch succeeded, increasing size to ${currentBatchSize}`);
                        }
                    } catch (e) {
                        if (currentBatchSize > MIN_BATCH_SIZE) {
                            // Halve the batch size and retry with 5 second delay
                            currentBatchSize = Math.floor(currentBatchSize / 2);
                            if (currentBatchSize < MIN_BATCH_SIZE) currentBatchSize = MIN_BATCH_SIZE;
                            appendLog(`Progress batch failed, retrying with size ${currentBatchSize} in 5s...`);
                            await sleep(5000); // 5 second delay before retry
                        } else {
                            // At size 1 - wait 1 minute and retry
                            appendLog(`Progress batch failed at size 1, waiting 60s before retry...`);
                            await sleep(60000); // 1 minute delay
                            // Loop continues, will try again with size 1
                        }
                    }
                }
            }
            
            postedM++;
            appendLog(`Progress: ${postedM}/${progressByManga.size} - ${itemsPosted} items`);
            await sleep(PD); eta.bumpDone(PD);
        }

        appendLog("");
        appendLog(`Done. Progress errors: ${errM}`);
        appendLog("Refresh your bookmarks page to see Continue reading update.");
        eta.setStage("Done");
    }

    // ============================================================
    //  IMPORT BUTTON WIRING
    // ============================================================
    const aiRunBtn = panel.querySelector("#ai-run");
    aiRunBtn.addEventListener("click", async () => {
        // Prevent double-click by disabling button
        if (aiRunBtn.disabled) return;
        aiRunBtn.disabled = true;
        
        panel.querySelector("#ai-log").textContent = "";
        panel.querySelector("#ai-eta").textContent = "ETA: -";

        const file = panel.querySelector("#ai-file").files?.[0];
        if (!file) {
            appendLog("Pick your Comick CSV first.");
            aiRunBtn.disabled = false;
            return;
        }

        const doProgress = panel.querySelector("#ai-progress").checked;
        const noDown     = panel.querySelector("#ai-nodown").checked;
        const markPrev   = panel.querySelector("#ai-prev").checked;

        appendLog(`File: ${file.name}`);
        appendLog(`Import Continue: ${doProgress ? "ON" : "OFF"}`);
        appendLog(`Don't overwrite higher: ${noDown ? "ON" : "OFF"}`);
        appendLog(`Mark previous completed: ${markPrev ? "ON" : "OFF"}`);
        appendLog("");

        try {
            await runImport(await file.text(), doProgress, noDown, markPrev);
        } catch (e) {
            appendLog(`Fatal: ${e.message || e}`);
        } finally {
            aiRunBtn.disabled = false;
        }
    });

})();