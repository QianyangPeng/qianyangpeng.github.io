// Icon catalog — single source of truth for the watercolor icon library.
// Each entry maps a stable `key` (icon filename without .png) to its
// human-readable label, the suggested category, and which kind of thing
// it belongs to (task / reward / shop).
//
// Used by:
//   - server seeding (apply `icon_file` to initial tasks/rewards)
//   - /api/icon-catalog endpoint (parent UI icon picker)
//   - migration that back-fills icon_file on existing rows by fuzzy-matching
//     the task/reward name against a keyword list
//
// When you add new icons to client/child/assets/icons/{tasks,rewards,shop}/,
// add a matching entry here. Nothing else in the codebase hardcodes this list.

const TASK_ICONS = [
  { key: 'bath',         label: '洗澡',         keywords: ['洗澡', '泡澡', 'bath'] },
  { key: 'brush-teeth',  label: '刷牙',         keywords: ['刷牙', 'teeth', 'brush'] },
  { key: 'get-dressed',  label: '穿衣服',       keywords: ['穿衣', '穿衣服', 'dress'] },
  { key: 'wash-hands',   label: '洗手',         keywords: ['洗手', 'wash', 'hand'] },
  { key: 'veggies',      label: '吃蔬菜',       keywords: ['蔬菜', '菜', 'vegetable', 'veggie'] },
  { key: 'fruit',        label: '吃水果',       keywords: ['水果', 'fruit'] },
  { key: 'water',        label: '喝水',         keywords: ['喝水', 'water', 'drink'] },
  { key: 'read-book',    label: '看书',         keywords: ['看书', '读书', 'book', 'read'] },
  { key: 'tidy-toys',    label: '收拾玩具',     keywords: ['玩具', '整理', 'toy', 'tidy'] },
  { key: 'share',        label: '分享',         keywords: ['分享', 'share', '陪', 'selina', '一起玩'] },
  { key: 'sweep',        label: '扫地',         keywords: ['扫地', '家务', 'clean', 'sweep', 'chore'] },
  { key: 'water-plant',  label: '浇花',         keywords: ['浇花', '浇水', 'plant', 'water'] },
  { key: 'pet-feed',     label: '喂宠物',       keywords: ['宠物', '喂', 'pet', 'feed'] },
  { key: 'thank-you',    label: '说谢谢',       keywords: ['谢谢', 'thank', 'please', '礼貌'] },
  { key: 'bedtime',      label: '按时睡觉',     keywords: ['睡觉', 'bed', 'sleep', '晚安'] },
  { key: 'draw',         label: '画画',         keywords: ['画画', 'draw', 'art', 'color'] },
];

const REWARD_ICONS = [
  { key: 'chocolate',    label: '巧克力',       keywords: ['巧克力', 'chocolate'] },
  { key: 'ice-cream',    label: '冰淇淋',       keywords: ['冰淇淋', 'ice', 'cream'] },
  { key: 'lollipop',     label: '棒棒糖',       keywords: ['棒棒糖', 'lollipop', 'candy'] },
  { key: 'cookie',       label: '饼干',         keywords: ['饼干', 'cookie', 'biscuit'] },
  { key: 'pudding',      label: '布丁',         keywords: ['布丁', 'pudding'] },
  { key: 'fruit-basket', label: '水果篮',       keywords: ['水果', 'basket', 'fruit'] },
  { key: 'books',        label: '故事书',       keywords: ['故事书', '书', 'book', 'story'] },
  { key: 'stickers',     label: '贴纸',         keywords: ['贴纸', 'sticker'] },
  { key: 'crayons',      label: '蜡笔',         keywords: ['蜡笔', 'crayon'] },
  { key: 'teddy',        label: '小熊玩偶',     keywords: ['小熊', 'teddy', 'bear', 'toy', '娃娃', '玩偶', '衣服'] },
  { key: 'movie',        label: '电影票',       keywords: ['电影', 'movie', 'film', 'cinema', 'youtube', '视频'] },
  { key: 'park',         label: '公园',         keywords: ['公园', 'park', '出去玩'] },
  { key: 'swimming',     label: '游泳',         keywords: ['游泳', 'swim', 'pool'] },
  { key: 'picnic',       label: '野餐',         keywords: ['野餐', 'picnic'] },
  { key: 'playground',   label: '游乐场',       keywords: ['游乐场', 'playground', '滑梯', 'bouncing', 'house'] },
  { key: 'zoo',          label: '动物园',       keywords: ['动物园', 'zoo', '迪士尼', 'disney'] },
];

