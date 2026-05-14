// Reactive state management for the child app
// Components subscribe to state changes and get notified on updates

const listeners = new Map();
let state = {
  childId: localStorage.getItem('kelly-coins-child') || 'kelly',
  childName: 'Kelly',
  coins: 0,
  level: 1,
  avatar: 'default',
  tasks: [],
  rewards: [],
  history: [],
};

// Get a snapshot of current state
export function getState() {
  return { ...state };
}

// Update state and notify subscribers
export function setState(partial) {
  Object.assign(state, partial);
  // Persist child selection
  if (partial.childId) {
    localStorage.setItem('kelly-coins-child', partial.childId);
  }
  // Notify all listeners
  for (const [_key, callbacks] of listeners) {
    callbacks.forEach(cb => {
      try { cb(getState()); } catch (e) { console.error('State listener error:', e); }
    });
  }
}

// Subscribe to state changes. Returns an unsubscribe function.
export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, []);
  listeners.get(key).push(callback);
  return () => {
    const cbs = listeners.get(key);
    const idx = cbs.indexOf(callback);
    if (idx >= 0) cbs.splice(idx, 1);
  };
}

// Compute level from total earned coins (simple formula)
export function computeLevel(totalCoins) {
  if (totalCoins >= 200) return 10;
  if (totalCoins >= 100) return 8;
  if (totalCoins >= 50)  return 6;
  if (totalCoins >= 30)  return 5;
  if (totalCoins >= 20)  return 4;
  if (totalCoins >= 10)  return 3;
  if (totalCoins >= 5)   return 2;
  return 1;
}
