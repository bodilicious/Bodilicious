import Blog, { BlogCategory } from "./models.js";
import { v2 as cloudinary } from "cloudinary";
import escapeStringRegexp from "escape-string-regexp";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert a string to a URL-safe slug.
 * e.g. "My Blog Post!" → "my-blog-post"
 */
const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Given a base slug, keep appending -2, -3, etc. until we find one that
 * doesn't already exist in the DB. Optionally excludes a specific doc ID
 * (used during updates so we don't collide with ourselves).
 */
const uniqueSlug = async (base, excludeId = null) => {
  let candidate = base;
  let suffix = 1;
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Blog.exists(query);
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
};

// ────────────────────────────────────────────────────────────────────────────
// ADMIN — Blog CRUD
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/blogs
 */
export const createBlog = async (req, res) => {
  try {
    const {
      title, content, excerpt, coverImage,
      categories, tags,
      seo_title, seo_description, seo_keywords,
      status,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    // Generate + deduplicate slug
    const base = req.body.slug ? toSlug(req.body.slug) : toSlug(title);
    const slug = await uniqueSlug(base);

    // author is always set server-side
    const blog = new Blog({
      title,
      slug,
      content: content || "",
      excerpt: excerpt || "",
      coverImage: coverImage || "",
      author: req.user._id,
      categories: categories || [],
      tags: tags || [],
      seo_title: seo_title || "",
      seo_description: seo_description || "",
      seo_keywords: seo_keywords || "",
      status: status || "draft",
      // publishedAt stamped below if creating directly as published
      publishedAt: status === "published" ? new Date() : null,
    });

    await blog.save();
    await blog.populate("author", "name email");
    await blog.populate("categories", "name slug");

    res.status(201).json({ success: true, data: blog });
  } catch (err) {
    console.error("Blog createBlog Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/blogs
 * Supports: ?search=, ?status=, ?category=, ?page=, ?limit=
 */
export const getAdminBlogs = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};

    if (req.query.status && ["draft", "published"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.category) {
      filter.categories = req.query.category; // ObjectId string match
    }

    if (req.query.search) {
      const safe = escapeStringRegexp(req.query.search);
      filter.title = { $regex: safe, $options: "i" };
    }

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name email")
        .populate("categories", "name slug")
        .select("-content"), // omit heavy content field from list view
      Blog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: blogs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Blog getAdminBlogs Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/admin/blogs/:id
 * Single blog by ID (includes full content for edit form)
 */
export const getAdminBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate("author", "name email")
      .populate("categories", "name slug");

    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error("Blog getAdminBlogById Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/v1/admin/blogs/:id
 */
export const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });

    const {
      title, content, excerpt, coverImage,
      categories, tags,
      seo_title, seo_description, seo_keywords,
      status,
    } = req.body;

    // Allowlist: only fields explicitly sent in the body are updated
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (coverImage !== undefined) updates.coverImage = coverImage;
    if (categories !== undefined) updates.categories = categories;
    if (tags !== undefined) updates.tags = tags;
    if (seo_title !== undefined) updates.seo_title = seo_title;
    if (seo_description !== undefined) updates.seo_description = seo_description;
    if (seo_keywords !== undefined) updates.seo_keywords = seo_keywords;

    // Slug: re-derive only if client explicitly sends a new one or the title changed
    if (req.body.slug !== undefined) {
      const base = toSlug(req.body.slug);
      updates.slug = await uniqueSlug(base, blog._id);
    } else if (title !== undefined && title !== blog.title) {
      // Title changed but no explicit slug — regenerate from new title
      const base = toSlug(title);
      updates.slug = await uniqueSlug(base, blog._id);
    }

    // publishedAt: stamp only on first draft → published transition
    if (status !== undefined) {
      updates.status = status;
      if (status === "published" && blog.status === "draft" && !blog.publishedAt) {
        updates.publishedAt = new Date();
      }
      // Re-publishing an already-published post does NOT reset publishedAt
    }

    const updated = await Blog.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("author", "name email")
      .populate("categories", "name slug");

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Blog updateBlog Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/v1/admin/blogs/:id
 */
export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: "Blog not found" });
    res.json({ success: true, message: "Blog deleted" });
  } catch (err) {
    console.error("Blog deleteBlog Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/admin/blogs/upload-image
 * Accepts a multipart file via multer (memory storage), uploads to Cloudinary.
 */
export const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: "Cloudinary keys missing from .env" });
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filename = `BD-BLOG-${uniqueSuffix}-${safeOriginalName}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "bodilicious_blogs", public_id: filename },
        (error, result) => {
          if (error) {
            console.error("Cloudinary blog upload error:", error);
            reject(new Error("Failed to upload to Cloudinary"));
          } else {
            resolve(result);
          }
        }
      );
      stream.end(req.file.buffer);
    });

    res.status(200).json({
      success: true,
      filename: uploadResult.public_id,
      path: uploadResult.secure_url,
    });
  } catch (err) {
    console.error("Blog uploadBlogImage Error:", err.message || err);
    res.status(500).json({ success: false, message: err.message || "Failed to upload image" });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// ADMIN — Category CRUD
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/blog-categories
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await BlogCategory.find().sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/admin/blog-categories
 */
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required" });

    const slug = toSlug(name);
    const category = await BlogCategory.create({ name: name.trim(), slug });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Category already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/v1/admin/blog-categories/:id
 */
export const deleteCategory = async (req, res) => {
  try {
    const cat = await BlogCategory.findByIdAndDelete(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC — read-only, no auth required
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/blogs
 * Supports: ?category=, ?tag=, ?page=, ?limit=
 */
export const getPublicBlogs = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const skip  = (page - 1) * limit;

    const filter = { status: "published" };
    if (req.query.category) filter.categories = req.query.category;
    if (req.query.tag) filter.tags = req.query.tag;

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("categories", "name slug")
        .select("title slug excerpt coverImage categories tags publishedAt"),
      Blog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: blogs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Blog getPublicBlogs Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/blogs/:slug
 * Returns 404 for drafts — drafts must never be reachable via public slug.
 */
export const getPublicBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, status: "published" })
      .populate("author", "name")
      .populate("categories", "name slug");

    if (!blog) return res.status(404).json({ success: false, message: "Post not found" });
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error("Blog getPublicBlogBySlug Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
