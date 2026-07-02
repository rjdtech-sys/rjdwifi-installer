/**
 * NEXIFI PISOWIFI Portal - Vanilla JavaScript
 * Fully Wired to Backend System
 */

(function() {
  'use strict';

  // ─── Configuration ───
  const API_BASE = '/api';
  const POLL_INTERVAL = 5000;

  function getClientIdentity() {
    let identity = localStorage.getItem('rjd_client_identity') || '';
    if (!identity) {
      identity = self.crypto && typeof self.crypto.randomUUID === 'function'
        ? self.crypto.randomUUID()
        : `rjd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('rjd_client_identity', identity);
    }
    return identity;
  }

  // ─── State ───
  let currentSession = null;
  let pollTimer = null;
  let countdownTimer = null;
  let clientIp = '';
  let clientMac = '';
  let clientVlanId = null;
  let isOnline = null;
  let rates = [];
  let portalConfig = null;
  let creditPesos = 0;
  let creditMinutes = 0;
  let selectedSlot = 'main';
  let coinSlotLockId = null;
  let reservedSlot = null;
  let isRevoked = false;
  let canInsertCoin = true;
  let availableSlots = [];
  let userHasSelectedSlot = false;
  let freeInternetConfig = { enabled: false, minutes: 0, message: '', cooldownDays: 1 };
  let isClaimingFreeInternet = false;

  // ─── Coin Modal State ───
  let socket = null;
  let coinTimeout = null;
  let coinTotal = 0;
  let coinMinutes = 0;
  let coinMode = 'internet'; // 'internet' or 'credit'
  let coinCountdownTimer = null;
  let coinCountdownSeconds = 60;
  let insertCoinAudio = null;

  // ─── Chat State ───
  let chatSocket = null;
  let chatOpen = false;
  let chatUnreadCount = 0;

  // ── DOM Elements ───
  const elements = {
    splash: document.getElementById('splash'),
    portal: document.getElementById('portal'),
    portalTitle: document.getElementById('portal-title'),
    portalSubtitle: document.getElementById('portal-subtitle'),
    portalHeader: document.getElementById('portal-header'),
    customCss: document.getElementById('portal-custom-css'),
    customHtmlTop: document.getElementById('custom-html-top'),
    customHtmlBottom: document.getElementById('custom-html-bottom'),
    footerText: document.getElementById('footer-text'),
    statusMessage: document.getElementById('status-message'),
    statusText: document.getElementById('status-text'),
    sessionView: document.getElementById('session-view'),
    loginView: document.getElementById('login-view'),
    sessionTimer: document.getElementById('session-timer'),
    statusDot: document.getElementById('status-dot'),
    statusLabel: document.getElementById('status-label'),
    deviceIp: document.getElementById('device-ip'),
    deviceMac: document.getElementById('device-mac'),
    creditDisplay: document.getElementById('credit-display'),
    creditPesos: document.getElementById('credit-pesos'),
    loginDeviceIp: document.getElementById('login-device-ip'),
    loginDeviceMac: document.getElementById('login-device-mac'),
    loginCreditDisplay: document.getElementById('login-credit-display'),
    loginCreditPesos: document.getElementById('login-credit-pesos'),
    onlineStatus: document.getElementById('online-status'),
    onlineDot: document.getElementById('online-dot'),
    onlineLabel: document.getElementById('online-label'),
    coinslotSelector: document.getElementById('coinslot-selector'),
    coinslotSelect: document.getElementById('coinslot-select'),
    btnInsertCoin: document.getElementById('btn-insert-coin'),
    btnUseCredit: document.getElementById('btn-use-credit'),
    btnViewRates: document.getElementById('btn-view-rates'),
    btnProceed: document.getElementById('btn-proceed'),
    btnPause: document.getElementById('btn-pause'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnAddTime: document.getElementById('btn-add-time'),
    btnViewRatesSession: document.getElementById('btn-view-rates-session'),
    btnRestore: document.getElementById('btn-restore'),
    btnCloseRates: document.getElementById('btn-close-rates'),
    ratesModal: document.getElementById('rates-modal'),
    ratesList: document.getElementById('rates-list'),
    coinModal: document.getElementById('coin-modal'),
    btnCancelCoin: document.getElementById('btn-cancel-coin'),
    btnActionCoin: document.getElementById('btn-action-coin'),
    btnModeInternet: document.getElementById('btn-mode-internet'),
    btnModeCredit: document.getElementById('btn-mode-credit'),
    coinModalSubtitle: document.getElementById('coin-modal-subtitle'),
    coinTotalAmount: document.getElementById('coin-total-amount'),
    coinTotalTime: document.getElementById('coin-total-time'),
    coinTimeBox: document.getElementById('coin-time-box'),
    coinCountdown: document.getElementById('coin-countdown'),
    voucherModal: document.getElementById('voucher-modal'),
    voucherCode: document.getElementById('voucher-code'),
    btnActivateVoucher: document.getElementById('btn-activate-voucher'),
    btnCloseVoucher: document.getElementById('btn-close-voucher'),
    errorMessage: document.getElementById('error-message'),
    errorText: document.getElementById('error-text'),
    audioInsertCoin: document.getElementById('audio-insert-coin'),
    audioCoinDrop: document.getElementById('audio-coin-drop'),
    audioConnected: document.getElementById('audio-connected'),
    portalBgLayer: document.getElementById('portal-bg-layer'),
    portalBgOverlay: document.getElementById('portal-bg-overlay'),
    // Revoked banner
    revokedBanner: document.getElementById('revoked-banner'),
    // Free Internet
    freeInternetCard: document.getElementById('free-internet-card'),
    freeInternetMessage: document.getElementById('free-internet-message'),
    freeInternetError: document.getElementById('free-internet-error'),
    freeInternetErrorText: document.getElementById('free-internet-error-text'),
    btnClaimFree: document.getElementById('btn-claim-free'),
    btnClaimText: document.getElementById('btn-claim-text'),
    freeInternetCooldown: document.getElementById('free-internet-cooldown'),
    // Inline Voucher Card
    voucherCard: document.getElementById('voucher-card'),
    voucherForm: document.getElementById('voucher-form'),
    voucherCodeInline: document.getElementById('voucher-code-inline'),
    btnActivateVoucherInline: document.getElementById('btn-activate-voucher-inline'),
    // Chat Widget
    chatToggleBtn: document.getElementById('chat-toggle-btn'),
    chatToggleIcon: document.getElementById('chat-toggle-icon'),
    chatUnreadBadge: document.getElementById('chat-unread-badge'),
    chatPanel: document.getElementById('chat-panel'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatSendBtn: document.getElementById('chat-send-btn'),
    chatCloseBtn: document.getElementById('chat-close-btn')
  };

  // ─── API Functions ───

  async function fetchPortalConfig() {
    try {
      const response = await fetch(`${API_BASE}/portal/config`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return null;

      const config = await response.json();
      return config;
    } catch (error) {
      console.error('[Portal] Config fetch error:', error);
      return null;
    }
  }

  async function checkSession() {
    try {
      const response = await fetch(`${API_BASE}/whoami`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-RJD-Client-ID': getClientIdentity()
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Portal] Session check error:', error);
      return null;
    }
  }

  async function fetchMySession() {
    try {
      const response = await fetch(`${API_BASE}/sessions/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Portal] Fetch session error:', error);
      return null;
    }
  }

  async function fetchRates() {
    try {
      const response = await fetch(`${API_BASE}/rates`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.rates || data || [];
    } catch (error) {
      console.error('[Portal] Rates fetch error:', error);
      return [];
    }
  }

  async function checkInternetStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch('/api/network/internet-status', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return false;

      const data = await response.json();
      return data && typeof data.online === 'boolean' ? data.online : false;
    } catch (error) {
      return false;
    }
  }

  async function reserveCoinSlot(slot) {
    try {
      const response = await fetch(`${API_BASE}/coinslot/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Reserve error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async function releaseCoinSlot(slot, lockId) {
    try {
      await fetch(`${API_BASE}/coinslot/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, lockId })
      });
    } catch (error) {
      console.error('[Portal] Release error:', error);
    }
  }

  async function heartbeatCoinSlot(slot, lockId) {
    try {
      await fetch(`${API_BASE}/coinslot/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, lockId })
      });
    } catch (error) {
      console.error('[Portal] Heartbeat error:', error);
    }
  }

  async function addCredit(pesos, minutes) {
    try {
      const payload = { pesos };
      if (typeof minutes === 'number') payload.minutes = minutes;
      const response = await fetch(`${API_BASE}/credits/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (error) {
      console.error('[Portal] Add credit error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async function startInternetSession(minutes, pesos, slot, lockId) {
    try {
      const response = await fetch(`${API_BASE}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, pesos, slot, lockId })
      });
      return await response.json();
    } catch (error) {
      console.error('[Portal] Start session error:', error);
      return { error: 'Network error' };
    }
  }

  async function activateVoucher(code) {
    try {
      const response = await fetch(`${API_BASE}/voucher/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Voucher error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async function pauseSession(token) {
    try {
      const response = await fetch(`${API_BASE}/session/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Pause error:', error);
      return { success: false };
    }
  }

  async function resumeSession(token) {
    try {
      const response = await fetch(`${API_BASE}/session/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      return await response.json();
    } catch (error) {
      console.error('[Portal] Resume error:', error);
      return { success: false };
    }
  }

  async function fetchAvailableSlots() {
    try {
      const response = await fetch(`${API_BASE}/nodemcu/available`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('[Portal] Available slots error:', error);
      return [];
    }
  }

  async function fetchFreeInternetConfig() {
    try {
      const response = await fetch(`${API_BASE}/free-internet/config`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) return { enabled: false, minutes: 0, message: '', cooldownDays: 1 };
      return await response.json();
    } catch (error) {
      console.error('[Portal] Free internet config error:', error);
      return { enabled: false, minutes: 0, message: '', cooldownDays: 1 };
    }
  }

  async function claimFreeInternet() {
    try {
      const response = await fetch(`${API_BASE}/free-internet/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('[Portal] Claim free internet error:', error);
      return { error: error.message || 'Network error' };
    }
  }

  async function checkNodeMCUStatus(macAddress) {
    try {
      const response = await fetch(`${API_BASE}/nodemcu/status/${macAddress}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) return { online: false };
      return await response.json();
    } catch (error) {
      console.error('[Portal] NodeMCU status error:', error);
      return { online: false };
    }
  }

  async function useCredit(pesos) {
    try {
      const response = await fetch(`${API_BASE}/credits/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesos })
      });
      return await response.json();
    } catch (error) {
      console.error('[Portal] Use credit error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // ── UI Functions ───

  function applyPortalConfig(config) {
    if (!config) return;

    portalConfig = config;

    // Apply title
    if (config.title) {
      elements.portalTitle.textContent = config.title;
      document.title = config.title;
      if (elements.footerText) {
        elements.footerText.textContent = `Powered by ${config.title}`;
      }
    }

    // Apply subtitle
    if (config.subtitle) {
      elements.portalSubtitle.textContent = config.subtitle;
    }

    // Apply colors
    if (config.primaryColor) {
      document.documentElement.style.setProperty('--primary', config.primaryColor);
      if (elements.portalHeader) {
        elements.portalHeader.style.background = `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor || config.primaryColor} 100%)`;
      }
    }

    if (config.secondaryColor) {
      document.documentElement.style.setProperty('--primary-dark', config.secondaryColor);
    }

    if (config.backgroundColor) {
      document.documentElement.style.setProperty('--bg', config.backgroundColor);
    }

    if (config.textColor) {
      document.documentElement.style.setProperty('--text-main', config.textColor);
    }

    // Apply custom CSS
    if (config.customCss && elements.customCss) {
      elements.customCss.textContent = config.customCss;
    }

    // Apply custom HTML
    if (config.customHtmlTop && elements.customHtmlTop) {
      elements.customHtmlTop.innerHTML = config.customHtmlTop;
    }

    if (config.customHtmlBottom && elements.customHtmlBottom) {
      elements.customHtmlBottom.innerHTML = config.customHtmlBottom;
    }

    // Apply audio
    if (config.insertCoinAudio && elements.audioInsertCoin) {
      elements.audioInsertCoin.src = config.insertCoinAudio;
    }

    if (config.coinDropAudio && elements.audioCoinDrop) {
      elements.audioCoinDrop.src = config.coinDropAudio;
    }

    if (config.connectedAudio && elements.audioConnected) {
      elements.audioConnected.src = config.connectedAudio;
    }

    // ── Apply background image / gradient ──
    const hasBgImage = !!(config.backgroundImage);
    const hasBgStyle = !!(config.backgroundStyle);
    const hasBg = hasBgImage || hasBgStyle;

    if (hasBg) {
      document.body.classList.add('has-portal-bg');

      if (elements.portalBgLayer) {
        if (hasBgImage) {
          elements.portalBgLayer.style.backgroundImage = `url('${config.backgroundImage}')`;
        } else if (hasBgStyle) {
          elements.portalBgLayer.style.backgroundImage = config.backgroundStyle;
        }
      }

      if (elements.portalBgOverlay) {
        const overlayColor = config.overlayColor || 'rgba(0,0,0,0.5)';
        const overlayOpacity = (typeof config.overlayOpacity === 'number' && config.overlayOpacity > 0)
          ? config.overlayOpacity : 0.5;
        elements.portalBgOverlay.style.backgroundColor = overlayColor;
        elements.portalBgOverlay.style.opacity = String(overlayOpacity);
      }
    } else {
      document.body.classList.remove('has-portal-bg');
      if (elements.portalBgLayer) elements.portalBgLayer.style.backgroundImage = 'none';
      if (elements.portalBgOverlay) elements.portalBgOverlay.style.backgroundColor = 'transparent';
    }
  }

  function showStatus(message, type = 'info') {
    if (!elements.statusText || !elements.statusMessage) return;

    elements.statusText.textContent = message;
    elements.statusMessage.style.display = 'flex';

    setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 5000);
  }

  function showError(message) {
    if (!elements.errorText || !elements.errorMessage) return;

    elements.errorText.textContent = message;
    elements.errorMessage.style.display = 'flex';
  }

  function hideError() {
    if (elements.errorMessage) {
      elements.errorMessage.style.display = 'none';
    }
  }

  function formatSessionTime(seconds) {
    if (!seconds || seconds <= 0) return '0m 0s';

    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      const remainingSeconds = seconds % 86400;
      const hours = Math.floor(remainingSeconds / 3600);
      const mins = Math.floor((remainingSeconds % 3600) / 60);
      const secs = remainingSeconds % 60;
      return `${days}d ${hours}h ${mins}m ${secs}s`;
    }

    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours}h ${mins}m ${secs}s`;
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  function showSession(session) {
    if (!elements.sessionView || !elements.loginView) return;

    currentSession = session;

    // Show session view, hide login
    elements.loginView.style.display = 'none';
    elements.sessionView.style.display = 'block';

    // Update timer
    if (elements.sessionTimer) {
      elements.sessionTimer.textContent = formatSessionTime(session.remainingSeconds || session.remaining_seconds);
    }

    // Update status
    if (session.isPaused) {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-dot paused';
      }
      if (elements.statusLabel) {
        elements.statusLabel.textContent = 'Time Paused - Internet Suspended';
        elements.statusLabel.className = 'status-label-text paused';
      }
      if (elements.btnPause) {
        elements.btnPause.innerHTML = '▶️ RESUME MY TIME';
      }
    } else {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-dot active';
      }
      if (elements.statusLabel) {
        elements.statusLabel.textContent = 'Internet Access Live';
        elements.statusLabel.className = 'status-label-text';
      }
      if (elements.btnPause) {
        elements.btnPause.innerHTML = '⏸️ PAUSE MY TIME';
      }
    }

    // Update device info
    if (elements.deviceIp) elements.deviceIp.textContent = clientIp || 'Detecting...';
    if (elements.deviceMac) elements.deviceMac.textContent = clientMac || 'Detecting...';

    // Update credit
    if (creditPesos > 0) {
      if (elements.creditDisplay) elements.creditDisplay.style.display = 'inline';
      if (elements.creditPesos) elements.creditPesos.textContent = creditPesos;
    }

    // Start countdown
    startCountdown(session.remainingSeconds || session.remaining_seconds);
  }

  function showLogin() {
    if (!elements.sessionView || !elements.loginView) return;

    currentSession = null;

    // Hide session, show login
    elements.sessionView.style.display = 'none';
    elements.loginView.style.display = 'block';

    // Update device info
    if (elements.loginDeviceIp) elements.loginDeviceIp.textContent = clientIp || 'Detecting...';
    if (elements.loginDeviceMac) elements.loginDeviceMac.textContent = clientMac || 'Detecting...';

    // Update credit
    if (creditPesos > 0) {
      if (elements.loginCreditDisplay) elements.loginCreditDisplay.style.display = 'inline';
      if (elements.loginCreditPesos) elements.loginCreditPesos.textContent = creditPesos;
      if (elements.btnUseCredit) elements.btnUseCredit.style.display = 'flex';
    } else if (elements.btnUseCredit) {
      elements.btnUseCredit.style.display = 'none';
    }

    // Stop countdown
    stopCountdown();
  }

  function startCountdown(seconds) {
    stopCountdown();

    let remaining = seconds;

    countdownTimer = setInterval(() => {
      remaining--;

      if (remaining <= 0) {
        stopCountdown();
        showLogin();
        showStatus('Session expired. Please insert coins.');
      } else if (elements.sessionTimer) {
        elements.sessionTimer.textContent = formatSessionTime(remaining);
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  // ─── Coinslot Selector (NodeMCU / Sub-Vendo) ───

  function renderCoinslotSelector() {
    if (!elements.coinslotSelector || !elements.coinslotSelect) return;

    if (availableSlots.length === 0) {
      elements.coinslotSelector.style.display = 'none';
      return;
    }

    // Clear existing options except Main Machine
    elements.coinslotSelect.innerHTML = '<option value="main">🏠 Main Machine</option>';

    availableSlots.forEach(slot => {
      const opt = document.createElement('option');
      opt.value = slot.macAddress;
      const isDisabled = slot.license && !slot.license.isValid;
      opt.disabled = isDisabled;
      const icon = isDisabled ? '🔒' : (slot.isOnline ? '🟢' : '🔴');
      const suffix = isDisabled ? ' (DISABLED)' : '';
      opt.textContent = `${icon} ${slot.name}${suffix}`;
      elements.coinslotSelect.appendChild(opt);
    });

    elements.coinslotSelect.value = selectedSlot;
    elements.coinslotSelector.style.display = 'block';
  }

  function autoSelectSlot() {
    if (userHasSelectedSlot) return;
    if (availableSlots.length === 0) return;

    let bestSlot = null;

    // 1. Try VLAN match
    if (clientVlanId !== null) {
      const vlanSlots = availableSlots.filter(s =>
        s.vlanId == clientVlanId && (!s.license || s.license.isValid)
      );
      const onlineVlanSlots = vlanSlots.filter(s => s.isOnline);
      if (onlineVlanSlots.length > 0) {
        bestSlot = onlineVlanSlots[0];
      } else if (vlanSlots.length > 0) {
        bestSlot = vlanSlots[0];
      }
    }

    // 2. Fallback: single online slot
    if (!bestSlot) {
      const onlineSlots = availableSlots.filter(s => s.isOnline && (!s.license || s.license.isValid));
      if (onlineSlots.length === 1) {
        bestSlot = onlineSlots[0];
      }
    }

    if (bestSlot && bestSlot.macAddress && selectedSlot !== bestSlot.macAddress) {
      selectedSlot = bestSlot.macAddress;
      if (elements.coinslotSelect) elements.coinslotSelect.value = selectedSlot;
    }
  }

  // ─── Free Internet ───

  function renderFreeInternet() {
    if (!elements.freeInternetCard) return;

    if (freeInternetConfig.enabled && freeInternetConfig.minutes > 0 && !currentSession) {
      elements.freeInternetCard.style.display = 'block';
      if (elements.freeInternetMessage) {
        elements.freeInternetMessage.textContent =
          freeInternetConfig.message || `Get ${freeInternetConfig.minutes} minutes of free internet today!`;
      }
      if (elements.freeInternetCooldown) {
        const cd = freeInternetConfig.cooldownDays;
        elements.freeInternetCooldown.textContent =
          `One claim per device every ${cd} day${cd > 1 ? 's' : ''}`;
      }
      if (elements.btnClaimText) {
        elements.btnClaimText.textContent = `Claim Free Internet (${freeInternetConfig.minutes} mins / ${freeInternetConfig.cooldownDays}d cooldown)`;
      }
    } else {
      elements.freeInternetCard.style.display = 'none';
    }
  }

  async function handleClaimFreeInternet() {
    if (isClaimingFreeInternet) return;
    isClaimingFreeInternet = true;

    if (elements.freeInternetError) elements.freeInternetError.style.display = 'none';
    if (elements.btnClaimFree) elements.btnClaimFree.disabled = true;
    if (elements.btnClaimText) elements.btnClaimText.textContent = 'Claiming...';

    const result = await claimFreeInternet();

    isClaimingFreeInternet = false;
    if (elements.btnClaimFree) elements.btnClaimFree.disabled = false;

    if (result.error) {
      if (elements.freeInternetError) elements.freeInternetError.style.display = 'block';
      if (elements.freeInternetErrorText) elements.freeInternetErrorText.textContent = result.error;
      if (elements.btnClaimText) {
        elements.btnClaimText.textContent = `Claim Free Internet (${freeInternetConfig.minutes} mins / ${freeInternetConfig.cooldownDays}d cooldown)`;
      }
      return;
    }

    // Success
    if (result.token) {
      localStorage.setItem('rjd_session_token', result.token);
      setCookie('rjd_session_token', result.token, 30);
    }

    alert('✅ ' + (result.message || `You received ${result.minutes} minutes of free internet!`));
    triggerConnectivityProbes();
    pollSession();
  }

  // ─── Chat Widget ───

  function initChat() {
    if (!clientMac || !elements.chatToggleBtn) return;

    elements.chatToggleBtn.style.display = 'flex';

    try {
      chatSocket = io();

      chatSocket.on('connect', () => {
        chatSocket.emit('join_chat', { id: clientMac });
        chatSocket.emit('fetch_messages', { user_id: clientMac });
      });

      chatSocket.on('chat_history', (messages) => {
        renderChatMessages(messages);
      });

      chatSocket.on('receive_message', (msg) => {
        appendChatMessage(msg);
        if (!chatOpen) {
          chatUnreadCount++;
          updateChatBadge();
        }
      });

      chatSocket.on('disconnect', () => {
        console.warn('[Chat] Socket disconnected');
      });
    } catch (e) {
      console.error('[Chat] Socket init error:', e);
    }
  }

  function renderChatMessages(messages) {
    if (!elements.chatMessages) return;
    elements.chatMessages.innerHTML = '';

    if (!messages || messages.length === 0) {
      elements.chatMessages.innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon">💬</div>
          <p>Welcome to our support chat! Feel free to ask any questions.</p>
        </div>`;
      return;
    }

    messages.forEach(msg => appendChatMessage(msg, false));
    scrollChatToBottom();
  }

  function appendChatMessage(msg, scroll = true) {
    if (!elements.chatMessages) return;

    // Remove welcome message if present
    const welcome = elements.chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    const isMe = msg.sender === clientMac;
    const isBroadcast = msg.recipient === 'broadcast';
    div.className = `chat-msg ${isMe ? 'me' : isBroadcast ? 'broadcast' : 'them'}`;

    let html = '';
    if (isBroadcast) {
      html += '<div class="chat-msg-broadcast-label">📢 Announcement</div>';
    }
    html += `<div>${escapeHtml(msg.message)}</div>`;
    html += `<div class="chat-msg-time">${formatChatTime(msg.timestamp)}</div>`;
    div.innerHTML = html;

    elements.chatMessages.appendChild(div);
    if (scroll) scrollChatToBottom();
  }

  function scrollChatToBottom() {
    if (elements.chatMessages) {
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
  }

  function updateChatBadge() {
    if (!elements.chatUnreadBadge) return;
    if (chatUnreadCount > 0) {
      elements.chatUnreadBadge.style.display = 'flex';
      elements.chatUnreadBadge.textContent = chatUnreadCount;
    } else {
      elements.chatUnreadBadge.style.display = 'none';
    }
  }

  function toggleChat() {
    chatOpen = !chatOpen;
    if (elements.chatPanel) {
      elements.chatPanel.style.display = chatOpen ? 'flex' : 'none';
    }
    if (chatOpen) {
      chatUnreadCount = 0;
      updateChatBadge();
      scrollChatToBottom();
      if (elements.chatInput) elements.chatInput.focus();
    }
  }

  function handleSendChatMessage(e) {
    e.preventDefault();
    if (!chatSocket || !elements.chatInput) return;
    const msg = elements.chatInput.value.trim();
    if (!msg) return;

    chatSocket.emit('send_message', {
      sender: clientMac,
      recipient: 'admin',
      message: msg
    });

    elements.chatInput.value = '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatChatTime(ts) {
    try {
      const dateStr = typeof ts === 'string' && !ts.includes('T') ? ts.replace(' ', 'T') : ts;
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  // ─── Connectivity Probes ───

  function triggerConnectivityProbes() {
    // Strategy 1: Hidden iframe navigation to force CNA re-evaluation
    // The OS CNA webview detects internet when connectivity check URLs return expected responses
    const probeUrls = [
      'http://connectivitycheck.gstatic.com/generate_204',
      'http://captive.apple.com/hotspot-detect.html',
      'http://www.msftconnecttest.com/connecttest.txt'
    ];
    
    // Create hidden iframe to load connectivity check - forces OS network stack re-evaluation
    function loadProbeInIframe(url) {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.src = url;
        document.body.appendChild(iframe);
        setTimeout(() => { try { document.body.removeChild(iframe); } catch(e) {} }, 5000);
      } catch(e) {}
    }
    
    // Strategy 2: Fetch probes (may trigger some OS-level checks via network activity)
    function fetchProbes() {
      fetch('http://connectivitycheck.gstatic.com/generate_204', { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
      fetch('http://captive.apple.com/hotspot-detect.html', { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
      fetch('http://www.msftconnecttest.com/connecttest.txt', { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
      fetch('http://1.1.1.1/', { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    }
    
    // Strategy 3: XMLHttpRequest (different code path than fetch, may trigger CNA on some devices)
    function xhrProbe(url) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 5000;
        xhr.send();
      } catch(e) {}
    }

    // Round 1: Immediate - fetch + iframe probes
    fetchProbes();
    loadProbeInIframe(probeUrls[0]);
    
    // Round 2: After 500ms - more iframe probes for different OS vendors
    setTimeout(() => {
      loadProbeInIframe(probeUrls[1]); // Apple
      loadProbeInIframe(probeUrls[2]); // Microsoft
      xhrProbe('http://connectivitycheck.gstatic.com/generate_204');
      xhrProbe('http://captive.apple.com/hotspot-detect.html');
    }, 500);

    // Round 3: After 1.5s - aggressive retry with all methods
    setTimeout(() => {
      fetchProbes();
      probeUrls.forEach(url => loadProbeInIframe(url));
    }, 1500);
    
    // Round 4: After 3s - final attempt, also try navigating the page itself
    // This is the nuclear option for stubborn CNA implementations
    setTimeout(() => {
      fetchProbes();
      xhrProbe('http://connectivitycheck.gstatic.com/generate_204');
      // Try opening connectivity check in a new context (helps some Android versions)
      try {
        const w = window.open('http://connectivitycheck.gstatic.com/generate_204', '_blank');
        if (w) setTimeout(() => { try { w.close(); } catch(e) {} }, 2000);
      } catch(e) {}
    }, 3000);

    // Round 5: After 5s - last resort redirect for CNA webviews
    // If we detect we're inside a CNA webview, redirect to generate_204
    setTimeout(() => {
      const ua = navigator.userAgent.toLowerCase();
      const isCNA = ua.includes('cna') || ua.includes('captivenetwork') || 
                    ua.includes('miniprogram') || document.referrer.includes('captive');
      if (isCNA) {
        window.location.href = '/generate_204';
      } else {
        // Final round of probes for regular browsers
        fetchProbes();
      }
    }, 5000);
  }

  // ─── Cookie Helpers ───

  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  function showRatesModal() {
    if (!elements.ratesModal || !elements.ratesList) return;

    // Populate rates
    elements.ratesList.innerHTML = '';

    if (rates.length === 0) {
      elements.ratesList.innerHTML = '<p class="text-center" style="color: var(--text-muted); font-size: 0.75rem;">No rates available</p>';
    } else {
      rates.sort((a, b) => a.pesos - b.pesos).forEach(rate => {
        const rateItem = document.createElement('div');
        rateItem.className = 'rate-item';

        const timeLabel = rate.minutes >= 60
          ? `${Math.floor(rate.minutes / 60)}h ${rate.minutes % 60 > 0 ? (rate.minutes % 60) + 'm' : ''}`
          : `${rate.minutes} Minutes`;

        rateItem.innerHTML = `
          <div>
            <span class="rate-pesos">₱${rate.pesos}</span>
            <span class="rate-time">${timeLabel}</span>
          </div>
        `;

        elements.ratesList.appendChild(rateItem);
      });
    }

    elements.ratesModal.style.display = 'flex';
  }

  function hideRatesModal() {
    if (elements.ratesModal) {
      elements.ratesModal.style.display = 'none';
    }
  }

  function calculateMinutes(totalPesos, rateList) {
    if (!rateList || rateList.length === 0) return totalPesos * 10; // fallback

    let remainingPesos = totalPesos;
    let totalMinutes = 0;
    const sortedRates = [...rateList].sort((a, b) => b.pesos - a.pesos);

    for (const rate of sortedRates) {
      if (rate.pesos <= 0) continue;
      if (remainingPesos >= rate.pesos) {
        const times = Math.floor(remainingPesos / rate.pesos);
        totalMinutes += times * rate.minutes;
        remainingPesos -= times * rate.pesos;
      }
    }

    // Handle remainder
    if (remainingPesos > 0) {
      const smallestRate = sortedRates[sortedRates.length - 1];
      if (smallestRate && smallestRate.pesos > 0) {
        totalMinutes += Math.floor((remainingPesos / smallestRate.pesos) * smallestRate.minutes);
      } else {
        totalMinutes += remainingPesos * 10; // last resort fallback
      }
    }

    return totalMinutes;
  }

  function formatCoinTime(totalMinutes) {
    const totalSeconds = Math.floor(totalMinutes * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);

    return parts.join(' ');
  }

  function updateCoinModalDisplay() {
    if (elements.coinTotalAmount) {
      elements.coinTotalAmount.textContent = `₱${coinTotal}`;
    }
    if (elements.coinTotalTime) {
      elements.coinTotalTime.textContent = formatCoinTime(coinMinutes);
    }
    if (elements.coinTimeBox) {
      elements.coinTimeBox.style.display = coinMode === 'internet' ? 'block' : 'none';
    }
    if (elements.btnActionCoin) {
      elements.btnActionCoin.innerHTML = coinMode === 'internet'
        ? '<span>🚀</span> START SURFING'
        : '<span>💰</span> CONFIRM CREDIT';
    }
    if (elements.btnModeInternet && elements.btnModeCredit) {
      elements.btnModeInternet.classList.toggle('active', coinMode === 'internet');
      elements.btnModeCredit.classList.toggle('active', coinMode === 'credit');
    }
    if (elements.coinModalSubtitle) {
      elements.coinModalSubtitle.textContent = reservedSlot === 'main' ? 'Main Machine' : 'Remote Vendo';
    }
  }

  function startCoinCountdown() {
    stopCoinCountdown();
    coinCountdownSeconds = 60;

    coinCountdownTimer = setInterval(() => {
      coinCountdownSeconds--;

      if (elements.coinCountdown) {
        elements.coinCountdown.textContent = coinTotal > 0
          ? `Confirm in ${coinCountdownSeconds}s or coins will be saved as credit`
          : `Waiting for coins... ${coinCountdownSeconds}s`;
      }

      if (coinCountdownSeconds <= 0) {
        stopCoinCountdown();
        if (coinTotal === 0) {
          closeCoinModal();
        } else {
          handleConfirmCoin();
        }
      }
    }, 1000);
  }

  function stopCoinCountdown() {
    if (coinCountdownTimer) {
      clearInterval(coinCountdownTimer);
      coinCountdownTimer = null;
    }
  }

  function stopInsertCoinAudio() {
    if (insertCoinAudio) {
      insertCoinAudio.pause();
      insertCoinAudio.currentTime = 0;
      insertCoinAudio = null;
    }
  }

  function handleCoinPulse(data) {
    const pesos = typeof data === 'object' ? (data.pesos || 0) : (data || 0);
    if (!pesos || pesos <= 0) return;

    console.log(`[COIN] Received Pulse: ₱${pesos}`);

    coinTotal += pesos;
    coinMinutes = calculateMinutes(coinTotal, rates);

    updateCoinModalDisplay();

    // Reset countdown on every coin drop
    coinCountdownSeconds = 60;

    // Play coin drop audio
    if (elements.audioCoinDrop && elements.audioCoinDrop.src) {
      const dropAudio = new Audio(elements.audioCoinDrop.src);
      dropAudio.play().catch(e => console.log('Coin drop audio play failed', e));
    }

    // Heartbeat coin slot
    if (reservedSlot && coinSlotLockId) {
      heartbeatCoinSlot(reservedSlot, coinSlotLockId);
    }
  }

  function handleNodeMCUPulse(data) {
    if (!data || data.macAddress !== selectedSlot) return;
    handleCoinPulse({ pesos: data.denomination || 0 });
  }

  function startCoinDetection() {
    // Reset state
    coinTotal = 0;
    coinMinutes = 0;
    coinMode = 'internet';
    coinCountdownSeconds = 60;
    updateCoinModalDisplay();

    // Connect Socket.IO
    try {
      socket = io();

      socket.on('connect', () => {
        console.log('[COIN] Socket Connected to Gateway');
      });

      socket.on('disconnect', () => {
        console.warn('[COIN] Socket Disconnected');
      });

      socket.on('coin-pulse', handleCoinPulse);
      socket.on('nodemcu-pulse', handleNodeMCUPulse);
    } catch (error) {
      console.error('[COIN] Socket connection error:', error);
    }

    // Start countdown
    startCoinCountdown();

    // Play insert coin audio loop
    if (portalConfig && portalConfig.insertCoinAudio) {
      try {
        insertCoinAudio = new Audio(portalConfig.insertCoinAudio);
        insertCoinAudio.loop = true;
        insertCoinAudio.volume = 0.5;
        insertCoinAudio.play().catch(e => console.log('Insert coin audio play failed', e));
      } catch (e) {
        console.error(e);
      }
    }

    // Heartbeat coin slot immediately
    if (reservedSlot && coinSlotLockId) {
      heartbeatCoinSlot(reservedSlot, coinSlotLockId);
    }
  }

  function stopCoinDetection() {
    stopCoinCountdown();
    stopInsertCoinAudio();

    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function showCoinModal() {
    if (!elements.coinModal) return;

    elements.coinModal.style.display = 'flex';
    startCoinDetection();
  }

  function hideCoinModal() {
    if (elements.coinModal) {
      elements.coinModal.style.display = 'none';
    }

    stopCoinDetection();

    // Release coin slot if reserved
    if (reservedSlot && coinSlotLockId) {
      releaseCoinSlot(reservedSlot, coinSlotLockId);
      reservedSlot = null;
      coinSlotLockId = null;
    }
  }

  async function onCoinSuccess(pesos, minutes, mode) {
    if (mode === 'internet') {
      const slot = reservedSlot || selectedSlot;
      const lockId = coinSlotLockId;
      if (!slot || !lockId) {
        showError('Coinslot reservation expired. Please try again.');
        hideCoinModal();
        return;
      }

      const result = await startInternetSession(minutes, pesos, slot, lockId);

      if (result.error) {
        showError(result.error || 'Failed to start session. Please try again.');
        return;
      }

      // Release lock is handled by server on successful session start
      reservedSlot = null;
      coinSlotLockId = null;

      // Play connected audio
      if (elements.audioConnected && elements.audioConnected.src) {
        elements.audioConnected.play().catch(() => {});
      }

      hideCoinModal();
      showStatus('Session started! Enjoy your internet.');
      
      // Wait 500ms for iptables/conntrack rules to fully settle on the server,
      // then trigger connectivity probes to dismiss CNA and enable internet
      setTimeout(() => {
        triggerConnectivityProbes();
      }, 500);
      
      pollSession();
    } else {
      // Credit mode
      const result = await addCredit(pesos);

      if (result.success) {
        creditPesos += pesos;
      }

      if (reservedSlot && coinSlotLockId) {
        releaseCoinSlot(reservedSlot, coinSlotLockId);
        reservedSlot = null;
        coinSlotLockId = null;
      }

      hideCoinModal();
      showStatus(result.success ? 'Credit saved successfully!' : (result.error || 'Failed to save credit.'));
      pollSession();
    }
  }

  function setCoinMode(mode) {
    coinMode = mode;
    updateCoinModalDisplay();
  }

  async function handleConfirmCoin() {
    if (coinTotal <= 0) {
      showError('Insert coins first');
      return;
    }

    await onCoinSuccess(coinTotal, coinMinutes, coinMode);
  }

  async function handleCancelCoin() {
    if (coinTotal > 0) {
      // Auto-save as credit on cancel
      const result = await addCredit(coinTotal, coinMinutes);
      if (result.success) {
        creditPesos += coinTotal;
        creditMinutes += coinMinutes;
      }
      showStatus(result.success ? 'Coins saved as credit.' : (result.error || 'Failed to save credit.'));
    }
    hideCoinModal();
  }

  function closeCoinModal() {
    hideCoinModal();
  }

  function showVoucherModal() {
    if (!elements.voucherModal) return;

    if (elements.voucherCode) elements.voucherCode.value = '';
    elements.voucherModal.style.display = 'flex';
  }

  function hideVoucherModal() {
    if (elements.voucherModal) {
      elements.voucherModal.style.display = 'none';
    }
  }

  async function updateOnlineStatus() {
    const online = await checkInternetStatus();
    isOnline = online;

    if (elements.onlineStatus) {
      elements.onlineStatus.className = 'online-status ' + (online ? 'online' : 'offline');
    }
    if (elements.onlineDot) {
      elements.onlineDot.className = 'online-dot';
    }
    if (elements.onlineLabel) {
      elements.onlineLabel.textContent = online ? 'Online' : 'Offline';
    }
  }

  // ─── Event Handlers ───

  async function handleInsertCoin() {
    hideError();

    // Check canInsertCoin (license revocation)
    if (!canInsertCoin) {
      showError('System License Revoked: Only 1 device can use the insert coin button at a time. Another device is currently active.');
      return;
    }

    // Check NodeMCU status if sub-vendo selected
    if (selectedSlot !== 'main') {
      const slot = availableSlots.find(s => s.macAddress === selectedSlot);
      if (slot && !slot.isOnline) {
        showError(`The machine "${slot.name}" is OFFLINE. Please tell the owner to restart it.`);
        return;
      }

      try {
        const status = await checkNodeMCUStatus(selectedSlot);
        if (!status.online) {
          showError(`The machine "${slot?.name || 'Sub-Vendo'}" is OFFLINE. Please tell the owner to restart it.`);
          return;
        }
        if (status.license && !status.license.isValid) {
          showError('YOUR COINSLOT MACHINE IS DISABLED');
          return;
        }
      } catch (err) {
        console.error('Status check failed');
      }
    }

    // Reserve coin slot
    const reserve = await reserveCoinSlot(selectedSlot);
    if (!reserve.success || !reserve.lockId) {
      if (reserve.status === 409) {
        showError(reserve.error || 'JUST WAIT SOMEONE IS PAYING.');
        return;
      }
      showError(reserve.error || 'Failed to open coinslot. Please try again.');
      return;
    }

    reservedSlot = selectedSlot;
    coinSlotLockId = reserve.lockId;

    // Show coin modal
    showCoinModal();
  }

  async function handleUseCredit() {
    if (creditPesos <= 0) {
      showError('Walang available na credit para gamitin.');
      return;
    }

    const input = prompt(`Ilang credit ang gagamitin? (Max: ${creditPesos})`, '1');
    if (!input) return;

    const requested = parseInt(input, 10);
    if (isNaN(requested) || requested <= 0 || requested > creditPesos) {
      showError('Invalid na halaga ng credit.');
      return;
    }

    const result = await useCredit(requested);
    if (!result || result.success === false) {
      showError(result?.error || 'Walang available na credit para gamitin.');
      return;
    }

    creditPesos -= requested;
    showStatus('Credit applied successfully!');
    triggerConnectivityProbes();
    pollSession();
  }

  function handleViewRates() {
    showRatesModal();
  }

  function handleCloseRates() {
    hideRatesModal();
  }

  function handleProceed() {
    triggerConnectivityProbes();
    window.location.href = '/success';
  }

  async function handlePause() {
    if (!currentSession || !currentSession.token) return;

    if (currentSession.isPaused) {
      // Resume
      const result = await resumeSession(currentSession.token);
      if (result.success) {
        pollSession();
        // Proactive network refresh after resume
        setTimeout(() => {
          triggerConnectivityProbes();
        }, 1000);
      } else {
        alert('Resume failed: ' + result.message);
      }
    } else {
      // Pause
      const result = await pauseSession(currentSession.token);
      if (result.success) {
        pollSession();
      } else {
        alert('Pause failed: ' + result.message);
      }
    }
  }

  async function handleRefresh() {
    // Client-side network refresh
    const testUrls = ['http://1.1.1.1', 'http://8.8.8.8', 'http://google.com'];
    for (const url of testUrls) {
      try {
        await fetch(url, { mode: 'no-cors', cache: 'reload' });
      } catch (e) {}
    }

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (e) {}
    }

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  async function handleRestore() {
    showStatus('Checking for active sessions...');
    await pollSession();
    if (currentSession) {
      showStatus('Session restored successfully!');
      triggerConnectivityProbes();
    } else {
      showStatus('No active session found.');
    }
  }

  async function handleActivateVoucher() {
    const code = elements.voucherCode?.value?.trim() || elements.voucherCodeInline?.value?.trim();
    if (!code) {
      alert('Please enter a voucher code');
      return;
    }

    const btn = elements.btnActivateVoucherInline?.disabled !== undefined
      ? elements.btnActivateVoucherInline : elements.btnActivateVoucher;
    if (btn) { btn.disabled = true; btn.textContent = 'Activating...'; }

    const result = await activateVoucher(code);

    if (btn) { btn.disabled = false; btn.textContent = 'Activate'; }

    if (result.success) {
      if (result.token) {
        localStorage.setItem('rjd_session_token', result.token);
        setCookie('rjd_session_token', result.token, 30);
      }
      alert('✅ ' + (result.message || 'Voucher activated successfully!'));
      hideVoucherModal();
      pollSession();
      triggerConnectivityProbes();
    } else {
      alert('❌ ' + (result.error || 'Failed to activate voucher'));
    }
  }

  function handleCloseVoucher() {
    hideVoucherModal();
  }

  // ─── Polling ──

  async function pollSession() {
    try {
      // Fetch identity/credits from whoami and active session from sessions/me in parallel
      const [whoami, mySession] = await Promise.all([checkSession(), fetchMySession()]);

      if (whoami) {
        if (whoami.ip) clientIp = whoami.ip;
        if (whoami.mac) clientMac = whoami.mac;
        if (typeof whoami.creditPesos === 'number') creditPesos = whoami.creditPesos;
        if (typeof whoami.creditMinutes === 'number') creditMinutes = whoami.creditMinutes;
        if (typeof whoami.vlanId === 'number') clientVlanId = whoami.vlanId;
        if (typeof whoami.canInsertCoin === 'boolean') canInsertCoin = whoami.canInsertCoin;
        if (whoami.isRevoked === true) isRevoked = true;

        // Show/hide revoked banner
        if (elements.revokedBanner) {
          elements.revokedBanner.style.display = isRevoked ? 'block' : 'none';
        }

        // Handle recommended NodeMCU from backend
        if (whoami.recommendedNodeMCU && whoami.recommendedNodeMCU.macAddress && !userHasSelectedSlot) {
          selectedSlot = whoami.recommendedNodeMCU.macAddress;
          if (elements.coinslotSelect) elements.coinslotSelect.value = selectedSlot;
        }

        // Handle session restore (local or roaming)
        if (whoami.localRestored || whoami.roamingRestored) {
          console.log(`[Portal] Session restored (local=${whoami.localRestored}, roaming=${whoami.roamingRestored})`);

          if (whoami.restoredSession?.token) {
            localStorage.setItem('rjd_session_token', whoami.restoredSession.token);
            setCookie('rjd_session_token', whoami.restoredSession.token, 30);
          }

          triggerConnectivityProbes();
        }
      }

      // Check for an active session with remaining time
      const remaining = mySession ? (mySession.remainingSeconds || mySession.remaining_seconds || 0) : 0;

      if (mySession && remaining > 0) {
        // Merge whoami data with session data for showSession
        const sessionData = {
          ip: clientIp,
          mac: clientMac,
          remainingSeconds: remaining,
          remaining_seconds: remaining,
          isPaused: mySession.isPaused || false,
          token: mySession.token || '',
          totalPaid: mySession.totalPaid || 0,
          connectedAt: mySession.connectedAt || null,
          isPausable: mySession.isPausable || false
        };
        showSession(sessionData);
      } else {
        showLogin();
      }

      // Re-render dynamic sections
      renderCoinslotSelector();
      autoSelectSlot();
      renderFreeInternet();
    } catch (error) {
      console.error('[Portal] Poll error:', error);
    }
  }

  function startPolling() {
    stopPolling();

    // Poll immediately
    pollSession();

    // Then poll at intervals
    pollTimer = setInterval(pollSession, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ── Initialization ───

  async function init() {
    console.log('[Portal] Initializing NEXIFI PISOWIFI Portal...');

    // Fetch portal config
    portalConfig = await fetchPortalConfig();
    if (portalConfig) {
      applyPortalConfig(portalConfig);
    }

    // Fetch rates
    rates = await fetchRates();

    // Load available NodeMCU coinslots
    availableSlots = await fetchAvailableSlots();

    // Load free internet config
    freeInternetConfig = await fetchFreeInternetConfig();

    // Get client info
    try {
      const whoami = await checkSession();
      if (whoami) {
        if (whoami.ip) clientIp = whoami.ip;
        if (whoami.mac) clientMac = whoami.mac;
        if (typeof whoami.vlanId === 'number') clientVlanId = whoami.vlanId;
        if (typeof whoami.canInsertCoin === 'boolean') canInsertCoin = whoami.canInsertCoin;
        if (whoami.isRevoked === true) isRevoked = true;

        // Apply backend-recommended NodeMCU
        if (whoami.recommendedNodeMCU && whoami.recommendedNodeMCU.macAddress) {
          selectedSlot = whoami.recommendedNodeMCU.macAddress;
        }
      }
    } catch (e) {
      console.error('Failed to get client info');
    }

    // Check online status
    await updateOnlineStatus();
    setInterval(updateOnlineStatus, 15000);

    // Render initial state
    renderCoinslotSelector();
    autoSelectSlot();
    renderFreeInternet();
    if (elements.revokedBanner) {
      elements.revokedBanner.style.display = isRevoked ? 'block' : 'none';
    }

    // ─── Event Listeners ───

    if (elements.btnInsertCoin) {
      elements.btnInsertCoin.addEventListener('click', handleInsertCoin);
    }

    if (elements.btnUseCredit) {
      elements.btnUseCredit.addEventListener('click', handleUseCredit);
    }

    if (elements.btnViewRates) {
      elements.btnViewRates.addEventListener('click', handleViewRates);
    }

    if (elements.btnCloseRates) {
      elements.btnCloseRates.addEventListener('click', handleCloseRates);
    }

    if (elements.btnProceed) {
      elements.btnProceed.addEventListener('click', handleProceed);
    }

    if (elements.btnPause) {
      elements.btnPause.addEventListener('click', handlePause);
    }

    if (elements.btnRefresh) {
      elements.btnRefresh.addEventListener('click', handleRefresh);
    }

    if (elements.btnAddTime) {
      elements.btnAddTime.addEventListener('click', handleInsertCoin);
    }

    if (elements.btnViewRatesSession) {
      elements.btnViewRatesSession.addEventListener('click', handleViewRates);
    }

    if (elements.btnRestore) {
      elements.btnRestore.addEventListener('click', handleRestore);
    }

    if (elements.btnCancelCoin) {
      elements.btnCancelCoin.addEventListener('click', handleCancelCoin);
    }

    if (elements.btnActionCoin) {
      elements.btnActionCoin.addEventListener('click', handleConfirmCoin);
    }

    if (elements.btnModeInternet) {
      elements.btnModeInternet.addEventListener('click', () => setCoinMode('internet'));
    }

    if (elements.btnModeCredit) {
      elements.btnModeCredit.addEventListener('click', () => setCoinMode('credit'));
    }

    if (elements.btnActivateVoucher) {
      elements.btnActivateVoucher.addEventListener('click', handleActivateVoucher);
    }

    if (elements.btnCloseVoucher) {
      elements.btnCloseVoucher.addEventListener('click', handleCloseVoucher);
    }

    // Coinslot selector change
    if (elements.coinslotSelect) {
      elements.coinslotSelect.addEventListener('change', (e) => {
        selectedSlot = e.target.value;
        userHasSelectedSlot = true;
      });
    }

    // Free internet claim
    if (elements.btnClaimFree) {
      elements.btnClaimFree.addEventListener('click', handleClaimFreeInternet);
    }

    // Inline voucher form
    if (elements.voucherForm) {
      elements.voucherForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleActivateVoucher();
      });
    }

    // Chat widget
    if (elements.chatToggleBtn) {
      elements.chatToggleBtn.addEventListener('click', toggleChat);
    }
    if (elements.chatCloseBtn) {
      elements.chatCloseBtn.addEventListener('click', toggleChat);
    }
    if (elements.chatForm) {
      elements.chatForm.addEventListener('submit', handleSendChatMessage);
    }

    // Close modals on overlay click
    if (elements.ratesModal) {
      elements.ratesModal.addEventListener('click', (e) => {
        if (e.target === elements.ratesModal) hideRatesModal();
      });
    }

    if (elements.coinModal) {
      elements.coinModal.addEventListener('click', (e) => {
        if (e.target === elements.coinModal) handleCancelCoin();
      });
    }

    if (elements.voucherModal) {
      elements.voucherModal.addEventListener('click', (e) => {
        if (e.target === elements.voucherModal) hideVoucherModal();
      });
    }

    // Hide splash and show portal
    if (elements.splash) {
      elements.splash.style.display = 'none';
    }
    if (elements.portal) {
      elements.portal.style.display = 'block';
    }

    // Start polling
    startPolling();

    // Initialize chat (after clientMac is known)
    initChat();

    console.log('[Portal] Portal initialized successfully');
  }

  // ─── Start When DOM Ready ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopPolling();
    stopCountdown();
    stopCoinDetection();

    // Release coin slot if reserved
    if (reservedSlot && coinSlotLockId) {
      releaseCoinSlot(reservedSlot, coinSlotLockId);
    }

    // Disconnect chat socket
    if (chatSocket) {
      chatSocket.disconnect();
      chatSocket = null;
    }
  });

})();
