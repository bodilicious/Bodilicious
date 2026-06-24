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
