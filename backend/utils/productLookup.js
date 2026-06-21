import mongoose from "mongoose";
import Product from "../products/models.js";

/**
 * Batch-fetches products for a merged cart-items array.
 * Splits items into ObjectId lookups and PID lookups to avoid N sequential
 * DB calls. Optionally runs inside a Mongoose session (for transactional reads).
 *
 * @param {Array<{ productId?: string, pid?: string, quantity: number }>} mergedItems
 * @param {{ session?: import('mongoose').ClientSession }} [opts]
 * @returns {Promise<{ mapById: Record<string, object>, mapByPid: Record<string, object> }>}
 */
export async function fetchProductMaps(mergedItems, { session } = {}) {
    const oidItems = mergedItems.filter(i => mongoose.Types.ObjectId.isValid(i.productId));
    const pidItems = mergedItems.filter(i => !mongoose.Types.ObjectId.isValid(i.productId));

    const sessionOpt = session ? { session } : {};

    const [byId, byPid] = await Promise.all([
        oidItems.length
            ? Product.find({ _id: { $in: oidItems.map(i => i.productId) } }, null, sessionOpt)
            : [],
        pidItems.length
            ? Product.find({ pid: { $in: pidItems.map(i => i.pid || i.productId) } }, null, sessionOpt)
            : []
    ]);

    const mapById  = Object.fromEntries(byId.map(p => [p._id.toString(), p]));
    const mapByPid = Object.fromEntries(byPid.map(p => [p.pid, p]));

    return { mapById, mapByPid };
}

/**
 * Resolves a single cart item to its Product document.
 * Tries the primary lookup key first (ObjectId or PID), then falls back to
 * the alternative key, matching the legacy dual-map resolution strategy.
 *
 * @param {{ productId?: string, pid?: string }} item
 * @param {Record<string, object>} mapById
 * @param {Record<string, object>} mapByPid
 * @returns {object | undefined}
 */
export function resolveProduct(item, mapById, mapByPid) {
    return (mongoose.Types.ObjectId.isValid(item.productId)
        ? mapById[item.productId]
        : mapByPid[item.pid || item.productId])
        || mapByPid[item.pid || item.productId]
        || mapById[item.productId];
}
