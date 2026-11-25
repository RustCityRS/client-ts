import { glJar } from '#/client/ClientVariant';

// Both 530 gamepacks use the native world. The isolated legacy fixtures can still select their original scene.
export default class SceneCutover {
    static native = true;

    static get active(): boolean {
        return SceneCutover.native || glJar;
    }
}
