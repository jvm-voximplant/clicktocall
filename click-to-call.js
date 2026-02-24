/**
 * click-to-call.js
 * Voximplant WebSDK – Click To Call integration
 *
 * Platform config:
 *   Application : clicktocall.jvega.n2.voximplant.com
 *   User        : guest
 *   Password    : demo123
 *   Account     : jvega
 *   Rule        : ClickToCallRule  (calls username "support" which triggers the rule)
 */

(function () {
    'use strict';

    // ─── Configuration ───────────────────────────────────────────────────────
    const CONFIG = {
        account:     'jvega',
        appname:     'clicktocall',
        username:    'guest',
        password:    'demo123',
        // The callee username must match your Routing Rule pattern in Platform.
        // ClickToCallRule should be set to match calls to "support" (or adjust to your rule pattern).
        callTo:      'support',
        node:        'n2'
    };
    // ─────────────────────────────────────────────────────────────────────────

    let sdk         = null;
    let currentCall = null;
    let sdkReady    = false;
    let sdkLoading  = false;

    // ── UI helpers ────────────────────────────────────────────────────────────
    // Elements are looked up on demand (not at script load) to avoid null refs
    // when the script tag appears before the toast div in the HTML.

    function setBtn(state) {
        const btn   = document.getElementById('ctc-btn');
        const label = document.getElementById('ctc-label');
        if (!btn || !label) return;
        btn.classList.remove('calling', 'connecting');
        btn.disabled = false;
        if (state === 'connecting') {
            btn.classList.add('connecting');
            btn.disabled = true;
            label.textContent = 'Connecting\u2026';
        } else if (state === 'calling') {
            btn.classList.add('calling');
            label.textContent = 'Hang Up';
        } else {
            label.textContent = 'Click To Call';
        }
    }

    function showToast(msg, status) {
        const toast    = document.getElementById('ctc-toast');
        const toastMsg = document.getElementById('ctc-toast-msg');
        if (!toast || !toastMsg) return;
        toast.className = 'show status-' + status;
        toastMsg.textContent = msg;
        if (status === 'ended' || status === 'error') {
            setTimeout(hideToast, 3500);
        }
    }

    function hideToast() {
        const toast = document.getElementById('ctc-toast');
        if (!toast) return;
        toast.className = '';
    }

    // ── SDK initialisation ────────────────────────────────────────────────────
    function initSDK() {
        return new Promise((resolve, reject) => {
            if (sdkReady) { resolve(); return; }
            if (sdkLoading) { reject(new Error('SDK already loading')); return; }
            sdkLoading = true;

            sdk = VoxImplant.getInstance();

            sdk.on(VoxImplant.Events.SDKReady, () => {
                console.log('[CTC] SDK ready');
                loginSDK().then(resolve).catch(reject);
            });

            sdk.on(VoxImplant.Events.ConnectionEstablished, () => {
                console.log('[CTC] Connection established');
            });

            sdk.on(VoxImplant.Events.ConnectionFailed, (e) => {
                console.error('[CTC] Connection failed', e);
                sdkLoading = false;
                reject(new Error('Connection failed'));
            });

            sdk.on(VoxImplant.Events.ConnectionClosed, () => {
                console.warn('[CTC] Connection closed');
                sdkReady  = false;
                sdkLoading = false;
            });

            sdk.init({
                micRequired: true,
                videoSupport: false,
                progressTone: true,
                progressToneCountry: 'US'
            }).catch(reject);
        });
    }

    function loginSDK() {
        return new Promise((resolve, reject) => {
            const loginUri = 'guest@clicktocall.jvega.n2.voximplant.com';

            sdk.on(VoxImplant.Events.AuthResult, (e) => {
                if (e.result) {
                    console.log('[CTC] Logged in as', loginUri);
                    sdkReady  = true;
                    sdkLoading = false;
                    resolve();
                } else {
                    console.error('[CTC] Auth failed, code:', e.code);
                    sdkLoading = false;
                    reject(new Error('Auth failed – code ' + e.code));
                }
            });

            sdk.connect().then(() => {
                sdk.login(loginUri, CONFIG.password);
            }).catch(reject);
        });
    }

    // ── Call handling ─────────────────────────────────────────────────────────
    function startCall() {
        // Callee: callTo@appname.account.voximplant.com
        const destination = 'support@clicktocall.jvega.n2.voximplant.com';
        console.log('[CTC] Calling', destination);

        currentCall = sdk.call({
            number: destination,
            video: { sendVideo: false, receiveVideo: false }
        });

        currentCall.on(VoxImplant.CallEvents.Connected, () => {
            console.log('[CTC] Call connected');
            setBtn('calling');
            showToast('Call connected – you are speaking with an agent', 'calling');
        });

        currentCall.on(VoxImplant.CallEvents.Progress, () => {
            console.log('[CTC] Ringing…');
            showToast('Ringing… please wait', 'connecting');
        });

        currentCall.on(VoxImplant.CallEvents.Disconnected, () => {
            console.log('[CTC] Call ended');
            currentCall = null;
            setBtn('idle');
            showToast('Call ended', 'ended');
        });

        currentCall.on(VoxImplant.CallEvents.Failed, (e) => {
            console.error('[CTC] Call failed', e);
            currentCall = null;
            setBtn('idle');
            showToast('Call failed: ' + (e.reason || 'unknown error'), 'error');
        });
    }

    function hangUp() {
        if (currentCall) {
            currentCall.hangup();
        }
    }

    // ── Public entry point (called by button onclick) ─────────────────────────
    window.clickToCall = function () {
        // If a call is active → hang up
        if (currentCall) {
            hangUp();
            return;
        }

        setBtn('connecting');
        showToast('Initialising connection…', 'connecting');

        const doCall = () => {
            showToast('Placing call…', 'connecting');
            startCall();
        };

        if (sdkReady) {
            doCall();
        } else {
            initSDK()
                .then(doCall)
                .catch((err) => {
                    console.error('[CTC] Init error:', err);
                    setBtn('idle');
                    showToast('Could not connect: ' + err.message, 'error');
                });
        }
    };
})();
