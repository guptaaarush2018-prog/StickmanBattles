// ============================================================
// SMB ERROR BOUNDARY — smb-errorboundary.js
// ============================================================
// Classifies runtime errors as MINOR (game continues with a
// warning toast) or MAJOR (hard crash overlay, must reset).
//
// Minor  — isolated rendering/particle/HUD failures that don't
//          corrupt core state.  Game loop keeps running.
// Major  — corrupted critical state (players, arena, loop) that
//          would cause infinite crashing.  Loop is stopped.
//
// Escalation: 3+ minor errors from the same source within a
// session automatically escalate to a major crash.
// ============================================================

const ErrorBoundary = (() => {
  // ── Error classification ──────────────────────────────────
  // Keywords that flag a MAJOR crash regardless of origin.
  const MAJOR_PATTERNS = [
    /cannot read prop/i,
    /is not a function/i,
    /players.*undefined/i,
    /currentArena.*undefined/i,
    /cannot set prop/i,
    /stack overflow/i,
    /maximum call stack/i,
    /out of memory/i,
  ];

  // Source file fragments considered "cosmetic" — failures here
  // are usually minor (don't break physics or win conditions).
  const MINOR_SOURCES = [
    'smb-particles', 'smb-drawing', 'smb-achievements',
    'smb-audio', 'smb-director', 'smb-debug',
    'smb-cinematics', 'smb-finishers',
  ];

  // Crash counter: source → count
  const _errorCounts = {};
  const ESCALATE_AFTER = 3; // minor errors from same source before escalation

  let _majorShown  = false; // only one hard crash overlay at a time
  let _minorActive = false; // debounce minor toasts

  // ── DOM creation ─────────────────────────────────────────
  function _ensureStyles() {
    if (document.getElementById('_ebStyles')) return;
    const s = document.createElement('style');
    s.id = '_ebStyles';
    s.textContent = `
      #_ebMajor {
        position:fixed;inset:0;z-index:99999;
        background:rgba(4,0,12,0.97);
        display:flex;align-items:center;justify-content:center;
        font-family:'Segoe UI',Arial,sans-serif;
        animation:_ebFadeIn 0.25s ease;
      }
      #_ebMinorToast {
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        z-index:99998;
        background:rgba(20,10,40,0.95);
        border:1.5px solid rgba(255,180,50,0.55);
        border-radius:10px;padding:10px 18px;
        font-family:'Segoe UI',Arial,sans-serif;
        font-size:0.78rem;color:#ffcc66;
        box-shadow:0 4px 24px rgba(0,0,0,0.7);
        max-width:min(460px,90vw);text-align:center;
        animation:_ebFadeIn 0.2s ease;
        pointer-events:none;
      }
      @keyframes _ebFadeIn { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      #_ebMajor > div { animation:_ebFadeIn 0.3s ease; }
    `;
    document.head.appendChild(s);
  }

  function showMajor(msg, stack) {
    if (_majorShown) return;
    _majorShown = true;
    // Stop the game loop immediately
    if (typeof gameRunning !== 'undefined') {
      try { gameRunning = false; } catch(e) {}
    }
    _ensureStyles();
    const div = document.createElement('div');
    div.id = '_ebMajor';
    const shortStack = (stack || '')
      .split('\n')
      .filter(l => l.includes('smb-') || l.includes('Stickman'))
      .slice(0, 4)
      .join('\n')
      .trim();
    div.innerHTML = `
      <div style="
        background:linear-gradient(160deg,#0a001a,#120028);
        border:1.5px solid rgba(255,60,60,0.45);
        border-radius:18px;padding:36px 40px 28px;
        width:min(520px,92vw);
        box-shadow:0 8px 60px rgba(200,0,0,0.25),0 0 120px rgba(100,0,200,0.15);
        text-align:center;color:#ddd;">
        <div style="font-size:2.8rem;margin-bottom:10px;">💥</div>
        <div style="font-size:1.25rem;font-weight:800;color:#ff6666;letter-spacing:0.5px;margin-bottom:8px;">
          Critical Error
        </div>
        <div style="font-size:0.82rem;color:#aaa;margin-bottom:16px;line-height:1.55;">
          The game encountered a fatal error and had to stop.<br>
          Your progress in this match has been lost.
        </div>
        <div style="background:rgba(0,0,0,0.5);border-radius:8px;padding:10px 14px;
          font-family:monospace;font-size:0.68rem;color:#ff9999;text-align:left;
          margin-bottom:20px;max-height:90px;overflow-y:auto;word-break:break-all;
          border:1px solid rgba(255,80,80,0.2);">
          ${_escHtmlEB(msg)}<br>
          ${shortStack ? '<span style="opacity:0.6">' + _escHtmlEB(shortStack) + '</span>' : ''}
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button onclick="ErrorBoundary.hardReset()"
            style="background:rgba(255,60,60,0.2);border:1.5px solid rgba(255,80,80,0.6);
            color:#ff8888;border-radius:9px;padding:10px 24px;cursor:pointer;
            font-family:inherit;font-size:0.88rem;font-weight:700;
            transition:background 0.15s;">
            🔄 Reset to Menu
          </button>
          <button onclick="ErrorBoundary.reloadPage()"
            style="background:rgba(100,60,255,0.15);border:1.5px solid rgba(120,80,255,0.4);
            color:#bb99ff;border-radius:9px;padding:10px 24px;cursor:pointer;
            font-family:inherit;font-size:0.88rem;">
            ↺ Reload Game
          </button>
        </div>
      </div>`;
    document.body.appendChild(div);
  }

  function showMinor(msg, source) {
    if (_minorActive) return;
    _minorActive = true;
    _ensureStyles();
    // Remove any existing toast
    document.getElementById('_ebMinorToast')?.remove();
    const toast = document.createElement('div');
    toast.id = '_ebMinorToast';
    const src = source ? source.split('/').pop().replace(/\?.*/, '') : 'unknown';
    toast.innerHTML = `
      ⚠️ &nbsp;<b>Non-fatal error</b> in <code style="font-size:0.72rem;color:#ffee99;">${_escHtmlEB(src)}</code>
      — some effects may be missing.<br>
      <span style="opacity:0.65;font-size:0.71rem;">${_escHtmlEB(msg.slice(0, 120))}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
      _minorActive = false;
    }, 5000);
  }

  // ── Classification logic ──────────────────────────────────
  function classify(message, source, stack) {
    // Always major if message matches a critical pattern
    for (const pat of MAJOR_PATTERNS) {
      if (pat.test(message)) return 'major';
    }
    // Source-based: cosmetic files start as minor
    const srcStr = (source || '') + (stack || '');
    const isMinorSource = MINOR_SOURCES.some(s => srcStr.includes(s));
    if (!isMinorSource) return 'major';

    // Escalate after repeated failures from same file
    const key = (source || 'unknown').split('/').pop().slice(0, 40);
    _errorCounts[key] = (_errorCounts[key] || 0) + 1;
    if (_errorCounts[key] >= ESCALATE_AFTER) return 'major';

    return 'minor';
  }

  // ── Public handle ─────────────────────────────────────────
  function handle(message, source, lineno, colno, errorObj) {
    // Ignore cross-origin errors we can't inspect
    if (!message || message === 'Script error.') return false;
    const stack = errorObj && errorObj.stack ? errorObj.stack : '';
    const level = classify(message, source || '', stack);
    if (level === 'major') {
      showMajor(message, stack);
    } else {
      showMinor(message, source || '');
    }
    // Return true to suppress the default browser error log for minor errors
    return level === 'minor';
  }

  // ── Actions ───────────────────────────────────────────────
  function hardReset() {
    document.getElementById('_ebMajor')?.remove();
    _majorShown = false;
    try {
      gameRunning = false;
      if (typeof backToMenu === 'function') backToMenu();
    } catch(e) {
      // If backToMenu itself fails, reload
      window.location.reload();
    }
  }

  function reloadPage() {
    window.location.reload();
  }

  // ── Helpers ───────────────────────────────────────────────
  function _escHtmlEB(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Game-loop wrapper ─────────────────────────────────────
  // Call this instead of raw requestAnimationFrame(gameLoop) to get
  // per-frame error catching.  Replace gameLoop's own rAF calls.
  function wrapLoop(loopFn) {
    function safeFrame(ts) {
      try {
        loopFn(ts);
      } catch(err) {
        const msg   = err && err.message ? err.message : String(err);
        const stack = err && err.stack   ? err.stack   : '';
        const level = classify(msg, stack, stack);
        if (level === 'major') {
          showMajor(msg, stack);
          // Don't reschedule — hard stop
          return;
        } else {
          showMinor(msg, '(game loop)');
          // Minor: keep the loop alive, skip this frame
          requestAnimationFrame(safeFrame);
        }
      }
    }
    return safeFrame;
  }

  return { handle, hardReset, reloadPage, showMajor, showMinor, wrapLoop, classify };
})();

// ── Global error hook ─────────────────────────────────────────
window.onerror = function(message, source, lineno, colno, errorObj) {
  // Don't double-handle errors that come from within the boundary itself
  if (source && source.includes('smb-errorboundary')) return false;
  return ErrorBoundary.handle(message, source, lineno, colno, errorObj);
};

window.onunhandledrejection = function(event) {
  const msg = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason || 'Unhandled promise rejection');
  const stack = event.reason instanceof Error ? event.reason.stack : '';
  ErrorBoundary.handle(msg, '', 0, 0, { stack });
};
