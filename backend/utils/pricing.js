/**
 * GST component contained WITHIN an already-tax-inclusive amount.
 *
 * Listed prices are MRP — the customer pays exactly what the product page shows,
 * and GST is already inside that number. So this BACKS THE TAX OUT for display
 * and invoicing rather than adding anything: `finalAmount` is never changed by
 * calling this, which is why enabling it cannot alter what anyone is charged.
 *
 *     tax = gross − gross / (1 + rate)
 *
 * Applied to goods + shipping less discount, because under GST delivery is part
 * of a composite supply taxed at the same rate, and tax is due on the actual
 * transaction value (i.e. after any discount).
 *
 * Returns 0 for a zero/absent rate, which is also the correct treatment for
 * exports — those are zero-rated, so callers pass rate 0 for international
 * orders rather than special-casing here.
 */
export const calculateInclusiveTax = (grossAmount, taxRatePercent) => {
    const rate = Number(taxRatePercent) || 0;
    const gross = Number(grossAmount) || 0;
    if (rate <= 0 || gross <= 0) return 0;
    // Round to 2dp in the base currency; conversion happens downstream.
    return Math.round((gross - gross / (1 + rate / 100)) * 100) / 100;
};

export const calculateDiscount = (subtotal, shippingCost, userStats, coupon = null) => {
    let discountAmount = 0;
    let isWelcomeOfferApplied = false;
    let isFreeShippingCouponApplied = false;
    let effectiveShippingCost = shippingCost;

    if (coupon) {
        if (coupon.type === "percentage") {
            let val = Math.round(subtotal * (coupon.value / 100));
            if (coupon.maxDiscountCap && val > coupon.maxDiscountCap) {
                val = coupon.maxDiscountCap;
            }
            discountAmount = val;
        } else if (coupon.type === "flat") {
            discountAmount = coupon.value;
        } else if (coupon.type === "free_shipping") {
            isFreeShippingCouponApplied = true;
            discountAmount = 0;
            effectiveShippingCost = 0;
        }
    } else if (userStats && userStats.existingOrdersCount === 0) {
        isWelcomeOfferApplied = true;
        discountAmount = Math.round(subtotal * 0.10);
    }

    // Rule: Total discount cannot exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    const originalAmount = subtotal + shippingCost;
    const finalAmount = Math.max(0, subtotal + effectiveShippingCost - discountAmount);

    return {
        subtotal,
        shippingCost: effectiveShippingCost,
        discountAmount,
        originalAmount,
        finalAmount,
        isWelcomeOfferApplied,
        isFreeShippingCouponApplied
    };
};
