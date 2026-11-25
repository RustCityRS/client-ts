import { afterEach } from 'bun:test';
import Client from '#/client/Client.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';

let restoreJs5: (() => void) | null = null;

export function createJs5Client(gameState: number): { client: Client; queue: Js5NetQueue } {
    restoreJs5?.();
    const fields = ['js5NetQueue', 'js5ConnectStage', 'js5ConnectStream', 'js5ConnectTime', 'js5RetryDelay', 'js5LastErrorCount', 'js5SocketRequest'] as const;
    const saved = fields.map(name => Client[name]);
    const oldState = Client.gameState;
    Client.js5NetQueue = new Js5NetQueue();
    Client.js5ConnectStage = 0;
    Client.js5ConnectStream = null;
    Client.js5ConnectTime = 0n;
    Client.js5RetryDelay = 0;
    Client.js5LastErrorCount = 0;
    Client.js5SocketRequest = null;
    Client.gameState = gameState;
    restoreJs5 = () => {
        for (let i = 0; i < fields.length; i++) Reflect.set(Client, fields[i], saved[i]);
        Client.gameState = oldState;
        restoreJs5 = null;
    };
    return { client: new Client(), queue: Client.js5NetQueue };
}

afterEach(() => restoreJs5?.());
