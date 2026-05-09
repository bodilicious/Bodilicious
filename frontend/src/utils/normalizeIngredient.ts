export function normalizeIngredient(name: string): string {
    if (!name) return '';
    return name
        .trim()
        .toLowerCase()
        .replace(/\(.*\)/g, '') // Remove parentheticals (e.g., "(Vitamin B3)")
        .replace(/[^a-z0-9]+/g, '-') // Replace special chars with dashes
        .replace(/(^-|-$)/g, ''); // Trim leading/trailing dashes
}
