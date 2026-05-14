// Task Due Reminders
// Uses Web Notifications API to remind Kelly about routine tasks
// Schedules: 7am morning routine, 12pm lunch, 8pm bedtime
// Stored preferences in localStorage

const REMINDERS = [
  { id: 'morning',  hour: 7,  minute: 30, title: '☀️ 早安 Kelly！', body: '该刷牙穿衣服啦' },
  { id: 'lunch',    hour: 12, minute: 0,  title: '🍽️ 午饭时间！', body: '记得吃完所有蔬菜' },
  { id: 'play',     hour: 16, minute: 0,  title: '👶 陪 Selina 玩', body: '今天还没陪妹妹玩哦' },
  { id: 'evening',  hour: 19, minute: 0,  title: '🛁 洗澡时间！', body: '晚上要洗澡哦' },
  { id: 'bedtime',  hour: 20, minute: 30, title: '🌙 晚安 Kelly', body: '该睡觉啦，记得整理玩具' },
];

const STORAGE_KEY = 'kelly-coins-reminders-enabled';
const FIRED_KEY = 'kelly-coins-reminders-fired';

let checkInterval = null;

export function setupReminders() {
  // Check every minute if it's time for a reminder
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkReminders, 60 * 1000);
  // Initial check after a few seconds
  setTimeout(checkReminders, 5000);
}

export function areRemindersEnabled() {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export async function enableReminders() {
  if (!('Notification' in window)) {
    alert('你的浏览器不支持通知功能');
    return false;
  }
  if (Notification.permission === 'granted') {
    localStorage.setItem(STORAGE_KEY, '1');
    return true;
  }
  if (Notification.permission === 'denied') {
    alert('请在浏览器设置中允许通知');
    return false;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(STORAGE_KEY, '1');
    return true;
  }
  return false;
}

export function disableReminders() {
  localStorage.setItem(STORAGE_KEY, '0');
}

function getFiredMap() {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
  } catch { return {}; }
}

function setFiredMap(map) {
  localStorage.setItem(FIRED_KEY, JSON.stringify(map));
}

function checkReminders() {
  if (!areRemindersEnabled()) return;
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fired = getFiredMap();

  for (const r of REMINDERS) {
    const key = `${today}_${r.id}`;
    if (fired[key]) continue;

    // Within the past minute window?
    const reminderTime = new Date();
    reminderTime.setHours(r.hour, r.minute, 0, 0);
    const diff = now - reminderTime;

    if (diff >= 0 && diff < 60 * 1000) {
      try {
        new Notification(r.title, {
          body: r.body,
          icon: '/child/assets/characters/styles/gacha/default.png',
          tag: `kelly-${r.id}`,
        });
        fired[key] = true;
        setFiredMap(fired);
      } catch (e) {
        console.warn('Notification failed:', e);
      }
    }
  }

  // Clean up old fired entries (keep only today)
  const cleaned = {};
  Object.keys(fired).forEach(k => {
    if (k.startsWith(today)) cleaned[k] = fired[k];
  });
  if (Object.keys(cleaned).length !== Object.keys(fired).length) {
    setFiredMap(cleaned);
  }
}

export function getReminderList() {
  return REMINDERS;
}
