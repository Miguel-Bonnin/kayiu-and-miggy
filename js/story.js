// The words on the page. Edit freely: every range is in scroll progress p (0 = top of the page, 1 = the end).

// Comic caption boxes, top-left of the screen: [from, to, text]
export const CAPTIONS = [
  [0.20, 0.66, 'Lammas, Staines · May 2010'],
  [0.84, 1.01, 'Kew Gardens · 15 May 2027'],
];

// Speech bubbles: [who, from, to, text]. The text types itself on over the first part of the range.
export const BUBBLES = [
  ['miggy', 0.37, 0.44, 'So... fancy feeding the swans with me again on Saturday?'],
  ['kayiu', 0.44, 0.50, 'Miggy. Are you asking me out?'],
  ['miggy', 0.50, 0.56, '...Maybe? Yes. Yes, I am.'],
  ['kayiu', 0.56, 0.62, 'Took you long enough.'],
  ['kayiu', 0.90, 0.99, 'Seventeen years later...'],
  ['miggy', 0.93, 1.01, 'Still feeding the swans with you.'],
];
