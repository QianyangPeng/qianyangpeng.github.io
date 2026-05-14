// Character interaction voice lines — 10 lines per skin
// Each skin has a personality that matches its theme
// Triggered randomly when Kelly taps the hero character on the home page

export const CHARACTER_LINES = {
  default: [
    '你好呀！我是Kelly！',
    '今天你想做什么呢？',
    '我最爱爸爸妈妈啦！',
    '我们一起玩好不好？',
    '你今天真棒呀！',
    '嘻嘻，我喜欢你！',
    '今天真是开心的一天！',
    '你要加油哦！',
    '抱抱我好不好？',
    '我是小Kelly！',
  ],

  princess: [
    '我是漂亮的小公主！',
    '欢迎来到我的城堡！',
    '我的裙子好漂亮吧？',
    '今天我是最美的公主！',
    '要像公主一样优雅哦！',
    '我的魔法权杖可以保护你！',
    '玫瑰花真香呀！',
    '王子殿下在哪里呀？',
    '咯咯咯～我是公主殿下！',
    '来跳一支舞好不好？',
  ],

  knight: [
    '我是勇敢的小骑士！',
    '看我的剑术厉害吧！',
    '我会保护你的！',
    '不要怕，有我在！',
    '坏蛋快快走开！',
    '正义必将胜利！',
    '为了和平而战！',
    '我的盾牌坚不可摧！',
    '冲啊！勇敢向前！',
    '勇者无敌！',
  ],

  mermaid: [
    '我是深海小人鱼！',
    '海底的世界好美呀！',
    '咕噜咕噜～',
    '小鱼小鱼你好呀！',
    '要不要和我一起游泳？',
    '海星是我最好的朋友！',
    '珊瑚礁真漂亮！',
    '你听见海浪的声音了吗？',
    '让我为你唱一首歌～',
    '我的鱼尾亮晶晶的！',
  ],

  astronaut: [
    '我是小宇航员！',
    '我要飞到月亮上玩！',
    '飞向宇宙深处！',
    '看！那是一颗小星星！',
    '失重的感觉好好玩呀！',
    '地球原来是圆的呢！',
    '宇宙飞船准备起飞啦！',
    '三、二、一，发射！',
    '太空好安静呀...',
    '下次我要去火星探险！',
  ],

  fairy: [
    '我是花仙子！',
    '你闻到花香了吗？',
    '让我用魔法为你祝福！',
    '扇扇翅膀飞起来！',
    '小蝴蝶，你好呀！',
    '森林就是我的家！',
    '叮叮当当～魔法生效！',
    '花儿朵朵盛开啦！',
    '我送你一朵小花！',
    '春天真是太美啦！',
  ],
};

// Return a random line for the given skin
export function getRandomLine(skinId) {
  const lines = CHARACTER_LINES[skinId] || CHARACTER_LINES.default;
  return lines[Math.floor(Math.random() * lines.length)];
}

// Cycle through lines so the same one doesn't repeat twice in a row
const lastIndex = new Map(); // skinId → last index used
export function getNextLine(skinId) {
  const lines = CHARACTER_LINES[skinId] || CHARACTER_LINES.default;
  if (lines.length === 0) return '';
  const prev = lastIndex.get(skinId);
  let idx = Math.floor(Math.random() * lines.length);
  if (idx === prev && lines.length > 1) {
    idx = (idx + 1) % lines.length;
  }
  lastIndex.set(skinId, idx);
  return lines[idx];
}