const SHOP_ICONS = [
  { key: 'magic-wand',    label: '魔法棒',      keywords: ['魔法棒', 'wand'] },
  { key: 'wings',         label: '蝴蝶翅膀',    keywords: ['翅膀', '蝴蝶', 'wing', 'butterfly'] },
  { key: 'flower-crown',  label: '花环',        keywords: ['花环', '皇冠', 'crown', 'flower'] },
  { key: 'gold-star',     label: '金星星',      keywords: ['星星', 'star'] },
  { key: 'rainbow-bow',   label: '彩虹蝴蝶结',  keywords: ['蝴蝶结', '彩虹', 'bow', 'ribbon', 'rainbow'] },
  { key: 'tiara',         label: '公主皇冠',    keywords: ['皇冠', '公主', 'tiara', 'princess'] },
  { key: 'sparkles',      label: '闪光',        keywords: ['闪光', 'sparkle', 'shine'] },
  { key: 'heart-clip',    label: '爱心发夹',    keywords: ['发夹', '爱心', 'clip', 'heart'] },
  { key: 'bouquet',       label: '花束',        keywords: ['花束', 'bouquet', 'flower'] },
  { key: 'music-note',    label: '音符',        keywords: ['音符', 'music', 'note'] },
  { key: 'balloon',       label: '气球',        keywords: ['气球', 'balloon'] },
  { key: 'teddy-bear',    label: '小熊',        keywords: ['小熊', 'teddy', 'bear'] },
  { key: 'bunny',         label: '兔子玩偶',    keywords: ['兔子', 'bunny', 'rabbit'] },
  { key: 'rainbow',       label: '彩虹',        keywords: ['彩虹', 'rainbow'] },
  { key: 'unicorn-horn',  label: '独角兽角',    keywords: ['独角兽', 'unicorn'] },
  { key: 'palette',       label: '调色板',      keywords: ['调色板', '画', 'palette', 'paint'] },
];

// Default seeds for new installs: each entry is a full task/reward/shop object
// with icon_file wired up. Parents start with these and can add/remove via
// the parent dashboard. The catalog above is the superset parents can pick from.

const DEFAULT_TASKS = [
  { name: '陪Selina玩',   coins: 1, icon_emoji: '🎀', icon_file: 'share',       duration_minutes: 15, coins_per_interval: 1 },
  { name: '洗澡',         coins: 2, icon_emoji: '🛁', icon_file: 'bath' },
  { name: '自己刷牙',     coins: 1, icon_emoji: '🦷', icon_file: 'brush-teeth' },
  { name: '自己穿衣服',   coins: 1, icon_emoji: '👗', icon_file: 'get-dressed' },
  { name: '整理玩具',     coins: 1, icon_emoji: '🧸', icon_file: 'tidy-toys' },
  { name: '吃完所有蔬菜', coins: 2, icon_emoji: '🥦', icon_file: 'veggies' },
  { name: '帮妈妈做家务', coins: 2, icon_emoji: '🧹', icon_file: 'sweep' },
  { name: '洗手',         coins: 1, icon_emoji: '🧼', icon_file: 'wash-hands' },
  { name: '喝水',         coins: 1, icon_emoji: '💧', icon_file: 'water' },
  { name: '读一本书',     coins: 2, icon_emoji: '📖', icon_file: 'read-book' },
  { name: '画一幅画',     coins: 1, icon_emoji: '🎨', icon_file: 'draw' },
  { name: '按时睡觉',     coins: 2, icon_emoji: '🌙', icon_file: 'bedtime' },
];

const DEFAULT_REWARDS = [
  { name: '巧克力',       coins_cost: 1,   icon_emoji: '🍫', icon_file: 'chocolate',    category: 'real' },
  { name: '冰淇淋',       coins_cost: 1,   icon_emoji: '🍦', icon_file: 'ice-cream',    category: 'real' },
  { name: '10分钟YouTube',coins_cost: 1,   icon_emoji: '📺', icon_file: 'movie',        category: 'real' },
  { name: 'Bouncing House',coins_cost: 10, icon_emoji: '🎪', icon_file: 'playground',   category: 'real' },
  { name: '迪士尼乐园',   coins_cost: 200, icon_emoji: '🏰', icon_file: 'zoo',          category: 'real' },
  { name: '故事书一本',   coins_cost: 3,   icon_emoji: '📚', icon_file: 'books',        category: 'real' },
  { name: '小熊玩偶',     coins_cost: 8,   icon_emoji: '🧸', icon_file: 'teddy',        category: 'real' },
  { name: '一盒蜡笔',     coins_cost: 6,   icon_emoji: '🖍️', icon_file: 'crayons',      category: 'real' },
  { name: '贴纸一张',     coins_cost: 2,   icon_emoji: '⭐', icon_file: 'stickers',     category: 'real' },
  { name: '公园玩一次',   coins_cost: 4,   icon_emoji: '🌳', icon_file: 'park',         category: 'real' },
  { name: '野餐一次',     coins_cost: 6,   icon_emoji: '🧺', icon_file: 'picnic',       category: 'real' },
  { name: '游泳',         coins_cost: 8,   icon_emoji: '🏊', icon_file: 'swimming',     category: 'real' },
];

// Fuzzy-match a name to a catalog entry. Used by the migration that adds
// icon_file to existing rows created before the catalog existed.
function findIconForName(name, pool) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const entry of pool) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) return entry.key;
    }
  }
  return null;
}

module.exports = {
  TASK_ICONS,
  REWARD_ICONS,
  SHOP_ICONS,
  DEFAULT_TASKS,
  DEFAULT_REWARDS,
  findIconForName,
};
