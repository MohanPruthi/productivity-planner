// Prints what the offline rule parser makes of a few phrases. Run: node src/assistant/selftest.js
const { parse } = require('./rules');
const { parseDatePhrase } = require('./dates');
const { bestMatch } = require('./fuzzy');

const today = '2026-11-11'; // a Wednesday
const phrases = [
  'add task buy milk tomorrow',
  'add tasks call mom, pay rent and book dentist on 14th',
  'log dsa 125',
  'log morning med',
  'start zen',
  'open dsa page',
  'complete task buy milk',
  'add task submit report next monday',
];
for (const p of phrases) console.log(JSON.stringify(p), '=>', JSON.stringify(parse(p, today)));

console.log('date next monday ->', parseDatePhrase('next monday', today));
const notes = [{ title: 'Grocery list' }, { title: 'System design ideas' }, { title: 'Meeting notes' }];
console.log('fuzzy "grocery" ->', bestMatch('grocery', notes)?.item.title, '| "sys design" ->', bestMatch('sys design', notes)?.item.title, '| "zzz" ->', bestMatch('zzz', notes));
