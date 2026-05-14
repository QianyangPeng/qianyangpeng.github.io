// Storybook Mode page
// Curated children's stories with full-screen TTS reader
// Apple-style typography: large white text, dark background, breathing room

import { showToast } from '../components/toast.js';
import { speak, cancelSpeak, clearHighlight } from '../components/voice.js';

const STORIES = [
  {
    id: 'bunny-mom',
    emoji: '🐰',
    title: '小兔子找妈妈',
    unlock: '完成5个任务后解锁',
    paragraphs: [
      '森林里住着一只小兔子，它有一身雪白雪白的毛。',
      '一天早上，小兔子睡醒了，发现妈妈不见了。它的小心脏跳得好快。',
      '小兔子跑到蘑菇下面，问小蜗牛：你看见我妈妈了吗？小蜗牛慢慢摇了摇头。',
      '小兔子又跑到大树下，问松鼠姐姐。松鼠姐姐说：往前走，过了小河就能看到妈妈。',
      '小兔子轻轻地跳过小河，看到妈妈正坐在花丛里等它呢。',
      '小兔子扑进妈妈温暖的怀里，悄悄说：以后我再也不离开你了。',
      '妈妈笑着摸摸它的耳朵：小宝贝，妈妈一直都在。',
    ],
  },
  {
    id: 'star-moon',
    emoji: '🌟',
    title: '星星和月亮',
    unlock: '完成10个任务后解锁',
    paragraphs: [
      '夜空中住着一颗小星星，每天晚上都会眨眨眼。',
      '小星星最好的朋友是大大的月亮姐姐，她总是温柔地笑着。',
      '一天晚上，小星星问月亮姐姐：为什么你这么亮，我这么小呢？',
      '月亮姐姐说：因为你离我们远一点点，但你的光一样温暖呀。',
      '小星星很开心，决定每天都努力闪亮。',
      '后来，每个晚上，月亮和星星一起照亮回家的路，还有小朋友的梦。',
    ],
  },
  {
    id: 'slow-turtle',
    emoji: '🐢',
    title: '慢慢爬的乌龟',
    unlock: '完成15个任务后解锁',
    paragraphs: [
      '小池塘边住着一只小乌龟，它走路慢慢的，吃东西也慢慢的。',
      '小兔子常常笑它：你怎么这么慢呀？',
      '小乌龟没有生气，只是笑笑，继续慢慢往前走。',
      '有一天，森林里举办比赛，看谁能最先到达山顶。',
      '小兔子跑得飞快，半路上累了，就坐下来睡了一觉。',
      '小乌龟一步一步，慢慢地，慢慢地往山顶爬。',
      '太阳下山的时候，小乌龟终于到了山顶，看到了最美的晚霞。',
    ],
  },
  {
    id: 'spring-garden',
    emoji: '🌸',
    title: '春天的花园',
    unlock: '完成20个任务后解锁',
    paragraphs: [
      '冬天过去了，春天来了。花园里的小花们一个一个睡醒了。',
      '小红花伸伸懒腰，对小黄花说：早上好呀！',
      '蝴蝶飞来飞去，蜜蜂嗡嗡叫，到处都是温暖的阳光。',
      '小种子从泥土里探出小脑袋，好奇地看着新世界。',
      '风轻轻地吹，花瓣慢慢打开，整个花园都香喷喷的。',
      '小朋友们走进花园，笑着说：春天，你好！',
    ],
  },
  {
    id: 'butterfly-trip',
    emoji: '🦋',
    title: '蝴蝶的旅行',
    unlock: '完成25个任务后解锁',
    paragraphs: [
      '一只小蝴蝶有一对美丽的翅膀，五颜六色，像彩虹一样。',
      '今天，它决定去花园外面看一看。',
      '它先飞到一棵大树上，看到松鼠正在收集橡果。',
      '它又飞过小溪，看到一群小鱼在水里跳舞。',
      '它飞到山坡上，看到牛奶一样的白云，飘在蓝蓝的天上。',
      '小蝴蝶玩了一整天，才慢慢飞回家。',
      '它对妈妈说：原来世界这么大，这么美！',
    ],
  },
];

let listEl = null;
let readerEl = null;
let currentStory = null;
let currentParagraphIdx = 0;
let autoPlay = false;
let autoPlayActive = false;

export const storyPage = {
  id: 'story',

  render() {
    const page = document.createElement('div');
    page.className = 'page page--story';

    page.innerHTML = `
      <div class="page__title">
        <span class="page__title-icon">📖</span>
        故事书
      </div>
      <div class="page__subtitle">听妈妈讲故事</div>
      <div class="story-list" id="story-list"></div>
    `;

    listEl = page.querySelector('#story-list');
    renderStoryList();

    return page;
  },

  mount() {
    speak('故事书！选一本最喜欢的吧');
  },

  unmount() {
    listEl = null;
    closeReader();
    clearHighlight();
  }
};

function renderStoryList() {
  if (!listEl) return;
  listEl.innerHTML = '';

  STORIES.forEach((story, idx) => {
    const card = document.createElement('button');
    card.className = 'story-card';
    card.innerHTML = `
      <div class="story-card__emoji">${story.emoji}</div>
      <div class="story-card__info">
        <div class="story-card__title">${story.title}</div>
        <div class="story-card__meta">
          <span class="story-card__count">${story.paragraphs.length}页</span>
          <span class="story-card__dot">·</span>
          <span class="story-card__unlock">${story.unlock}</span>
        </div>
      </div>
      <div class="story-card__arrow">›</div>
    `;
    card.addEventListener('click', () => openReader(story));
    listEl.appendChild(card);
  });
}

