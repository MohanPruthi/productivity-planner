// Tool (function) declarations shared by the Gemini and Groq calls.
const str = (description) => ({ type: 'string', description });

const TOOLS = [
  {
    name: 'create_tasks',
    description: 'Add one or more general to-do tasks. Use one item per task.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Tasks to add',
          items: {
            type: 'object',
            properties: { text: str('Task text, as the user said it minus filler words'), date: str('YYYY-MM-DD, omit for today') },
            required: ['text'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark an existing general task as done, found by its text.',
    parameters: { type: 'object', properties: { query: str('Words from the task text'), date: str('YYYY-MM-DD if the user named a day') }, required: ['query'] },
  },
  { name: 'show_pending', description: 'Show the pending (overdue, not done) tasks.', parameters: { type: 'object', properties: {} } },
  { name: 'move_pending_to_today', description: 'Move all pending overdue tasks to today.', parameters: { type: 'object', properties: {} } },
  {
    name: 'log_dsa',
    description: 'Log a solved LeetCode/DSA problem by its number.',
    parameters: { type: 'object', properties: { number: str('Problem number, digits only'), date: str('YYYY-MM-DD, omit for today') }, required: ['number'] },
  },
  {
    name: 'log_med',
    description: 'Mark a medication dose as taken.',
    parameters: { type: 'object', properties: { slot: { type: 'string', enum: ['morning', 'evening'], description: 'morning or evening (night = evening)' }, date: str('YYYY-MM-DD, omit for today') }, required: ['slot'] },
  },
  { name: 'open_note', description: 'Open an existing note by (approximate) title.', parameters: { type: 'object', properties: { query: str('Note title words') }, required: ['query'] } },
  {
    name: 'append_to_note',
    description: 'Append text to an existing note (a checklist item for checklist notes).',
    parameters: { type: 'object', properties: { query: str('Note title words'), text: str('Text to append') }, required: ['query', 'text'] },
  },
  {
    name: 'create_note',
    description: 'Create a new text note.',
    parameters: { type: 'object', properties: { title: str('Note title'), text: str('Optional body text') }, required: ['title'] },
  },
  {
    name: 'zen',
    description: 'Control the focus timer (Zen Zone).',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['start', 'pause', 'reset', 'mode'] },
        mode: { type: 'string', enum: ['focus', 'short', 'long'], description: 'Only for op=mode (short/long break)' },
      },
      required: ['op'],
    },
  },
  {
    name: 'create_plan',
    description: 'Create a new plan.',
    parameters: { type: 'object', properties: { name: str('Plan name'), cadence: { type: 'string', enum: ['weekly', 'monthly'] } }, required: ['name'] },
  },
  {
    name: 'add_plan_week',
    description: 'Add a new week (or month) period to an existing plan.',
    parameters: { type: 'object', properties: { planQuery: str('Plan name words'), startDate: str('YYYY-MM-DD'), goal: str('Goal text for the period') }, required: ['planQuery'] },
  },
  {
    name: 'navigate',
    description: 'Go to a page of the app.',
    parameters: { type: 'object', properties: { page: { type: 'string', enum: ['dashboard', 'plans', 'dsa', 'board', 'meds', 'contacts', 'notes', 'settings', 'themes'] } }, required: ['page'] },
  },
];

module.exports = { TOOLS };
