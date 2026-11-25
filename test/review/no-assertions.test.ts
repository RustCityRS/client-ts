import { expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

// User rule for the 530 port: no TypeScript non-null assertions (x!, x!.y, x![i]) and no definite-assignment
// assertions (field!: T). A Java null dereference is ported as an explicit throw at the same point (requireNonNull).
const repo = join(import.meta.dir, '..', '..');
const roots = [join(repo, 'src'), join(repo, 'test')];

function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) sources(path, out);
        else if (path.endsWith('.ts')) out.push(path);
    }
    return out;
}

test('src and test contain no non-null or definite-assignment assertions', () => {
    const found: string[] = [];
    for (const file of roots.flatMap(root => sources(root))) {
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node): void => {
            const definite = (ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)) && node.exclamationToken !== undefined;
            if (node.kind === ts.SyntaxKind.NonNullExpression || definite) {
                const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
                found.push(`${relative(repo, file).split(sep).join('/')}:${line + 1}:${character + 1} ${node.getText(source).slice(0, 60)}`);
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    expect(found).toEqual([]);
});

// User rule for the 530 port: Java (int) casts and integer division use `| 0`, never Math.trunc.
test('src and test never call Math.trunc', () => {
    const found: string[] = [];
    for (const file of roots.flatMap(root => sources(root))) {
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node): void => {
            if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Math' && node.name.text === 'trunc') {
                const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
                found.push(`${relative(repo, file).split(sep).join('/')}:${line + 1}:${character + 1}`);
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    expect(found).toEqual([]);
});
