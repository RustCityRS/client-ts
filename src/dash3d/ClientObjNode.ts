import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SecondaryNode from '#/datastruct/SecondaryNode';
import type ClientObj from './ClientObj';
import { loadClient, loadInterfaceList, loadJagString } from '#/util/GamepackClasses';

// b
export default class ClientObjNode extends SecondaryNode {
    // HD pa.f(B)V
    static releaseClientObjNodeStatics(guard: number): void {
        try {
            if (guard > -112) {
                return;
            }
            const Client = loadClient();
            releaseReferences(Client, 'username', 'password', 'sceneMapUnderwaterLandData');
            const JagString = loadJagString();
            releaseReferences(JagString, 'empty');
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'dirty');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pa.A(' + guard + ')');
        }
    }

    obj: ClientObj; // b.T:Lig;
    // b.<init>(Lig;)V
    constructor(obj: ClientObj) {
        super();
        this.obj = obj;
    }
}
