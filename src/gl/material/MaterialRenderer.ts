// pc in runescape_gl.jar (HD only): the material renderer interface. The HD client keeps one renderer per material
// id 1..6 in MaterialManager.materials (aa.t, built by te.e(I)V). MaterialManager.setMaterial (cb.b(III)V) unbinds
// the previous material, binds the next one and passes it the per-texture argument. Ported 1:1 as a TS interface.
// NXT has no GL 1.x classes, so the names are descriptive (HD_PLAN.md 1.3).
//
// Implementations, by material id: 1 SpecularCubeMapMaterial (vm), 2 WaterProgramMaterial (rd),
// 3 UnderwaterMaterial (wg), 4 HighDetailWaterMaterial (pd), 5 ScrollingDetailMaterial (ob), 6 UnlitMaterial (ue).
interface MaterialRenderer {
    // pc.a()V. Undoes bind(): called on the current material when another one is selected.
    unbind(): void;

    // pc.b()V. Sets up the material's GL state, usually by calling its first display list.
    bind(): void;

    // pc.a(I)V. Applies the per-texture argument. Called after bind() and whenever the argument changes.
    setArgument(argument: number): void;

    // pc.c()I. The material's flag bits, read by ef.a(I)I (vm 4, pd 15, the others 0).
    flags(): number;
}

export type { MaterialRenderer as default };
