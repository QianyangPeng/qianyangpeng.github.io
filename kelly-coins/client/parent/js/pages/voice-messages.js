/**
 * Voice Messages page.
 *
 * Lets parents record and manage voice messages for their children.
 * Uses the MediaRecorder API and uploads the resulting audio/webm blob
 * directly via the upload helper in api.js.
 */

import {
  getChildren,
  getVoiceMessages,
  uploadVoiceMessage,
  deleteVoiceMessage,
} from '../api.js';
import { showToast } from '../components/toast.js';
import { confirm } from '../components/modal.js';

const CATEGORIES = [
  { value: 'morning',       label: '早安 🌅' },
  { value: 'evening',       label: '晚安 🌙' },
  { value: 'encouragement', label: '鼓励 💪' },
  { value: 'general',       label: '日常 💬' },
];

let children = [];
let messages = [];
let mediaRecorder = null;
let audioStream = null;
let recordedChunks = [];
let recordedBlob = null;
let recordingStart = 0;
let timerInterval = null;
let recordedDuration = 0;

export default {
  id: 'voice-messages',

  render() {
    return `
      <div class="section-title">语音留言</div>

      <div class="card voice-recorder-card">
        <div class="form-group">
          <label class="form-label">发给</label>
          <select class="form-input" id="vm-child"></select>
        </div>

        <div class="form-group">
          <label class="form-label">类别</label>
          <select class="form-input" id="vm-category">
            ${CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">备注（可选）</label>
          <input class="form-input" id="vm-label" placeholder="例如：今天表现很棒">
        </div>

        <div class="voice-recorder">
          <div class="voice-status" id="vm-status">
            <span class="voice-dot" id="vm-dot"></span>
            <span class="voice-time" id="vm-time">00:00</span>
          </div>
          <button class="voice-record-btn" id="vm-record-btn">
            <span class="voice-record-icon">🎤</span>
            <span class="voice-record-label" id="vm-record-label">按住录音</span>
          </button>

          <div class="voice-preview" id="vm-preview" style="display:none">
            <audio class="voice-preview-audio" id="vm-preview-audio" controls></audio>
            <div class="voice-preview-actions">
              <button class="btn btn-ghost btn-sm" id="vm-rerecord">重录</button>
              <button class="btn btn-primary btn-sm" id="vm-send">发送</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section-title" style="margin-top:24px">已发送的留言</div>
      <div id="vm-list"></div>
    `;
  },

  async mount() {
    await this.loadChildren();
    this.setupRecorder();
    await this.loadMessages();

    document.getElementById('vm-child')?.addEventListener('change', () => this.loadMessages());
  },

  unmount() {
    this.stopStream();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  },

  async loadChildren() {
    try {
      const res = await getChildren();
      children = res.data || res || [];
      const select = document.getElementById('vm-child');
      if (!select) return;
      select.innerHTML = children.map(c =>
        `<option value="${c.id}">${c.name}</option>`
      ).join('');
    } catch (err) {
      console.error('Voice messages: failed to load children', err);
    }
  },

  async loadMessages() {
    const childId = document.getElementById('vm-child')?.value || '';
    const container = document.getElementById('vm-list');
    if (!container) return;

    try {
      const res = await getVoiceMessages(childId);
      messages = res.data || res || [];
      this.renderMessages();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-text">加载失败</div></div>`;
    }
  },

  renderMessages() {
    const container = document.getElementById('vm-list');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎙️</div>
          <div class="empty-text">还没有发送过语音留言</div>
        </div>
      `;
      return;
    }

    container.innerHTML = messages.map(m => {
      const cat = CATEGORIES.find(c => c.value === m.category);
      const catLabel = cat ? cat.label : (m.category || '日常');
      const time = m.created_at ? m.created_at.slice(0, 16).replace('T', ' ') : '';
      const url = m.url || `/voice-files/${m.filename}`;
      const dur = m.duration ? `${Math.round(m.duration)}秒` : '';

      return `
        <div class="voice-message-item" data-id="${m.id}">
          <div class="voice-message-info">
            <div class="voice-message-title">
              <span class="chip chip-virtual">${catLabel}</span>
              ${m.label ? `<span class="voice-message-label">${m.label}</span>` : ''}
            </div>
            <div class="voice-message-meta">${time}${dur ? ' · ' + dur : ''}</div>
            <audio class="voice-message-audio" controls src="${url}"></audio>
          </div>
          <button class="btn btn-danger btn-sm" data-delete-vm="${m.id}">删除</button>
        </div>
      `;
    }).join('');

    container.onclick = async (e) => {
      const id = e.target.dataset.deleteVm;
      if (id) await this.deleteMessage(id);
    };
  },

  setupRecorder() {
    const btn = document.getElementById('vm-record-btn');
    if (!btn) return;

    // Touch events (mobile)
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startRecording();
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.stopRecording();
    }, { passive: false });
    btn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.stopRecording();
    }, { passive: false });

    // Mouse events (desktop)
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.startRecording();
    });
    btn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this.stopRecording();
    });
    btn.addEventListener('mouseleave', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        this.stopRecording();
      }
    });

    document.getElementById('vm-rerecord')?.addEventListener('click', () => this.resetPreview());
    document.getElementById('vm-send')?.addEventListener('click', () => this.sendRecording());
  },

  async startRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('您的浏览器不支持录音');
      return;
    }

    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      recordedBlob = null;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      mediaRecorder = new MediaRecorder(audioStream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        recordedDuration = (Date.now() - recordingStart) / 1000;
        this.showPreview();
        this.stopStream();
      };

      mediaRecorder.start();
      recordingStart = Date.now();
      this.showRecordingIndicator(true);
      this.startTimer();
    } catch (err) {
      console.error('Recording start error:', err);
      showToast('无法访问麦克风');
      this.stopStream();
    }
  },

  stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    this.showRecordingIndicator(false);
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  },

  stopStream() {
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
    }
  },

  showRecordingIndicator(active) {
    const dot = document.getElementById('vm-dot');
    const label = document.getElementById('vm-record-label');
    const btn = document.getElementById('vm-record-btn');
    if (dot) dot.classList.toggle('recording', active);
    if (btn) btn.classList.toggle('recording', active);
    if (label) label.textContent = active ? '松开发送' : '按住录音';
  },

  startTimer() {
    const timeEl = document.getElementById('vm-time');
    if (timeEl) timeEl.textContent = '00:00';
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - recordingStart) / 1000);
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      const el = document.getElementById('vm-time');
      if (el) el.textContent = `${mm}:${ss}`;
    }, 250);
  },

  showPreview() {
    if (!recordedBlob) return;
    const previewBox = document.getElementById('vm-preview');
    const audio = document.getElementById('vm-preview-audio');
    if (previewBox) previewBox.style.display = '';
    if (audio) audio.src = URL.createObjectURL(recordedBlob);
  },

  resetPreview() {
    recordedBlob = null;
    recordedDuration = 0;
    const previewBox = document.getElementById('vm-preview');
    const audio = document.getElementById('vm-preview-audio');
    if (previewBox) previewBox.style.display = 'none';
    if (audio) {
      try { URL.revokeObjectURL(audio.src); } catch (_) {}
      audio.src = '';
    }
    const timeEl = document.getElementById('vm-time');
    if (timeEl) timeEl.textContent = '00:00';
  },

  async sendRecording() {
    if (!recordedBlob) {
      showToast('请先录音');
      return;
    }
    const childId = document.getElementById('vm-child')?.value;
    const category = document.getElementById('vm-category')?.value || 'general';
    const label = document.getElementById('vm-label')?.value.trim() || '';

    if (!childId) {
      showToast('请选择孩子');
      return;
    }

    try {
      await uploadVoiceMessage(childId, recordedBlob, category, label, recordedDuration);
      showToast('发送成功');
      this.resetPreview();
      const labelInput = document.getElementById('vm-label');
      if (labelInput) labelInput.value = '';
      await this.loadMessages();
    } catch (err) {
      showToast('发送失败: ' + err.message);
    }
  },

  async deleteMessage(id) {
    const ok = await confirm('删除留言', '确定要删除这条语音留言吗？', '删除', '取消');
    if (!ok) return;

    try {
      await deleteVoiceMessage(id);
      messages = messages.filter(m => String(m.id) !== String(id));
      this.renderMessages();
      showToast('已删除');
    } catch (err) {
      showToast('删除失败');
    }
  },
};
