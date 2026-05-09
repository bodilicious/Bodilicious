import Product from "../products/models.js";
import StockHistory from "./stockHistoryModel.js";

/**
 * InventoryService.adjustStock
 *
 * THE ONLY authorised writer of product.stock in the entire codebase.
 * No controller, route, or script may write product.stock directly.
 *
 * @param {Object} opts
 * @param {string}  opts.productId    - MongoDB ObjectId of the product
 * @param {number}  opts.delta        - Positive to add stock, negative to remove
 * @param {string}  opts.reason       - po_receipt | manual_adjustment | order_placed | order_cancelled
 * @param {string}  opts.sourceModule - procurement | orders | admin
 * @param {string}  [opts.sourceId]   - Source document ID (PO id, order id, etc.)
 * @param {string}  [opts.actorId]    - Admin user ID performing the action
 * @param {Object}  [opts.session]    - Mongoose session for transactions
 * @param {Object}  [opts.metadata]   - Additional context
 * @returns {{ beforeStock, afterStock, delta }}
 */
export async function adjustStock({
  productId,
  delta,
  reason,
  sourceModule,
  sourceId = null,
  actorId = null,
  session = null,
  metadata = null,
}) {
  if (typeof delta !== "number" || isNaN(delta)) {
    throw new Error(`InventoryService: delta must be a number, got ${delta}`);
  }
  if (delta === 0) {
    throw new Error("InventoryService: delta must be non-zero");
  }

  const queryOpts = session ? { session } : {};

  const product = await Product.findById(productId, null, queryOpts);
  if (!product) {
    throw new Error(`InventoryService: product ${productId} not found`);
  }

  const beforeStock = product.stock;
  const afterStock = beforeStock + delta;

  if (afterStock < 0) {
    throw new Error(
      `InventoryService: stock cannot go negative. ` +
        `Current: ${beforeStock}, delta: ${delta}, result: ${afterStock}`
    );
  }

  // Persist stock update
  product.stock = afterStock;
  await product.save(queryOpts);

  // Create immutable audit record in the same session
  await StockHistory.create(
    [
      {
        product: productId,
        delta,
        beforeStock,
        afterStock,
        reason,
        sourceModule,
        sourceId: sourceId ? String(sourceId) : null,
        actor: actorId || null,
        metadata,
      },
    ],
    queryOpts
  );

  return { beforeStock, afterStock, delta };
}

export default { adjustStock };
