// Weekly report generator
// Generates an HTML report each Sunday at 8 PM and writes it to server/reports/
// Parent dashboard can fetch & display the latest report
// (Email delivery is left as a manual download — can be wired to Gmail MCP later.)

const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const REPORTS_DIR = path.join(__dirname, '..', '..', 'server', 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

function startOfWeek(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - dt.getDay()); // back to Sunday
  return dt;
}

function generateReport() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = now.toISOString().slice(0, 10);

  const children = db.getChildren();
  const sections = [];

  for (const [childId, child] of Object.entries(children)) {
    const transactions = db.getTransactions(childId, 500);
    const weekTxns = transactions.filter(t => t.created_at >= weekStartStr + ' 00:00:00');
    const earned = weekTxns.filter(t => t.coins_earned > 0).reduce((s, t) => s + t.coins_earned, 0);
    const spent = Math.abs(weekTxns.filter(t => t.coins_earned < 0).reduce((s, t) => s + t.coins_earned, 0));
    const taskTxns = weekTxns.filter(t => t.task_id && t.coins_earned > 0);

    // Most-done task
    const taskCounts = {};
    taskTxns.forEach(t => {
      taskCounts[t.task_name] = (taskCounts[t.task_name] || 0) + 1;
    });
    const topTask = Object.entries(taskCounts).sort((a, b) => b[1] - a[1])[0];

    const streak = db.getStreak(childId);
    const achievements = db.getChildAchievements(childId).filter(a => a.unlocked).length;

    sections.push({
      childId,
      name: child.name,
      coins: child.coins,
      total_earned: child.total_earned || 0,
      week_earned: earned,
      week_spent: spent,
      week_tasks: taskTxns.length,
      streak: streak.count,
      streak_longest: streak.longest,
      top_task: topTask ? { name: topTask[0], count: topTask[1] } : null,
      achievements_unlocked: achievements,
      level: child.level || 1,
    });
  }

  const html = renderHtmlReport(weekStartStr, weekEndStr, sections);
  const filename = `weekly-${weekEndStr}.html`;
  const filePath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filePath, html);

  return { filename, filePath, generated_at: new Date().toISOString(), sections };
}

function renderHtmlReport(start, end, sections) {
  const childCards = sections.map(s => `
    <div style="background:#1a1130;border:2px solid #C9960C;border-radius:16px;padding:20px;margin:12px 0;">
      <h2 style="color:#FFE082;margin:0 0 12px;">${s.name}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><strong style="color:#FFD700;font-size:24px;">${s.week_earned} 🪙</strong><br><span style="color:#999;font-size:12px;">本周获得</span></div>
        <div><strong style="color:#FF6B9D;font-size:24px;">${s.week_tasks}</strong><br><span style="color:#999;font-size:12px;">完成任务</span></div>
        <div><strong style="color:#9CCC65;font-size:24px;">🔥 ${s.streak}</strong><br><span style="color:#999;font-size:12px;">连续打卡天数</span></div>
        <div><strong style="color:#A78BFA;font-size:24px;">🏆 ${s.achievements_unlocked}</strong><br><span style="color:#999;font-size:12px;">解锁成就</span></div>
      </div>
      ${s.top_task ? `<div style="margin-top:12px;color:#ccc;font-size:13px;">最爱的任务：<strong style="color:#FFE082;">${s.top_task.name}</strong>（${s.top_task.count} 次）</div>` : ''}
      <div style="margin-top:8px;color:#999;font-size:12px;">当前金币：${s.coins} | 累计获得：${s.total_earned} | 等级：Lv.${s.level} | 历史最长连击：${s.streak_longest} 天</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Kelly Coins 周报 ${end}</title>
  <style>
    body { font-family: 'Noto Sans SC', system-ui, sans-serif; background: #0B0620; color: #fff; padding: 20px; max-width: 720px; margin: 0 auto; }
    h1 { color: #FFE082; text-align: center; }
    .header { text-align: center; padding: 20px; border-bottom: 1px solid #444; margin-bottom: 24px; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🪙 Kelly Coins 本周成长报告</h1>
    <p style="color:#999;">${start} ~ ${end}</p>
  </div>
  ${childCards}
  <div class="footer">
    <p>由 Kelly Coins 自动生成 · ${new Date().toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>`;
}

function listReports() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.html'))
    .sort()
    .reverse()
    .map(f => {
      const stat = fs.statSync(path.join(REPORTS_DIR, f));
      return { filename: f, size: stat.size, created: stat.mtime.toISOString() };
    });
}

let timer = null;

function start() {
  // Check every hour if it's Sunday 8pm and we haven't generated this week's report yet
  const checkAndGenerate = () => {
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() === 20) {
      const reports = listReports();
      const today = now.toISOString().slice(0, 10);
      const alreadyGenerated = reports.some(r => r.filename.includes(today));
      if (!alreadyGenerated) {
        try {
          generateReport();
          console.log('[weekly-report] Generated weekly report');
        } catch (e) {
          console.error('[weekly-report] Failed:', e.message);
        }
      }
    }
  };
  // Check now and every hour
  checkAndGenerate();
  if (timer) clearInterval(timer);
  timer = setInterval(checkAndGenerate, 60 * 60 * 1000);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, generateReport, listReports };
