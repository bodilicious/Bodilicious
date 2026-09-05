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

/**
 * Single source of truth for shipping cost, shared by getOrderQuote and
 * initRazorpayOrder. Before this, each endpoint had its own copy — the quote
 * copy was missing the international free-shipping threshold that the init
 * copy had, so a large international cart got quoted a paid shipping charge
 * that init would then price at 0, tripping the Razorpay price-drift guard
 * ("Cart contents or pricing changed") and blocking checkout outright.
 */
export const calculateShippingCost = async ({ isIndia, totalAmount, settings, country, pincode, totalWeightGrams, getInternationalShippingRate }) => {
    if (isIndia) {
        return totalAmount >= settings.shippingThreshold ? 0 : settings.shippingCost;
    }
    if (totalAmount >= settings.internationalShippingThreshold) {
        return 0;
    }
    const totalWeightKg = Math.max(0.5, (totalWeightGrams || 0) / 1000);
    const dynamicRate = await getInternationalShippingRate(country, pincode || "", totalWeightKg);
    return dynamicRate !== null ? dynamicRate : settings.internationalShippingCost;
};

/**
 * Compute the discount amount and final price for a cart.
 *
 * @param {number} subtotal          - Full cart subtotal (server-computed).
 * @param {number} shippingCost      - Shipping cost before any coupon.
 * @param {object} userStats         - { existingOrdersCount } for welcome-offer eligibility.
 * @param {object|null} coupon       - Mongoose Coupon document (or null).
 * @param {Array}  serverCartItems   - Server-fetched line items: [{ product: ObjectId, priceAtPurchase, quantity }].
 *                                     Defaults to [] so existing callers that don't pass it get unchanged behaviour.
 *
 * Product-restricted coupons (applicableProducts non-empty, type !== 'free_shipping'):
 *   - eligibleSubtotal = sum(priceAtPurchase × quantity) for matching items only.
 *   - Discount is computed against eligibleSubtotal and capped at eligibleSubtotal.
 *   - Shipping is never touched by a product-restricted coupon.
 * free_shipping coupons ignore applicableProducts entirely (whole-order).
 * Whole-cart coupons (applicableProducts empty): eligibleSubtotal === subtotal.
 *
 * The returned `eligibleSubtotal` lets callers display "off eligible items" accurately
 * in cart previews and invoices without doing a second pass.
 */
export const calculateDiscount = (subtotal, shippingCost, userStats, coupon = null, serverCartItems = []) => {
    let discountAmount = 0;
    let isWelcomeOfferApplied = false;
    let isFreeShippingCouponApplied = false;
    let effectiveShippingCost = shippingCost;

    // ── Determine eligible subtotal ──────────────────────────────────────────
    // For product-restricted coupons, only the matching line items count.
    // item.product is always an ObjectId at these call sites — toString() for
    // Set membership. No fallback intentionally: a missing field throws visibly
    // instead of silently matching wrong and producing bad discount math.
    let eligibleSubtotal = subtotal;
    const isProductRestricted =
        coupon?.applicableProducts?.length > 0 && coupon.type !== 'free_shipping';

    if (isProductRestricted && serverCartItems.length > 0) {
        const eligibleIds = new Set(coupon.applicableProducts.map(id => id.toString()));
        eligibleSubtotal = serverCartItems.reduce((sum, item) =>
            eligibleIds.has(item.product.toString())
                ? sum + (item.priceAtPurchase * item.quantity)
                : sum,
            0
        );
    }

    if (coupon) {
        if (coupon.type === "percentage") {
            let val = Math.round(eligibleSubtotal * (coupon.value / 100));
            if (coupon.maxDiscountCap && val > coupon.maxDiscountCap) {
                val = coupon.maxDiscountCap;
            }
            // Additional cap: cannot exceed eligible subtotal
            discountAmount = Math.min(val, eligibleSubtotal);
        } else if (coupon.type === "flat") {
            // Cap flat discount at eligible subtotal so we never over-discount
            discountAmount = Math.min(coupon.value, eligibleSubtotal);
        } else if (coupon.type === "free_shipping") {
            isFreeShippingCouponApplied = true;
            discountAmount = 0;
            effectiveShippingCost = 0;
        }
    } else if (userStats && userStats.existingOrdersCount === 0) {
        isWelcomeOfferApplied = true;
        discountAmount = Math.round(subtotal * 0.10);
    }

    // Safety net: total discount cannot exceed the whole-cart subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    const originalAmount = subtotal + shippingCost;
    const finalAmount = Math.max(0, subtotal + effectiveShippingCost - discountAmount);

    return {
        subtotal,
        // Exposed so callers can display "discount applies to eligible items only"
        // without a second pass. Equals subtotal for whole-cart coupons.
        eligibleSubtotal,
        shippingCost: effectiveShippingCost,
        discountAmount,
        originalAmount,
        finalAmount,
        isWelcomeOfferApplied,
        isFreeShippingCouponApplied
    };
};
