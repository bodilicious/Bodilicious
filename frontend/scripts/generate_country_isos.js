import fs from 'fs';
import path from 'path';

const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", 
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", 
    "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Côte d'Ivoire", "Cabo Verde", 
    "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", 
    "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Democratic Republic of the Congo", "Denmark", "Djibouti", 
    "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", 
    "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", 
    "Guyana", "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", 
    "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", 
    "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", 
    "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", 
    "Mozambique", "Myanmar (formerly Burma)", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", 
    "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", 
    "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", 
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", 
    "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", 
    "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", 
    "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", 
    "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

async function run() {
    console.log('Fetching countries...');
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2');
    const data = await res.json();
    
    const codeMap = {};
    for (const name of COUNTRIES) {
        let code = 'UN'; // Unknown
        
        // Custom overrides for tricky names
        if (name === "Côte d'Ivoire") code = "CI";
        else if (name === "Congo (Congo-Brazzaville)") code = "CG";
        else if (name === "Democratic Republic of the Congo") code = "CD";
        else if (name === "Eswatini") code = "SZ";
        else if (name === "Holy See") code = "VA";
        else if (name === "Micronesia") code = "FM";
        else if (name === "Myanmar (formerly Burma)") code = "MM";
        else if (name === "Palestine State") code = "PS";
        else if (name === "Sao Tome and Principe") code = "ST";
        else if (name === "United States of America") code = "US";
        else if (name === "Cabo Verde") code = "CV";
        else if (name === "Czechia (Czech Republic)") code = "CZ";
        else {
            const match = data.find(c => 
                c.name.common.toLowerCase() === name.toLowerCase() || 
                (c.name.official && c.name.official.toLowerCase() === name.toLowerCase())
            );
            if (match) code = match.cca2;
            else console.log("Missing ISO for:", name);
        }
        
        codeMap[name] = code;
    }
    
    const outPath = path.join(process.cwd(), 'src/utils/countries.ts');
    
    const content = `export const COUNTRIES = [\n    ${COUNTRIES.map(c => `"${c}"`).join(', ')}\n];\n\n` +
        `export const COUNTRY_ISO_MAP: Record<string, string> = ` + JSON.stringify(codeMap, null, 4) + `;\n\n` +
        `export const getCountryFlag = (countryName: string) => {\n` +
        `  const code = COUNTRY_ISO_MAP[countryName];\n` +
        `  if (!code || code === 'UN') return '🏳️';\n` +
        `  return code.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));\n` +
        `};\n`;
        
    fs.writeFileSync(outPath, content);
    console.log('Done!');
}
run();
