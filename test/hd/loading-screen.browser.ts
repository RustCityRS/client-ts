import GameShell from '#/client/GameShell.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';

const canvas = requireNonNull(document.querySelector('canvas'));
const stages = JSON.parse(requireNonNull(requireNonNull(document.querySelector('#stages')).textContent)) as [string, string, number, boolean, number][];
GameShell.canvas = canvas;
GameShell.m_sWid = canvas.width;
GameShell.m_sHei = canvas.height;
const frames: string[] = [];
for (const [heading, status, percent, clear, repeats] of stages) {
    GameShell.progressTitle = fromJsString(heading);
    for (let i = 0; i < repeats; i++) GameShell.drawProgress(percent, clear && i === 0, fromJsString(status), null);
    frames.push(canvas.toDataURL());
}
requireNonNull(document.querySelector('#result')).textContent = JSON.stringify(frames);
