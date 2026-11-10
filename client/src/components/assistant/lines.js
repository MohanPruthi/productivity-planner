// Blipo never speaks: replies are short quirky lines shown in the bubble.
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const DONE = ['Yeaa ofccc', 'Done, master', 'On it, boss', 'Whatever you say', 'Logged it, legend', 'Easy peasy', 'Consider it done', 'Nailed it, boss'];
const PARTIAL = ['Did most of it, boss', 'Mostly done, boss', 'Some done, some not', 'Half the job, boss'];
const CONFUSED = ['Huh? Say that again?', 'My antenna got confused', 'Come again, boss?', 'Lost me there, boss'];
const ERRORS = {
  stt: ['Ears tired. Try later?', "Can't hear a thing, boss", 'My ears are off, boss'],
  mic: ["Can't reach the mic, boss", 'Mic says no, boss'],
  llm_quota: ['Brain quota gone, boss', 'Out of thinking juice'],
  llm_down: ['Brain is napping, boss', 'Brain went offline, boss'],
  not_found: ["Couldn't find that one", 'Not finding that, boss'],
  network: ['Lost signal, boss', 'Network hiccup, boss'],
  bad_request: CONFUSED,
  generic: ['Oops, that broke, boss', 'Something went wonky'],
};

export const errorLine = (kind) => pick(ERRORS[kind] || ERRORS.generic);
export const confusedLine = () => pick(CONFUSED);

// Turns a /command or /confirm response into what the bubble shows.
export const bubbleForResponse = (res) => {
  const sub = (res.results || []).map((r) => r.summary).filter(Boolean).join(' · ');
  if (res.reply === 'confirm' && res.confirm) {
    return { kind: 'confirm', text: res.confirm.summary, token: res.confirm.token };
  }
  if (res.reply === 'error') return { kind: 'error', text: errorLine(res.errorKind), sub };
  if (res.reply === 'partial') return { kind: 'reply', text: pick(PARTIAL), sub };
  if (res.reply === 'confused') return { kind: 'reply', text: pick(CONFUSED), sub };
  return { kind: 'reply', text: pick(DONE), sub };
};
