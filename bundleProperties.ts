import { resolve } from 'node:path';
import ts from 'typescript';
import type { ManglePropertiesOptions } from 'terser';

function isClassMember(node: ts.Node): node is ts.MethodDeclaration | ts.PropertyDeclaration | ts.AccessorDeclaration | ts.ParameterPropertyDeclaration {
    return ((ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isAccessor(node)) && ts.isClassLike(node.parent)) || ts.isParameterPropertyDeclaration(node, node.parent);
}

export function clientPropertyMangling(entrypoint: string, sources: string[]): ManglePropertiesOptions {
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const { options, fileNames } = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
    const program = ts.createProgram([...sources, ...fileNames.filter(name => name.endsWith('.d.ts'))], options);
    const checker = program.getTypeChecker();
    const clientFiles = new Set(sources.filter(name => /^src[/\\].*\.ts$/.test(name) && !name.endsWith('.d.ts')).map(name => resolve(name)));
    const members = new Set<string>();
    const reserved = new Set<string>();
    const accesses: ts.PropertyAccessExpression[] = [];

    function visit(node: ts.Node, clientFile: boolean): void {
        if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
            // Includes reflection keys, serialized names and code loaded in a separate JS context.
            for (const word of node.text.match(/[$A-Z_a-z][$\w]*/g) ?? []) reserved.add(word);
        } else if (!clientFile && ts.isIdentifier(node)) {
            reserved.add(node.text);
        } else if (clientFile) {
            if (isClassMember(node) && ts.isIdentifier(node.name)) {
                members.add(node.name.text);
            } else if (ts.isPropertyAccessExpression(node)) {
                accesses.push(node);
            } else if (ts.isClassElement(node) || ts.isTypeElement(node) || ts.isObjectLiteralElementLike(node) || ts.isBindingElement(node)) {
                const name = ts.isBindingElement(node) ? (node.propertyName ?? node.name) : node.name;
                if (name && ts.isIdentifier(name)) reserved.add(name.text);
            }
        }
        ts.forEachChild(node, child => visit(child, clientFile));
    }

    for (const file of program.getSourceFiles()) {
        visit(file, clientFiles.has(resolve(file.fileName)));
    }

    // Terser renames a spelling across the whole bundle. Every dotted use must resolve to a client class member.
    for (const access of accesses) {
        const name = access.name.text;
        if (!members.has(name) || reserved.has(name)) continue;
        const declarations = checker.getSymbolAtLocation(access.name)?.getDeclarations();
        if (!declarations?.length || !declarations.every(d => isClassMember(d) && clientFiles.has(resolve(d.getSourceFile().fileName)))) {
            reserved.add(name);
        }
    }

    // Embedders import Client from the finished module. Keep its public instance and static API, including inherited members.
    const entry = program.getSourceFile(entrypoint);
    const client = entry?.statements.find(s => ts.isClassDeclaration(s) && s.name?.text === 'Client');
    if (!client || !ts.isClassDeclaration(client) || !client.name) throw new Error('Missing browser Client export');
    const symbol = checker.getSymbolAtLocation(client.name)!;
    for (const type of [checker.getDeclaredTypeOfSymbol(symbol), checker.getTypeOfSymbolAtLocation(symbol, client)]) {
        for (const property of type.getProperties()) {
            const declaration = property.valueDeclaration;
            if (!declaration || !(ts.getCombinedModifierFlags(declaration) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected))) reserved.add(property.name);
        }
    }

    const eligible = [...members].filter(name => !reserved.has(name)).map(name => name.replaceAll('$', '\\$'));
    return { regex: new RegExp('^(?:' + eligible.join('|') + ')$'), reserved: [...reserved], keep_quoted: true };
}
