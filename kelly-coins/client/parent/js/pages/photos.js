/**
 * Proof Photos page.
 *
 * Lets parents browse, full-screen view, and delete photos that the
 * child uploaded as task proof. Filterable by child.
 */

import { getChildren, getPhotos, deletePhoto } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirm } from '../components/modal.js';

let children = [];
let photos = [];

export default {
  id: 'photos',

  render() {
    return `
      <div class="section-title">证明照片</div>
      <div class="mb-16">
        <select class="form-input" id="photos-child-filter" style="max-width:200px">
          <option value="">全部孩子</option>
        </select>
      </div>
      <div id="photos-grid" class="photo-grid"></div>
      <div id="photo-viewer" class="photo-viewer" style="display:none"></div>
    `;
  },

  async mount() {
    await this.loadChildren();
    document.getElementById('photos-child-filter')?.addEventListener('change', () => this.loadPhotos());
    await this.loadPhotos();
  },

  unmount() {
    this.closeViewer();
  },

  async loadChildren() {
    try {
      const res = await getChildren();
      children = res.data || res || [];
      const select = document.getElementById('photos-child-filter');
      if (!select) return;
      children.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      });
    } catch (_) {}
  },

  async loadPhotos() {
    const childId = document.getElementById('photos-child-filter')?.value || '';
    const grid = document.getElementById('photos-grid');
    if (!grid) return;

    try {
      const res = await getPhotos(childId);
      photos = res.data || res || [];
      this.renderGrid();
    } catch (err) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-text">加载失败</div></div>`;
    }
  },

  renderGrid() {
    const grid = document.getElementById('photos-grid');
    if (!grid) return;

    if (photos.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">📷</div>
          <div class="empty-text">还没有照片</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = photos.map(p => {
      const url = p.url || `/photo-files/${p.filename}`;
      const childName = this.findChildName(p.child_id) || p.child_id || '';
      const time = p.created_at ? p.created_at.slice(5, 16).replace('T', ' ') : '';
      return `
        <div class="photo-thumb" data-photo-id="${p.id}" data-photo-url="${url}">
          <img src="${url}" alt="证明照片" loading="lazy">
          <div class="photo-thumb-overlay">
            <div class="photo-thumb-meta">${childName}</div>
            <div class="photo-thumb-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');

    grid.onclick = (e) => {
      const thumb = e.target.closest('.photo-thumb');
      if (!thumb) return;
      const id = thumb.dataset.photoId;
      const url = thumb.dataset.photoUrl;
      this.openViewer(id, url);
    };
  },

  findChildName(childId) {
    const c = children.find(x => String(x.id) === String(childId));
    return c ? c.name : '';
  },

  openViewer(id, url) {
    const photo = photos.find(p => String(p.id) === String(id));
    if (!photo) return;

    const childName = this.findChildName(photo.child_id) || photo.child_id || '';
    const time = photo.created_at ? photo.created_at.slice(0, 16).replace('T', ' ') : '';
    const taskName = photo.task_name || photo.label || '';

    const viewer = document.getElementById('photo-viewer');
    if (!viewer) return;
    viewer.innerHTML = `
      <div class="photo-viewer-backdrop"></div>
      <div class="photo-viewer-content">
        <button class="photo-viewer-close" data-action="close">✕</button>
        <img src="${url}" alt="证明照片" class="photo-viewer-img">
        <div class="photo-viewer-info">
          <div class="photo-viewer-title">
            ${taskName ? taskName + ' · ' : ''}${childName}
          </div>
          <div class="photo-viewer-meta">${time}</div>
          <div class="photo-viewer-actions">
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${id}">删除照片</button>
          </div>
        </div>
      </div>
    `;
    viewer.style.display = '';

    viewer.onclick = async (e) => {
      const action = e.target.dataset.action;
      if (action === 'close' || e.target.classList.contains('photo-viewer-backdrop')) {
        this.closeViewer();
      } else if (action === 'delete') {
        await this.removePhoto(e.target.dataset.id);
      }
    };
  },

  closeViewer() {
    const viewer = document.getElementById('photo-viewer');
    if (!viewer) return;
    viewer.innerHTML = '';
    viewer.style.display = 'none';
  },

  async removePhoto(id) {
    const ok = await confirm('删除照片', '确定要永久删除这张照片吗？', '删除', '取消');
    if (!ok) return;

    try {
      await deletePhoto(id);
      photos = photos.filter(p => String(p.id) !== String(id));
      this.closeViewer();
      this.renderGrid();
      showToast('已删除');
    } catch (err) {
      showToast('删除失败');
    }
  },
};
