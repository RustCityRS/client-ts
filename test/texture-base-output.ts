import { glJar } from '#/client/ClientVariant.js';
import TextureOp from '#/dash3d/TextureOp.js';
import Minimenu from '#/ui/Minimenu.js';
import WrappedException from '#/util/WrappedException.js';

class BaseOutput extends TextureOp {}

const op = new BaseOutput(0, false);
const initial = Minimenu.hiddenUse;
function call(draw: () => unknown): string {
    try {
        if (draw() !== null) throw new Error('Unexpected texture output');
        return 'null';
    } catch (error) {
        if (!(error instanceof WrappedException) || !error.cause) throw error;
        const cause = error.cause;
        const type = cause instanceof RangeError && cause.message === '/ by zero' ? 'ArithmeticException' : cause.name;
        return error.context + '|' + type + '|' + cause.message;
    }
}

const rows: string[] = [];
for (const row of [-2147483648, 13, 2147483647]) {
    for (let guard = -128; guard <= 127; guard++) rows.push(call(() => op.getMonochromeOutput(row, guard)));
    for (const guard of glJar ? [-2, -1, 0, 1, 2147483647] : [false, true]) {
        Reflect.set(Minimenu, 'hiddenUse', initial);
        rows.push(call(() => op.getColourOutput(row, guard)) + '|' + (glJar || Minimenu.hiddenUse !== null));
    }
}
console.log(rows.join('\n'));
