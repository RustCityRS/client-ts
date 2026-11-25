import Signlink, { onSignlinkRequestSettled } from '#/util/Signlink.js';

async function probe() {
    const signlink = new Signlink();
    const clientClass = {
        getDeclaredMethod() {
            throw new Error('unexpected method request');
        },
        getDeclaredField(name: string) {
            return name;
        }
    };
    try {
        const first = signlink.getDeclaredField(clientClass, 'first');
        const release = signlink.releaseGlLibrary(clientClass);
        const last = signlink.getDeclaredField(clientClass, 'last');
        const queued = [first.status, release.status, last.status, first.next === release, release.next === last, last.next === null, release.type, release.intArg, release.objectArg === clientClass];
        const order: number[] = [];
        await new Promise<void>(resolve => {
            for (const request of [first, release, last])
                onSignlinkRequestSettled(request, () => {
                    order.push(request.type);
                    if (request === last) resolve();
                });
        });
        return [queued, order, [first.status, first.result, release.status, release.result, last.status, last.result]];
    } finally {
        await signlink.stopWorker();
    }
}

const output = document.querySelector('pre');
if (!output) throw new Error('Missing Signlink probe output');
probe()
    .then(value => (output.textContent = JSON.stringify(value)))
    .catch(error => (output.textContent = String(error)));
