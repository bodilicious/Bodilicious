import cron from "node-cron";
import StoreSettings from "../settings/models.js";

const fetchExchangeRate = async () => {
    try {
        // Using ExchangeRate-API (free, no key required) with base INR
        const response = await fetch("https://open.er-api.com/v6/latest/INR");
        if (!response.ok) {
            throw new Error(`ExchangeRate-API responded with ${response.status}`);
        }
        
        const data = await response.json();
        const rates = data?.rates;
        
        if (!rates || typeof rates !== "object" || !rates.USD) {
            throw new Error(`Invalid rate received: ${JSON.stringify(data)}`);
        }
        
        // Strictly update existing settings, DO NOT upsert silently
        const existing = await StoreSettings.findOne({});
        if (existing) {
            await StoreSettings.updateOne(
                { _id: existing._id },
                { 
                    $set: { 
                        exchangeRates: rates,
                        exchangeRatesLastUpdated: new Date(),
                        // keep backward compatibility for anything expecting usdExchangeRate
                        usdExchangeRate: 1 / rates.USD,
                        usdExchangeRateLastUpdated: new Date()
                    } 
                }
            );
        } else {
            console.error('CRON ERROR: StoreSettings document missing. Aborting rate update. This is an ops incident and requires manual intervention to recreate StoreSettings.');
            return false;
        }
        
        console.log(`[Cron] Successfully updated exchange rates for ${Object.keys(rates).length} currencies. USD rate: ${rates.USD}`);
        return true;
    } catch (err) {
        console.error("[Cron] Failed to fetch exchange rate:", err.message);
        return false;
    }
};

const retryFetch = async (attemptsLeft, delayMs = 6 * 60 * 60 * 1000) => {
    const success = await fetchExchangeRate();
    if (!success && attemptsLeft > 1) {
        console.log(`[Cron] Exchange rate fetch failed. Retrying in ${delayMs / 1000 / 60 / 60} hours. Attempts left: ${attemptsLeft - 1}`);
        setTimeout(() => retryFetch(attemptsLeft - 1, delayMs), delayMs);
    }
};

// Run every day at 1:00 AM (server time)
export const initExchangeRateCron = () => {
    // Also run it once on startup if it's very stale or null
    StoreSettings.findOne().then(settings => {
        if (!settings || !settings.exchangeRatesLastUpdated) {
            fetchExchangeRate();
        } else {
            const msSinceUpdate = Date.now() - new Date(settings.exchangeRatesLastUpdated).getTime();
            if (msSinceUpdate > 24 * 60 * 60 * 1000) {
                fetchExchangeRate();
            }
        }
    }).catch(err => console.error("Error checking initial exchange rate:", err.message));

    // Schedule daily run
    cron.schedule("0 1 * * *", () => {
        console.log("[Cron] Starting daily exchange rate update...");
        // 3 total attempts, wait 6 hours between failures
        retryFetch(3, 6 * 60 * 60 * 1000);
    });
};