function openReader(story) {
  currentStory = story;
  currentParagraphIdx = 0;
  autoPlay = false;
  autoPlayActive = false;

  if (!readerEl) {
    readerEl = document.createElement('div');
    readerEl.className = 'story-reader';
    document.getElementById('app').appendChild(readerEl);
  }

  readerEl.innerHTML = `
    <button class="story-reader__close" aria-label="关闭">×</button>
    <div class="story-reader__header">
      <div class="story-reader__emoji">${story.emoji}</div>
      <div class="story-reader__title">${story.title}</div>
      <div class="story-reader__progress" id="reader-progress"></div>
    </div>
    <div class="story-reader__body" id="reader-body">
      <p class="story-reader__paragraph" id="reader-paragraph"></p>
    </div>
    <div class="story-reader__controls">
      <button class="reader-btn reader-btn--prev" id="reader-prev">‹ 上一页</button>
      <button class="reader-btn reader-btn--auto" id="reader-auto">
        <span class="reader-btn__icon">▶</span>
        <span class="reader-btn__label">自动朗读</span>
      </button>
      <button class="reader-btn reader-btn--next" id="reader-next">下一页 ›</button>
    </div>
  `;

  readerEl.classList.add('story-reader--visible');

  readerEl.querySelector('.story-reader__close').addEventListener('click', closeReader);
  readerEl.querySelector('#reader-prev').addEventListener('click', prevParagraph);
  readerEl.querySelector('#reader-next').addEventListener('click', nextParagraph);
  readerEl.querySelector('#reader-auto').addEventListener('click', toggleAutoPlay);

  // Tap outside text/buttons to advance
  readerEl.querySelector('#reader-body').addEventListener('click', () => {
    if (!autoPlay) nextParagraph();
  });

  renderParagraph();
}

function renderParagraph() {
  if (!readerEl || !currentStory) return;
  const total = currentStory.paragraphs.length;
  const text = currentStory.paragraphs[currentParagraphIdx];

  const para = readerEl.querySelector('#reader-paragraph');
  if (para) {
    para.classList.remove('story-reader__paragraph--in');
    // Force reflow then re-add for animation
    void para.offsetWidth;
    para.textContent = text;
    para.classList.add('story-reader__paragraph--in');
  }

  const progress = readerEl.querySelector('#reader-progress');
  if (progress) {
    let dots = '';
    for (let i = 0; i < total; i++) {
      dots += `<span class="story-reader__dot${i === currentParagraphIdx ? ' story-reader__dot--active' : ''}"></span>`;
    }
    progress.innerHTML = dots;
  }

  const prev = readerEl.querySelector('#reader-prev');
  const next = readerEl.querySelector('#reader-next');
  if (prev) prev.disabled = currentParagraphIdx === 0;
  if (next) next.disabled = currentParagraphIdx >= total - 1;

  if (autoPlay) {
    runAutoPlayStep();
  }
}

function nextParagraph() {
  if (!currentStory) return;
  if (currentParagraphIdx >= currentStory.paragraphs.length - 1) {
    if (autoPlay) stopAutoPlay();
    showToast('故事读完啦！🌟', 'success');
    return;
  }
  cancelSpeak();
  currentParagraphIdx += 1;
  renderParagraph();
}

function prevParagraph() {
  if (!currentStory) return;
  if (currentParagraphIdx <= 0) return;
  cancelSpeak();
  currentParagraphIdx -= 1;
  renderParagraph();
}

function toggleAutoPlay() {
  autoPlay = !autoPlay;
  const btn = readerEl && readerEl.querySelector('#reader-auto');
  if (btn) {
    btn.classList.toggle('reader-btn--active', autoPlay);
    const icon = btn.querySelector('.reader-btn__icon');
    if (icon) icon.textContent = autoPlay ? '⏸' : '▶';
  }
  if (autoPlay) {
    runAutoPlayStep();
  } else {
    stopAutoPlay();
  }
}

async function runAutoPlayStep() {
  if (!currentStory || !autoPlay) return;
  if (autoPlayActive) return; // already mid-step
  autoPlayActive = true;

  const text = currentStory.paragraphs[currentParagraphIdx];
  try {
    await speak(text);
  } catch {
    // silent fail
  }
  autoPlayActive = false;

  // After speak resolves, check if user disabled autoplay or closed reader
  if (!autoPlay || !currentStory) return;

  // If at last paragraph, stop autoplay
  if (currentParagraphIdx >= currentStory.paragraphs.length - 1) {
    stopAutoPlay();
    showToast('故事读完啦！🌟', 'success');
    return;
  }

  // Brief pause then advance
  await new Promise(resolve => setTimeout(resolve, 600));
  if (!autoPlay || !currentStory) return;
  currentParagraphIdx += 1;
  renderParagraph();
}

function stopAutoPlay() {
  autoPlay = false;
  autoPlayActive = false;
  cancelSpeak();
  const btn = readerEl && readerEl.querySelector('#reader-auto');
  if (btn) {
    btn.classList.remove('reader-btn--active');
    const icon = btn.querySelector('.reader-btn__icon');
    if (icon) icon.textContent = '▶';
  }
}

function closeReader() {
  stopAutoPlay();
  cancelSpeak();
  currentStory = null;
  currentParagraphIdx = 0;
  if (readerEl) {
    readerEl.classList.remove('story-reader--visible');
    setTimeout(() => {
      if (readerEl && !readerEl.classList.contains('story-reader--visible')) {
        readerEl.remove();
        readerEl = null;
      }
    }, 300);
  }
}
