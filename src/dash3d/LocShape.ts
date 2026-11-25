// Loc shape tables, gathered from scattered statics by the member map.
export default class LocShape {
    // th.e:[I. The scene layer each of the 23 loc shapes occupies: 0 wall, 1 wall decor, 2 scenery, 3 ground decor.
    static readonly shapeToLayer: Int32Array = Int32Array.of(0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3);
}
