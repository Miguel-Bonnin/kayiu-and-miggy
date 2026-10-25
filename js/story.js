// The words on the page. Edit freely.
// Times are local to each spread: 0 = the spread starts rising, 1 = its page has turned.
// Bubbles: [who, from, to, text, style?]. The text types itself on over the first half of its range.
// In the text, *word* is italic and **word** is bold. style 'think' draws a thought bubble.

export const SPREADS = [
  { // 1
    caption: 'Lammas, Staines · May 2010',
    bubbles: [
      ['miggy', .24, .38, 'So... fancy feeding the swans with me again on Saturday?'],
      ['kayiu', .38, .50, 'Miggy. Are you asking me out?'],
      ['miggy', .50, .62, '...Maybe? Yes. Yes, I am.'],
      ['kayiu', .62, .76, 'Took you long enough.'],
    ],
  },
  { // 2
    caption: 'Santorini',
    bubbles: [
      ['kayiu', .28, .48, 'Okay, this view is ridiculous.'],
      ['miggy', .48, .70, '*Muy bieeeen!*'],
    ],
  },
  { // 3
    caption: 'Venice',
    bubbles: [
      ['kayiu', .30, .50, 'Look, a gondola! Can we?'],
      ['miggy', .50, .72, 'Have you seen the prices? ...Fine. Yes.'],
    ],
  },
  { // 4
    caption: 'Catbells, Lake District · 2022',
    bubbles: [
      ['kayiu', .20, .36, "Isn't it gorgeous up here?"],
      ['miggy', .32, .47, 'Crap. *Not now...*', 'think'],
      ['miggy', .48, .62, 'Yep. Very... busy.'],
      ['miggy', .62, .78, 'Shall we walk down by the lake instead?'],
    ],
  },
  { // 5
    caption: 'Derwentwater · 2022',
    bubbles: [
      ['miggy', .30, .52, 'Kayiu... will you marry me?'],
      ['kayiu', .54, .74, 'YES! Obviously yes!'],
    ],
  },
  { // 6
    caption: 'The long engagement',
    bubbles: [
      ['kayiu', .34, .56, 'Any day now, Miggy...'],
      ['miggy', .58, .80, 'Please, *just* another year, I am *almost* **Dr. Juan Miguel Carreon Bonnin!**'],
    ],
  },
  { // 7: Kew. The lights go out at about .5 and the save-the-date rises.
    caption: 'Kew Gardens · 15 May 2028',
    bubbles: [
      ['kayiu', .70, .84, "We'd love for you to spend the day with us."],
      ['miggy', .84, .97, 'Hope you can **save the date!**'],
    ],
  },
];

// 繁體中文 (Traditional Chinese). Same timings as above; *斜體* and **粗體** work the same way.
export const SPREADS_ZH = [
  { caption: '斯坦斯 · 拉馬斯河畔 · 2010年5月', bubbles: [
    ['miggy', .24, .38, '那個……星期六要不要再一起去餵天鵝？'],
    ['kayiu', .38, .50, 'Miggy，你這是在約我嗎？'],
    ['miggy', .50, .62, '……也許？對。對，我是在約你。'],
    ['kayiu', .62, .76, '你終於開口了。'],
  ] },
  { caption: '聖托里尼', bubbles: [
    ['kayiu', .28, .48, '天啊，這風景也太美了吧。'],
    ['miggy', .48, .70, '*Muy bieeeen!*'],
  ] },
  { caption: '威尼斯', bubbles: [
    ['kayiu', .30, .50, '看，貢多拉！我們可以坐嗎？'],
    ['miggy', .50, .72, '你看到價錢了嗎？……好啦，坐吧。'],
  ] },
  { caption: '英國湖區 · Catbells 山頂 · 2022年', bubbles: [
    ['kayiu', .20, .36, '山頂好美喔，對不對？'],
    ['miggy', .32, .47, '糟了。*不是現在……*', 'think'],
    ['miggy', .48, .62, '對。人……好多。'],
    ['miggy', .62, .78, '要不要改去湖邊走走？'],
  ] },
  { caption: '德文特湖 · 2022年', bubbles: [
    ['miggy', .30, .52, 'Kayiu……你願意嫁給我嗎？'],
    ['kayiu', .54, .74, '願意！當然願意！'],
  ] },
  { caption: '漫長的訂婚期', bubbles: [
    ['kayiu', .34, .56, 'Miggy，我還在等喔……'],
    ['miggy', .58, .80, '拜託，*再*一年就好，我*快要*變成 **Dr. Juan Miguel Carreon Bonnin** 了！'],
  ] },
  { caption: '倫敦邱園 · 2028年5月15日', bubbles: [
    ['kayiu', .70, .84, '誠摯邀請您與我們共度這一天。'],
    ['miggy', .84, .97, '請**預留這一天**！'],
  ] },
];

// Words drawn into the 3D scene (the cover and the save-the-date leaf)
export const SCENE_TEXT = {
  en: { cover: '~ a story in pages ~', coverFont: 'italic 84px "IM Fell English"',
    leaf: [['italic 64px "IM Fell English"', 'Save the date', .2], ['500 150px "Cormorant Garamond"', 'Miggy & Kayiu', .34],
      ['600 74px "Cormorant Garamond"', 'Monday 15 May 2028', .46], ['500 64px "Cormorant Garamond"', 'Kew Gardens', .55],
      ['italic 48px "IM Fell English"', 'eighteen years to the day', .64]] },
  zh: { cover: '～ 我們的故事 ～', coverFont: '600 90px "Noto Serif TC"',
    leaf: [['600 66px "Noto Serif TC"', '敬請預留日期', .2], ['500 150px "Cormorant Garamond"', 'Miggy & Kayiu', .34],
      ['700 72px "Noto Serif TC"', '2028年5月15日（星期一）', .46], ['600 64px "Noto Serif TC"', '倫敦邱園', .555],
      ['500 50px "Noto Serif TC"', '在一起，整整十八年', .645]] },
};
