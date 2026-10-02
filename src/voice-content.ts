/* Local speech content. Loaded before audio and UI; no DOM, I/O or random draws. */
'use strict';
interface VoiceLineDefinition {
  speaker: string;
  text: string;
  audio?: `./audio/voices/${string}.mp3`;
}
const VOICE_LINES = {
  'tutorial.settle': {
    speaker: 'Prospector',
    text: "Commander, I've found something. We should settle here for a while and harvest these resources. Shall I deploy a command outpost here?",
    audio: './audio/voices/tutorial-1.mp3'
  },
  'tutorial.warning': {
    speaker: 'Prospector',
    text: 'Looks like we are not alone. We need to be prepared for battle.',
    audio: './audio/voices/tutorial-2.mp3'
  },
  'tutorial.economy': {
    speaker: 'Expedition command',
    text: 'First, recruit two more Prospectors from Infantry. Then build a refinery beside an Echo vent and prepare our fighting force.'
  },
  'worker.selected.1': { speaker: 'Worker', text: 'Yes?', audio: './audio/voices/worker-selected-1.mp3' },
  'worker.selected.2': { speaker: 'Worker', text: "What's my mission?", audio: './audio/voices/worker-selected-2.mp3' },
  'worker.selected.3': { speaker: 'Worker', text: 'Just following orders.', audio: './audio/voices/worker-selected-3.mp3' },
  'worker.selected.4': { speaker: 'Worker', text: 'What?', audio: './audio/voices/worker-selected-4.mp3' },
  'infantry.selected.1': { speaker: 'Infantry', text: 'Laser charged.', audio: './audio/voices/infantry-selected-1.mp3' },
  'infantry.selected.2': { speaker: 'Infantry', text: 'Ready when you are.', audio: './audio/voices/infantry-selected-2.mp3' },
  'infantry.selected.3': { speaker: 'Infantry', text: 'Pew pew pew yourself!', audio: './audio/voices/infantry-selected-3.mp3' },
  'infantry.selected.4': { speaker: 'Infantry', text: 'Boots on the ground.', audio: './audio/voices/infantry-selected-4.mp3' }
} as const satisfies Record<string, VoiceLineDefinition>;
type VoiceLineId = keyof typeof VOICE_LINES;
function voiceLine(id: VoiceLineId): VoiceLineDefinition { return VOICE_LINES[id]; }

// Technical unit IDs, not translated names. Only units with matching recordings get a pool.
const SELECTION_VOICE_LINES: Partial<Record<UnitType, readonly VoiceLineId[]>> = {
  worker: ['worker.selected.1', 'worker.selected.2', 'worker.selected.3', 'worker.selected.4'],
  rifle: ['infantry.selected.1', 'infantry.selected.2', 'infantry.selected.3', 'infantry.selected.4']
};
