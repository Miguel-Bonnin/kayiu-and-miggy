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
      ['miggy', .84, 1.01, 'Hope you can **save the date!**'],
    ],
  },
];
