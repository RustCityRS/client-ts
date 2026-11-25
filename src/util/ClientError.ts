import Signlink from './Signlink';
import GameShell from '#/client/GameShell';
import ThreadUtils from './ThreadUtils';
import WrappedException from './WrappedException';
import { requireNonNull } from './JavaArray';
import { JavaError } from './JavaException';
export { JavaError } from './JavaException';

// oj.a(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;I)Ljava/lang/String;
export function replaceText(replacement: string, needle: string, input: string): string {
    let index = input.indexOf(needle);
    while (index !== -1) {
        input = input.substring(0, index) + replacement + input.substring(needle.length + index);
        index = input.indexOf(needle, replacement.length + index);
    }
    return input;
}

// The JVM supplies Throwable.printStackTrace. The browser supplies Error.stack.
function printedStack(error: Error): string {
    const stack = error.stack ?? '';
    return stack.startsWith(error.toString()) ? stack : error.toString() + '\n' + stack;
}

// uc.a(BLjava/lang/Throwable;)Ljava/lang/String;
export function compactTrace(error: Error): string {
    let result = '';
    if (error instanceof WrappedException) {
        result = error.context + ' | ';
        error = requireNonNull(error.cause);
    }
    const lines = printedStack(error).split(/\r\n|\n|\r/);
    const first = lines.shift();
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
        const open = line.indexOf('(');
        const close = line.indexOf(')', open + 1);
        let name = (open === -1 ? line : line.substring(0, open)).trim();
        name = name.substring(name.lastIndexOf(' ') + 1);
        name = name.substring(name.lastIndexOf('\t') + 1);
        result += name;
        if (open !== -1 && close !== -1) {
            const source = line.indexOf('.java:', open);
            if (source >= 0) result += line.substring(source + 5, close);
        }
        result += ' ';
    }
    return result + '| ' + first;
}

// he.a(Ljava/lang/String;I)V
function logError(message: string): void {
    console.log('Error: ' + replaceText('\n', '%0a', message));
}

// The applet uses Signlink to open a stream relative to getCodeBase().
// A page uses fetch and provides its browser runtime identification.
export const clientErrorHost = {
    base: null as URL | null,
    // mf.j:I
    revision: 0,
    // si.h:J
    username: 0n
};

// pk.a(Ljava/lang/Throwable;Ljava/lang/String;I)V
export async function reportClientError(error: Error | null, message: string | null): Promise<void> {
    try {
        let text = '';
        if (error !== null) text = compactTrace(error);
        if (message !== null) {
            if (error !== null) text += ' | ';
            text += message;
        }
        logError(text);
        text = replaceText('%3a', ':', text);
        text = replaceText('%40', '@', text);
        text = replaceText('%26', '&', text);
        text = replaceText('%23', '#', text);
        const signlink = requireNonNull(GameShell.errorSignlink);
        if (signlink.applet === null || clientErrorHost.base === null) return;
        const path = 'clienterror.ws?c=' + clientErrorHost.revision + '&u=' + clientErrorHost.username + '&v1=' + Signlink.javaVendor + '&v2=' + Signlink.javaVersion + '&e=' + text;
        const task = signlink.openUrl(new URL(path, clientErrorHost.base));
        while (task.status === 0) await ThreadUtils.sleep(1n);
        if (task.status === 1) {
            const stream = requireNonNull(task.result);
            await stream.read();
            await stream.close();
        }
    } catch (failure) {
        if (!(failure instanceof Error) || failure instanceof JavaError) throw failure;
    }
}
