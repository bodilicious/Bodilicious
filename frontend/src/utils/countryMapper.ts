// A robust mapper from common country names to ISO-3166-1 alpha-2 codes.
// Specifically tailored for Zippopotam.us autofill which requires the alpha-2 code.

const COUNTRY_TO_ISO: Record<string, string> = {
    // North America
    'united states': 'us',
    'united states of america': 'us',
    'us': 'us',
    'usa': 'us',
    'canada': 'ca',
    'mexico': 'mx',

    // Europe
    'united kingdom': 'gb',
    'uk': 'gb',
    'great britain': 'gb',
    'england': 'gb',
    'germany': 'de',
    'deutschland': 'de',
    'france': 'fr',
    'italy': 'it',
    'italia': 'it',
    'spain': 'es',
    'españa': 'es',
    'netherlands': 'nl',
    'holland': 'nl',
    'belgium': 'be',
    'switzerland': 'ch',
    'austria': 'at',
    'sweden': 'se',
    'norway': 'no',
    'denmark': 'dk',
    'finland': 'fi',
    'poland': 'pl',
    'ireland': 'ie',
    'portugal': 'pt',

    // Oceania
    'australia': 'au',
    'new zealand': 'nz',

    // Asia (Limited Zippopotamus support, mostly Japan/India)
    'japan': 'jp',
    'india': 'in', // Note: India has its own API in Bodilicious, but mapped here just in case
    'bharat': 'in',
    'south korea': 'kr',
    
    // South America
    'brazil': 'br',
    'brasil': 'br',
    'argentina': 'ar',
    'chile': 'cl',
    
    // Africa
    'south africa': 'za',
};

export const getIsoAlpha2Code = (countryName: string): string | null => {
    if (!countryName) return null;
    const normalized = countryName.trim().toLowerCase();
    
    // Direct hit
    if (COUNTRY_TO_ISO[normalized]) {
        return COUNTRY_TO_ISO[normalized];
    }

    // Fallback search
    const entries = Object.entries(COUNTRY_TO_ISO);
    for (const [name, code] of entries) {
        if (normalized.includes(name) || name.includes(normalized)) {
            return code;
        }
    }
    
    return null;
};
