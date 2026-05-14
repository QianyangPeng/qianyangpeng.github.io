/**
 * PIN Authentication screen for the parent dashboard.
 *
 * Two modes:
 *   - login: a PIN has been set; the parent must enter it
 *   - setup: no PIN has been set; the parent can create one (and confirm it)
 *
 * On success, calls the provided onAuthenticated() callback.
 */

import { parentLogin, setPin, getAuthStatus } from '../api.js';
import { showToast } from '../components/toast.js';

let mode = 'login'; // 'login' | 'setup'
let onSuccess = null;

/**
 * Render the auth screen into the document body.
 * @param {() => void} callback Called after successful auth.
 */
export async function showAuthScreen(callback) {
  onSuccess = callback;

  // Determine which mode by asking the server
  try {
    const res = await getAuthStatus();
    const hasPin = res.has_pin ?? res.data?.has_pin ?? false;
    mode = hasPin ? 'login' : 'setup';
  } catch (_) {
    mode = 'login';
  }

  renderShell();
  attachHandlers();
}

function renderShell() {
  // Clear any existing UI
  document.getElementById('app-header').innerHTML = '';
  document.getElementById('app-nav').innerHTML = '';
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="auth-screen" id="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">🪙</div>
        <div class="auth-title">Kelly Coins</div>
        <div class="auth-subtitle">${mode === 'setup' ? '首次设置PIN码' : '家长端登录'}</div>

        <div class="auth-form">
          <div class="form-group">
            <label class="form-label">${mode === 'setup' ? '设置 4 位 PIN 码' : '请输入 PIN 码'}</label>
            <input
              class="form-input auth-input"
              id="auth-pin"
              type="password"
              inputmode="numeric"
              autocomplete="off"
              maxlength="8"
              placeholder="••••"
            >
          </div>

          ${mode === 'setup' ? `
            <div class="form-group">
              <label class="form-label">再次确认</label>
              <input
                class="form-input auth-input"
                id="auth-pin-confirm"
                type="password"
                inputmode="numeric"
                autocomplete="off"
                maxlength="8"
                placeholder="••••"
              >
            </div>
          ` : ''}

          <button class="btn btn-primary auth-submit" id="auth-submit">
            ${mode === 'setup' ? '设置 PIN 码' : '登录'}
          </button>

          <div class="auth-hint" id="auth-hint">
            ${mode === 'setup'
              ? '设置后，每次进入家长端都需要输入此 PIN 码'
              : '忘记 PIN？请联系应用管理员重置'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachHandlers() {
  const submit = document.getElementById('auth-submit');
  const pinInput = document.getElementById('auth-pin');
  const confirmInput = document.getElementById('auth-pin-confirm');

  submit?.addEventListener('click', handleSubmit);

  // Enter key submits
  [pinInput, confirmInput].forEach(input => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });
  });

  // Auto-focus first input
  pinInput?.focus();
}

async function handleSubmit() {
  const pinInput = document.getElementById('auth-pin');
  const confirmInput = document.getElementById('auth-pin-confirm');
  const pin = (pinInput?.value || '').trim();

  if (!pin) {
    showToast('请输入 PIN 码');
    return;
  }
  if (pin.length < 4) {
    showToast('PIN 码至少 4 位');
    return;
  }

  if (mode === 'setup') {
    const confirmPin = (confirmInput?.value || '').trim();
    if (pin !== confirmPin) {
      showToast('两次输入的 PIN 码不一致');
      if (confirmInput) confirmInput.value = '';
      return;
    }

    try {
      await setPin(pin);
      showToast('PIN 码已设置，正在登录...');
      // Auto-login after setup
      await parentLogin(pin);
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast('设置失败: ' + err.message);
    }
    return;
  }

  // Login mode
  try {
    await parentLogin(pin);
    showToast('登录成功');
    if (onSuccess) onSuccess();
  } catch (err) {
    if (pinInput) pinInput.value = '';
    pinInput?.focus();
    showToast('PIN 码错误');
  }
}

export default {
  id: 'auth',
  show: showAuthScreen,
};
