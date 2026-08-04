import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Extract from COUNTRIES array roughly
const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Côte d'Ivoire", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const COUNTRY_ISO_MAP = {
    "Australia": "AU",
    "Canada": "CA",
    "China": "CN",
    "France": "FR",
    "Germany": "DE",
    "Italy": "IT",
    "Japan": "JP",
    "Singapore": "SG",
    "United Arab Emirates": "AE",
    "United Kingdom": "GB",
    "United States of America": "US",
    "South Africa": "ZA",
    "Saudi Arabia": "SA",
    "Malaysia": "MY",
    "New Zealand": "NZ"
};

const getShiprocketToken = async () => {
    const response = await fetch(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_PASSWORD,
        }),
      }
    );
    const data = await response.json();
    return data.token;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateReport = async () => {
    try {
        const token = await getShiprocketToken();
        const pickupPincode = "600081"; // Chennai origin

        let markdown = `# International Shipping Rates (85g Base)

This table shows the starting base rate (for 85g) for various countries via Shiprocket.

| Country | ISO Code | Estimated Cost (₹) | Fastest ETA |
|---------|----------|-------------------|-------------|
`;

        // Instead of all 195, let's just do a representative 15 to avoid API blocks/timeouts
        const topCountries = Object.keys(COUNTRY_ISO_MAP);

        for (const country of topCountries) {
            const iso = COUNTRY_ISO_MAP[country];
            try {
                let response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/international/serviceability?pickup_postcode=${pickupPincode}&delivery_country=${iso}&weight=0.085&cod=0`, {
                    method: 'GET',
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (response.ok) {
                    let data = await response.json();
                    if (data && data.data && data.data.available_courier_companies && data.data.available_courier_companies.length > 0) {
                        const validCouriers = data.data.available_courier_companies.filter(c => c.blocked === 0);
                        if (validCouriers.length > 0) {
                            const sortedCouriers = validCouriers.sort((a, b) => (a.rate?.total || a.rate?.rate || 0) - (b.rate?.total || b.rate?.rate || 0));
                            const cheapest = sortedCouriers[0];
                            const fastest = validCouriers.sort((a, b) => a.sla_days - b.sla_days)[0];
                            const cost = cheapest.rate?.total || cheapest.rate?.rate || 0;
                            markdown += `| ${country} | ${iso} | ₹${Number(cost).toFixed(2)} | ${fastest.sla_days} days |\n`;
                            console.log(`Processed ${country}`);
                        } else {
                            markdown += `| ${country} | ${iso} | No valid couriers | N/A |\n`;
                            console.log(`No couriers for ${country}`);
                        }
                    } else {
                        markdown += `| ${country} | ${iso} | Not Serviceable | N/A |\n`;
                        console.log(`Not serviceable ${country}`);
                    }
                } else {
                    markdown += `| ${country} | ${iso} | API Error | N/A |\n`;
                    console.log(`API Error ${country}`);
                }
            } catch (err) {
                markdown += `| ${country} | ${iso} | Fetch Error | N/A |\n`;
                console.log(`Fetch Error ${country}:`, err.message);
            }
            await sleep(500); // Prevent rate limits
        }
        
        fs.writeFileSync("C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\de880b2f-b7df-444b-a504-988fd30d58b6\\international_shipping_rates.md", markdown);
        console.log("Done");
    } catch(err) {
        console.error(err);
    }
}

generateReport();
