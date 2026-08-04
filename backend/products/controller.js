import Product from "./models.js";
import UserProfile from "../profile/models.js";
import Order from "../tracker/models.js";
import escapeStringRegexp from "escape-string-regexp";
import { logAuditEvent } from "../audit/logger.js";
import { buildTopicPatterns } from "../utils/topicMatch.js";
import { pingIndexNow } from "../utils/indexNow.js";

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

    pingIndexNow([`https://bodilicious.in/product/${product.pid}`]);

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
      slim,           // slim=true → strip heavy fields (reviews, description, ingredients)
      sort = "best_selling",
      page = 1,
      limit = 12,
    } = req.query;

    const isSlim = slim === 'true';

    const query = { isActive: true };
    const andConditions = [];

    if (search) {
      const s = escapeStringRegexp(String(search));
      andConditions.push({
        $or: [
          { name: { $regex: s, $options: "i" } },
          { description: { $regex: s, $options: "i" } },
          { brand: { $regex: s, $options: "i" } },
          { "seo_keywords.primary": { $regex: s, $options: "i" } },
          { "seo_keywords.secondary": { $regex: s, $options: "i" } },
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

    let numLimit = Math.floor(Number(limit));
    if (isNaN(numLimit) || numLimit <= 0) numLimit = 12;
    if (numLimit > 100) numLimit = 100; // Hard cap payload size

    let numPage = Math.floor(Number(page));
    if (isNaN(numPage) || numPage <= 0) numPage = 1;
    if (numPage > 1000) numPage = 1000; // Hard cap skip depth to prevent DB CPU spikes

    const skip = (numPage - 1) * numLimit;

    // Add Vercel-CDN-Cache-Control for edge caching
    // 5 min s-maxage (was 60s) — product lists change infrequently
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    // Use space-separated strings for projection to guarantee Mongoose strictly excludes other fields.
    // Using $slice in the projection object causes MongoDB to return the entire document (including heavy descriptions and reviews).
    const projection = isSlim
      ? 'pid name price images rating ratingCount stock category brand isActive'
      : 'pid name price images rating ratingCount stock category brand isActive description ingredients reviews';

    let productQuery = Product.find(query).select(projection).sort(sortObj).skip(skip).limit(numLimit);

    if (isSlim) {
      // Prevent transferring all images for slim payloads
      productQuery = productQuery.slice('images', 1);
    } else {
      // Only populate reviews.user when we're actually returning reviews
      // Slice reviews at DB level to prevent massive memory spikes if a product has 1000+ reviews
      productQuery = productQuery.slice('reviews', -30).populate("reviews.user", "name");
    }

    const [products, total] = await Promise.all([
      productQuery.lean(),
      Product.countDocuments(query),
    ]);

    // Map populated user object to just the name string for the frontend
    // (only needed when reviews are included, i.e. not slim mode)
    const transformedProducts = products.map(product => {
      let modifiedProduct = { ...product };

      if (!isSlim && modifiedProduct.reviews && modifiedProduct.reviews.length > 0) {
        modifiedProduct.reviews = modifiedProduct.reviews.reverse().map(r => ({
          rating: r.rating,
          comment: r.comment,
          isVerified: !!r.isVerified,
          createdAt: r.createdAt,
          user: r.user?.name || "Customer"
        }));
      }
      return modifiedProduct;
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
      data: transformedProducts, // Restores backward compatibility with AppContext and HomePage which expect res.data
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

    const isSlim = req.query.slim === 'true';

    // Slim mode: only return card-level fields — used by pages that don't render
    // reviews, description, or ingredients (e.g. homepage best-seller section).
    const projection = isSlim
      ? 'pid name price images rating ratingCount stock category brand isActive'
      : 'pid name brand images description category sub_category product_type item_form ingredients benefits concerns_targeted usage price stock product_weight_ml product_weight_g skin_type_suitable skin_type_not_suitable hair_type_suitable how_to_use tips warnings texture rating ratingCount isActive reviews seo_keywords seo_title seo_description seo_h1 seo_h2 seo_image_alt faqs';

    let productQuery = Product.findOne({
      pid: req.params.pid,
      isActive: true,
    }, projection);

    if (isSlim) {
      productQuery = productQuery.slice('images', 1);
    } else {
      productQuery = productQuery.slice('reviews', -50).populate("reviews.user", "name");
    }

    const product = await productQuery.lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ── Related blog posts ────────────────────────────────────────────────────
    // Internal links between a product and the articles about its concern pass
    // authority in both directions and give crawlers a reason to walk deeper
    // into the site. Matching is on blog tags vs the product's own taxonomy.
    // Best-effort: a failure here must never break the product page.
    if (!isSlim) {
      try {
        const { default: Blog } = await import("../blog/models.js");
        const patterns = buildTopicPatterns([
          ...(product.concerns_targeted || []),
          product.product_type,
          product.name,
        ]);

        if (patterns.length) {
          // Match on title as well as tags: tags are freeform and currently hold
          // editorial placeholder text ("pigmentation (concern-based)"), so an
          // exact tag match would find nothing. Word-boundary containment across
          // both fields survives messy tags and keeps working once they're tidied.
          product.relatedBlogs = await Blog.find({
            status: "published",
            $or: [{ title: { $in: patterns } }, { tags: { $in: patterns } }],
          })
            .select("title slug excerpt coverImage publishedAt")
            .sort({ publishedAt: -1 })
            .limit(3)
            .lean();
        }
      } catch (relErr) {
        console.error("[Products] Related blogs lookup failed:", relErr.message);
      }
    }

    // 🚀 NEW: Update UserProfile productViewCounts if user is logged in (skip for slim requests)
    if (!isSlim && req.user && req.user._id) {
      import("../analytics/interactionModel.js").then(({ default: UserInteractionLog }) => {
         UserInteractionLog.create({
            userId: req.user._id,
            productId: product._id,
            eventType: "view"
         }).catch(err => console.error("Failed to log view interaction:", err));
      }).catch(err => console.error("Failed to import UserInteractionLog:", err));

      // Dynamic import to avoid circular dependency if any, or just require it
      import("../profile/models.js").then(({ default: UserProfile }) => {
        const pidObj = product._id;
        const bulkOps = [
          {
            updateOne: {
              filter: { _id: req.user._id, "productViewCounts.productId": pidObj },
              update: {
                $inc: { "productViewCounts.$.count": 1 },
                $set: { "productViewCounts.$.lastViewedAt": new Date() }
              }
            }
          },
          {
            updateOne: {
              filter: { _id: req.user._id, "productViewCounts.productId": { $ne: pidObj } },
              update: {
                $push: {
                  productViewCounts: {
                    $each: [{
                      productId: pidObj,
                      count: 1,
                      lastViewedAt: new Date()
                    }],
                    $slice: -100
                  }
                }
              }
            }
          }
        ];
        UserProfile.bulkWrite(bulkOps).catch(err => console.error("Failed to update productViewCounts:", err));
      }).catch(err => console.error("Failed to import UserProfile:", err));
    }

    // Map populated user object to just the name string for the frontend
    if (!isSlim && product.reviews && product.reviews.length > 0) {
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

    pingIndexNow([`https://bodilicious.in/product/${product.pid}`]);

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

/**
 * GET TOP REVIEWS
 * GET /api/products/reviews/top
 */
export const getTopReviews = async (req, res) => {
  try {
    // Add Vercel-CDN-Cache-Control for edge caching
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    // Also set standard Cache-Control so the browser can cache it
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

    // Aggregate to get the top 3 reviews efficiently without loading everything into memory.
    // This prevents massive bandwidth consumption between MongoDB (Atlas) and Render,
    // and prevents Node.js from crashing due to Out-Of-Memory errors.
    const topReviews = await Product.aggregate([
      { $match: { isActive: true, "reviews.0": { $exists: true } } },
      { $unwind: "$reviews" },
      { $match: { "reviews.rating": { $gte: 4 } } },
      { $sort: { "reviews.rating": -1, "reviews.createdAt": -1 } },
      // Group by product to get 1 review per product
      { 
        $group: {
          _id: "$_id",
          productName: { $first: "$name" },
          review: { $first: "$reviews" }
        }
      },
      // Re-sort the grouped results
      { $sort: { "review.rating": -1, "review.createdAt": -1 } },
      { $limit: 3 },
      { 
        $lookup: {
          from: "userprofiles",
          localField: "review.user",
          foreignField: "_id",
          as: "userData"
        }
      },
      {
        $project: {
          _id: 0,
          productName: 1,
          rating: "$review.rating",
          comment: "$review.comment",
          isVerified: "$review.isVerified",
          createdAt: "$review.createdAt",
          user: {
             $cond: {
               if: { $gt: [{ $size: "$userData" }, 0] },
               then: { $arrayElemAt: ["$userData.name", 0] },
               else: "Customer"
             }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: topReviews
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

