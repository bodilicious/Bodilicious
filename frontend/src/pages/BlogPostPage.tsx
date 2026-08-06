import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useSEO } from '../hooks/useSEO';
import { buildBlogTitle, buildBlogDescription, buildBlogKeywords, buildBlogOgAlt } from '../utils/seo';
import { useApp } from '../context/useApp';
import { ArrowLeft, Calendar, Loader2, AlertCircle, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  author: { name: string };
  categories: { _id: string; name: string; slug: string }[];
  tags: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: any;
  readingTime?: number;
  publishedAt: string;
  likes?: string[];
  /** Injected by the API on the detail endpoint — internal linking, not stored. */
  relatedProducts?: { pid: string; name: string; price: number; images?: string[] }[];
}

interface Comment {
  _id: string;
  content: string;
  author: { name: string; avatar?: string };
  createdAt: string;
}

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated, getAuthHeaders } = useApp();
  const [post, setPost]     = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError]   = useState('');

  const [likesCount, setLikesCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Shared with the Cloudflare bot renderer — see frontend/src/utils/seo.ts.
  // Also fixes the doubled brand: post.title is stored already ending in
  // "| Bodilicious", and the old template appended it a second time.
  const blogKeywords = buildBlogKeywords(post);
  const pageTitle = buildBlogTitle(post);
  const ogAlt = buildBlogOgAlt(post);

  // ── Article + BreadcrumbList JSON-LD ──────────────────────────────────────
  // Only built once post data is loaded. Schema is withheld entirely if
  // headline is absent (would fail Google's required-field validation).
  // dateModified omitted when datePublished is null (explicit null chain).
  const blogJsonLd = (() => {
    if (!post) return undefined;

    const headline = post.seo_title || post.title;
    if (!headline) return undefined; // required — skip schema entirely if missing

    const publishedIso = post.publishedAt ? new Date(post.publishedAt).toISOString() : null;
    // updatedAt may come from the API; fall back to publishedAt; omit if both null
    const modifiedIso = (post as any).updatedAt
      ? new Date((post as any).updatedAt).toISOString()
      : publishedIso;

    const articleSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline,
      author: {
        '@type': 'Person',
        name: post.author?.name || 'Bodilicious Team',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Bodilicious',
        url: 'https://bodilicious.in',
        logo: {
          '@type': 'ImageObject',
          url: 'https://bodilicious.in/logo.webp',
        },
      },
      url: `https://bodilicious.in/blogs/${post.slug}`,
    };

    // Optional fields — omit rather than inject null/empty strings
    if (post.coverImage) {
      articleSchema.image = post.coverImage.startsWith('http') 
        ? post.coverImage 
        : `https://bodilicious.in${post.coverImage.startsWith('/') ? '' : '/'}${post.coverImage}`;
    }
    if (publishedIso) {
      articleSchema.datePublished = publishedIso;
    }
    if (modifiedIso) {
      articleSchema.dateModified = modifiedIso;
    }
    if (post.excerpt) {
      articleSchema.description = post.excerpt;
    }

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bodilicious.in/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://bodilicious.in/blogs' },
        { '@type': 'ListItem', position: 3, name: headline, item: `https://bodilicious.in/blogs/${post.slug}` },
      ],
    };

    return [articleSchema, breadcrumbSchema];
  })();

  useSEO({
    title: pageTitle,
    // Falls through seo_description → excerpt → article body. Excerpt is empty
    // on every currently published post, so the body fallback is what ships.
    description: buildBlogDescription(post),
    keywords: blogKeywords,
    canonical: `/blogs/${post?.slug || slug}`,
    ogImage: post?.coverImage || undefined,
    ogImageAlt: ogAlt,
    jsonLd: blogJsonLd,
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setNotFound(false);
      setError('');
      try {
        const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs/${slug}`);
        if (res.status === 404) { setNotFound(true); return; }
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        
        if (cancelled) return;
        setPost(data.data);
        setLikesCount(data.data.likes?.length || 0);
        setHasLiked(user ? data.data.likes?.includes(user.uid) : false);

        const [relatedRes, commentsRes] = await Promise.allSettled([
          fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs/${slug}/related`),
          fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs/${data.data._id}/comments`)
        ]);

        if (!cancelled && relatedRes.status === "fulfilled") {
          const rData = await relatedRes.value.json();
          if (rData.success) setRelated(rData.data);
        }
        if (!cancelled && commentsRes.status === "fulfilled") {
          const cData = await commentsRes.value.json();
          if (cData.success) setComments(cData.data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [slug, user]);

  const handleLike = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to like this post');
      return;
    }
    if (!post) return;
    setLikeLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs/${post._id}/like`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setHasLiked(data.hasLiked);
      setLikesCount(data.likesCount);
    } catch (err: any) {
      toast.error(err.message || 'Failed to like post');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    const trimmed = newComment.trim();
    if (!trimmed) {
      setCommentError("Comment can't be empty.");
      return;
    }
    setSubmitting(true);
    setCommentError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs/${post._id}/comments`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setComments((prev) => [data.data, ...prev]);
      setNewComment("");
    } catch (err: any) {
      setCommentError(err.message || "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F6F1]">
        <Loader2 size={36} className="animate-spin text-[#8B2E2E]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F6F1] gap-4 text-center px-4">
        <p className="text-6xl font-serif font-bold text-gray-200">404</p>
        <h1 className="text-2xl font-semibold text-gray-800">Post not found</h1>
        <p className="text-gray-500 max-w-sm">This post may have been removed or is not yet published.</p>
        <Link to="/blogs" className="mt-4 flex items-center gap-2 text-[#8B2E2E] font-medium hover:underline">
          <ArrowLeft size={16} /> Back to Blogs
        </Link>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F6F1] gap-3 text-red-500">
        <AlertCircle size={32} />
        <span className="text-sm">{error || 'Something went wrong'}</span>
        <Link to="/blogs" className="text-[#8B2E2E] text-sm underline">Back to Blogs</Link>
      </div>
    );
  }

  // Sanitise HTML content before rendering (DOMPurify prevents stored XSS)
  const safeContent = DOMPurify.sanitize(post.content, {
    ALLOWED_TAGS: [
      'p','br','strong','em','u','s','h1','h2','h3','h4','h5','h6',
      'ul','ol','li','blockquote','pre','code',
      'a','img','figure','figcaption','hr','table','thead','tbody','tr','th','td',
    ],
    ALLOWED_ATTR: ['href','target','rel','src','alt','class','title'],
    FORCE_BODY: true,
  });

  return (
    <main className="min-h-screen bg-b-bg pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <Link to="/blogs" className="group inline-flex items-center gap-2 text-sm text-b-text-secondary hover:text-b-burgundy mb-10 transition-colors">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform motion-reduce:transform-none" /> 
          Back to Blogs
        </Link>

        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          {/* Categories */}
          {post.categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {post.categories.map(c => (
                <Link
                  key={c._id}
                  to={`/blogs?category=${c._id}`}
                  className="text-[11px] uppercase tracking-wider font-semibold text-b-burgundy bg-b-burgundy/5 px-3 py-1 rounded-full hover:bg-b-burgundy/10 transition-colors"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-b-text-primary leading-[1.15] mb-6 tracking-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-b-text-secondary pb-8 border-b border-silk/60">
            {post.publishedAt && (
              <span className="flex items-center gap-2">
                <Calendar size={16} />
                {new Date(post.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
            {post.readingTime && (
              <span className="flex items-center gap-2">
                <span className="text-gray-300">•</span>
                {post.readingTime} min read
              </span>
            )}
          </div>
        </div>

        {/* Cover image */}
        {post.coverImage && (
          <div className="rounded-3xl overflow-hidden mb-12 aspect-[16/9] bg-gray-100 shadow-sm border border-silk-light">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Sanitised content */}
        <article
          className="prose prose-lg max-w-[70ch] mx-auto
                     prose-headings:text-b-text-primary 
                     prose-h1:font-serif prose-h2:font-serif 
                     prose-h3:font-sans prose-h3:font-semibold prose-h3:text-2xl
                     prose-h4:font-sans prose-h4:font-medium prose-h4:text-xl
                     prose-p:font-sans prose-p:leading-loose prose-p:text-b-text-primary/90
                     prose-a:text-b-burgundy prose-a:font-medium prose-a:underline-offset-4 hover:prose-a:text-ruby-red transition-colors
                     prose-img:rounded-2xl prose-img:shadow-sm"
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />

        {/* Products mentioned — the blog half of product↔blog interlinking.
            Matched server-side on blog tags vs product concerns/type/category. */}
        {(post.relatedProducts?.length ?? 0) > 0 && (
          <section className="max-w-[70ch] mx-auto mt-16 pt-8 border-t border-silk/60">
            <h2 className="font-serif text-2xl text-b-burgundy mb-6">
              Products mentioned in this guide
            </h2>
            <ul className="space-y-4">
              {post.relatedProducts!.map(product => (
                <li key={product.pid}>
                  <Link
                    to={`/product/${product.pid}`}
                    className="flex items-center gap-4 group"
                  >
                    {product.images?.[0] && (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        loading="lazy"
                        className="w-16 h-16 object-cover rounded-xl border border-silk/60"
                      />
                    )}
                    <span className="font-sans text-sm text-b-text-primary group-hover:text-b-burgundy transition-colors underline underline-offset-4">
                      {product.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="max-w-[70ch] mx-auto mt-16 pt-8 border-t border-silk/60">
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/blogs?tag=${encodeURIComponent(tag)}`}
                  className="text-xs font-medium text-b-text-secondary bg-white border border-silk hover:border-b-burgundy/30 hover:text-b-burgundy px-4 py-1.5 rounded-full transition-all duration-300"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Actions & Back link */}
        <div className="mt-16 pb-8 border-b border-silk/60 flex flex-col sm:flex-row items-center justify-between gap-6">
          <button 
            onClick={handleLike}
            disabled={likeLoading}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full border transition-all shadow-sm ${hasLiked ? 'bg-[#8B2E2E] text-white border-[#8B2E2E]' : 'bg-white text-[#8B2E2E] border-[#8B2E2E]/20 hover:border-[#8B2E2E]/40 hover:text-ruby-red'} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Heart size={18} className={hasLiked ? 'fill-current' : ''} />
            <span className="font-medium">{likesCount} {likesCount === 1 ? 'Like' : 'Likes'}</span>
          </button>
          
          <Link to="/blogs" className="inline-flex items-center gap-2 text-b-burgundy font-medium hover:text-ruby-red transition-colors text-sm border border-b-burgundy/20 hover:border-ruby-red/40 px-6 py-3 rounded-full hover:shadow-sm">
            <ArrowLeft size={16} /> Back to Blogs
          </Link>
        </div>

        {/* Related Posts */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-serif font-bold text-b-text-primary mb-6">Related Posts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {related.map(r => (
                <Link key={r._id} to={`/blogs/${r.slug}`} className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-silk-light flex flex-col">
                  {r.coverImage && (
                    <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                      <img src={r.coverImage} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-grow">
                    <h4 className="font-serif font-bold text-b-text-primary text-lg mb-2 line-clamp-2 group-hover:text-b-burgundy transition-colors">{r.title}</h4>
                    {r.readingTime && <span className="text-xs text-gray-400 mt-auto">{r.readingTime} min read</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="mt-16 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-silk-light">
          <h2 className="text-2xl font-serif font-bold text-b-text-primary mb-8">Comments ({comments.length})</h2>
          
          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="mb-10">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts..."
                maxLength={2000}
                rows={3}
                className="w-full p-4 rounded-xl border border-silk-light focus:border-b-burgundy focus:ring-1 focus:ring-b-burgundy outline-none resize-none bg-gray-50 mb-3"
              />
              {commentError && <p className="text-red-500 text-sm mb-3">{commentError}</p>}
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  disabled={submitting || !newComment.trim()}
                  className="bg-b-burgundy text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-ruby-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-gray-50 rounded-xl p-6 text-center mb-10 border border-silk-light">
              <p className="text-b-text-secondary mb-4">You must be logged in to leave a comment.</p>
              {/* Note: In Bodilicious, auth page is usually handled or we might use SignInPage or a modal. 
                  If '/auth' isn't correct, it might be '/account' or '/sign-in' */}
              <Link to="/sign-in" className="inline-block bg-b-text-primary text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-black transition-colors">
                Log In
              </Link>
            </div>
          )}

          <div className="space-y-6">
            {comments.map((c) => (
              <div key={c._id} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-b-burgundy/10 flex items-center justify-center text-b-burgundy font-bold uppercase shrink-0">
                  {c.author.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-b-text-primary text-sm">{c.author.name}</span>
                    <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-b-text-secondary leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-center text-gray-400 italic">No comments yet — be the first to share your thoughts.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default BlogPostPage;
