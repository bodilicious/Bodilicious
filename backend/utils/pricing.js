export const calculateDiscount = (subtotal, shippingCost, userStats) => {
    let discountAmount = 0;
    let isWelcomeOfferApplied = false;

    // Apply welcome offer only to subtotal, NEVER to shipping cost
    if (userStats.existingOrdersCount === 0) {
        isWelcomeOfferApplied = true;
        discountAmount = Math.round(subtotal * 0.10);
    }

    // Future discounts (e.g. coupon codes, bulk discounts) should be added here
    // Rule: Total discount cannot exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    const originalAmount = subtotal + shippingCost;
    const finalAmount = Math.max(0, originalAmount - discountAmount);

    return {
        subtotal,
        shippingCost,
        discountAmount,
        originalAmount,
        finalAmount,
        isWelcomeOfferApplied
    };
};
