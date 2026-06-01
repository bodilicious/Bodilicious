import Product from "./models.js";
import Order from "../tracker/models.js";
import escapeStringRegexp from "escape-string-regexp";
import { logAuditEvent } from "../audit/logger.js";

/**
 * CREATE PRODUCT
 * POST /api/products
 * (admin only – assumed)
 */
export const createProduct = async (req, res) => {
  try {
    const product = await Product.create({
      ...req.body,
      isActive: true, // force default, don’t trust client
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET ALL PRODUCTS
 * GET /api/products
 * supports search, filter, pagination
 */
export const getAllProducts = async (req, res) => {
  try {
    const {
      search,
      name,
      category,
      sub_category,
      concern,
      type,
      ingredient,
      priceMax,
      inStock,
      excludePid,
      sort = "best_selling",
      page = 1,
      limit = 12,
    } = req.query;

    const query = { isActive: true };
    const andConditions = [];

    if (search) {
      const s = escapeStringRegexp(String(search));
      andConditions.push({
        $or: [
          { name: { $regex: s, $options: "i" } },
          { description: { $regex: s, $options: "i" } },
          { brand: { $regex: s, $options: "i" } },
        ]
      });
    }

    if (name) {
      query.name = { $regex: escapeStringRegexp(String(name)), $options: "i" };
    }

    if (category && category !== 'all') {
      const cats = category.split(',').map(c => c.trim().toLowerCase());
      query.category = { $in: cats };
    }

    if (sub_category) {
      const subCats = sub_category.split(',').map(c => c.trim().toLowerCase());
      const regexSubCats = subCats.map(c => new RegExp(`^${escapeStringRegexp(c)}$`, "i"));
      query.sub_category = { $in: regexSubCats };
    }

    if (concern) {
      const concernsArray = concern.split(',').map(c => c.trim());
      const regexConcerns = concernsArray.map(c => new RegExp(`^${escapeStringRegexp(c)}$`, "i"));
      query.concerns_targeted = { $in: regexConcerns };
    }

    if (type) {
      const typesArray = type.split(',').map(t => t.trim());
      const regexTypes = typesArray.map(t => new RegExp(`^${escapeStringRegexp(t)}$`, "i"));
      query.product_type = { $in: regexTypes };
    }

    if (ingredient) {
      const ingredientsArray = ingredient.split(',').map(i => i.trim());
      const regexIngredients = ingredientsArray.map(i => new RegExp(`^${escapeStringRegexp(i)}$`, "i"));
      andConditions.push({
        $or: [
          { "ingredients.key_actives": { $in: regexIngredients } },
          { "ingredients.botanical_extracts": { $in: regexIngredients } },
          { "ingredients.others": { $in: regexIngredients } }
        ]
      });
    }

    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    } else if (inStock === 'false') {
      query.stock = 0;
    }

    if (priceMax) {
      query.price = { ...(query.price || {}), $lte: Number(priceMax) };
    }

    if (excludePid) {
      query.pid = { $ne: excludePid };
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const sortMap = {
      best_selling: { sub_category: 1, ratingCount: -1, rating: -1 },
      price_asc: { sub_category: 1, price: 1 },
      price_desc: { sub_category: 1, price: -1 },
      newest: { sub_category: 1, createdAt: -1 },
    };

    const sortObj = sortMap[sort] || sortMap.best_selling;

    const numLimit = Number(limit);
    const numPage = Number(page);
    const skip = numLimit ? (numPage - 1) * numLimit : 0;

    // Add Vercel-CDN-Cache-Control for edge caching
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    const [products, total] = await Promise.all([
      Product.find(query, {
        pid: 1,
        name: 1,
        price: 1,
        images: 1,
        rating: 1,
        ratingCount: 1,
        stock: 1,
        category: 1,
        brand: 1,
        isActive: 1,
        description: 1,
        ingredients: 1,
        reviews: 1 // Needed for the transformation below
      })
        .sort(sortObj)
        .skip(skip)
        .limit(numLimit)
        .populate("reviews.user", "name")
        .lean(),
      Product.countDocuments(query),
    ]);

    // Map populated user object to just the name string for the frontend
    const transformedProducts = products.map(product => {
      if (product.reviews && product.reviews.length > 0) {
        return {
          ...product,
      reviews: (product.reviews || []).map(r => ({
        rating: r.rating,
        comment: r.comment,
        isVerified: !!r.isVerified,
        createdAt: r.createdAt,
        user: r.user?.name || "Customer"
      }))
        };
      }
      return product;
    });

    if (search) {
      logAuditEvent({
        event_type: "SEARCH",
        user_id: req.user?._id || null,
        severity: "INFO",
        source_system: "frontend",
        metadata: {
          query: search,
          resultsCount: total
        },
        network: {
          ip_address: req.ip || req.headers["x-forwarded-for"] || null,
          user_agent: req.headers["user-agent"] || null
        }
      }).catch(err => console.error("[Analytics] Search log failed:", err));
    }

    res.json({
      success: true,
      total,
      page: numPage,
      totalPages: numLimit ? Math.ceil(total / numLimit) : 1,
      products: transformedProducts,
      data: transformedProducts
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET PRODUCT FILTERS
 * GET /api/products/filters
 */
export const getProductFilters = async (req, res) => {
  try {
    // Add Vercel-CDN-Cache-Control for edge caching
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    const baseQuery = { isActive: true };
    const filterQuery = { isActive: true };

    if (req.query.category && req.query.category !== 'all') {
      const cats = req.query.category.split(',').map(c => c.trim().toLowerCase());
      filterQuery.category = { $in: cats };
    }

    const [categories, subCategories, productTypes, concerns, keyActives, botanicalExtracts, others] = await Promise.all([
      Product.distinct("category", baseQuery), // Always return all categories
      Product.distinct("sub_category", filterQuery),
      Product.distinct("product_type", filterQuery),
      Product.distinct("concerns_targeted", filterQuery),
      Product.distinct("ingredients.key_actives", filterQuery),
      Product.distinct("ingredients.botanical_extracts", filterQuery),
      Product.distinct("ingredients.others", filterQuery),
    ]);

    const normalize = (arr) => {
      const seen = new Set();
      return arr
        .filter(Boolean)
        .map(s => String(s).trim())
        .filter(s => {
          const lower = s.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        })
        .sort((a, b) => a.localeCompare(b));
    };

    res.json({
      success: true,
      data: {
        categories: normalize(categories),
        subCategories: normalize(subCategories),
        productTypes: normalize(productTypes),
        concerns: normalize(concerns),
        ingredients: normalize([...keyActives, ...botanicalExtracts, ...others])
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET PRODUCT BY PID
 * GET /api/products/:pid
 */
export const getProductByPid = async (req, res) => {
  try {
    // Add Vercel-CDN-Cache-Control for edge caching
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

    const product = await Product.findOne({
      pid: req.params.pid,
      isActive: true,
    })
      .populate("reviews.user", "name")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Map populated user object to just the name string for the frontend
    if (product.reviews && product.reviews.length > 0) {
      product.reviews = product.reviews.map(r => ({
        rating: r.rating,
        comment: r.comment,
        isVerified: !!r.isVerified,
        createdAt: r.createdAt,
        user: r.user?.name || "Customer"
      }));
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * UPDATE PRODUCT BY PID
 * PATCH /api/products/:pid
 */
export const updateProductByPid = async (req, res) => {
  try {
    // Explicit allowlist — prevents mass-assignment of sensitive fields like isActive, rating, ratingCount
    const {
      name, price, description, images, stock,
      category, sub_category, product_type, concerns_targeted,
      brand, ingredients, benefits, how_to_use, faqs,
      product_weight_g, product_weight_ml,
    } = req.body;

    const allowedUpdate = Object.fromEntries(
      Object.entries({
        name, price, description, images, stock,
        category, sub_category, product_type, concerns_targeted,
        brand, ingredients, benefits, how_to_use, faqs,
        product_weight_g, product_weight_ml,
      }).filter(([, v]) => v !== undefined)
    );

    const product = await Product.findOneAndUpdate(
      { pid: req.params.pid, isActive: true },
      { $set: allowedUpdate }, // $set required — plain object replaces the whole doc
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * DELETE PRODUCT BY PID (SOFT DELETE)
 * DELETE /api/products/:pid
 */
export const deleteProductByPid = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { pid: req.params.pid, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product deactivated",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * ADD REVIEW TO PRODUCT
 * POST /api/products/:pid/reviews
 */
export const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const product = await Product.findOne({ pid: req.params.pid, isActive: true });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({ success: false, message: "Product already reviewed" });
    }

    // NEW: Verified Buyer Logic
    const deliveredOrder = await Order.findOne({
      user: req.user._id,
      orderStatus: "delivered",
      "items.product": product._id
    });

    const review = {
      user: req.user._id,
      rating: Number(rating),
      comment: comment || "",
      isVerified: !!deliveredOrder
    };

    product.reviews.push(review);
    product.ratingCount = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();

    res.status(201).json({ success: true, message: "Review added" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
