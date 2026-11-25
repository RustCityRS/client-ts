export function releaseReferences<K extends string>(owner: Record<K, unknown>, ...fields: K[]): void {
    for (const field of fields) owner[field] = null;
}
