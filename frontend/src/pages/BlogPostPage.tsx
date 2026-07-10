import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useSEO } from '../hooks/useSEO';
import { ArrowLeft, Calendar, User, Loader2, AlertCircle } from 'lucide-react';

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
  publishedAt: string;
}

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost]     = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError]   = useState('');

  const blogKeywords = (() => {
    if (!post) return undefined;

    const autoKeywords = [
      post.title,
      ...(post.categories?.map(c => c.name) || []),
      ...(post.tags || []),
      'Bodilicious blog',
    ].filter(Boolean) as string[];

    const customKeywords = (() => {
      if (!post.seo_keywords) return [];
      if (typeof post.seo_keywords === 'string') {
        return post.seo_keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
      }
      return [
        ...(post.seo_keywords.primary || []),
        ...(post.seo_keywords.secondary || []),
        ...(post.seo_keywords.tertiary || [])
      ].filter(Boolean);
    })();

    const seen = new Set<string>();
    const merged = [...autoKeywords, ...customKeywords].filter(k => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return merged.join(', ');
  })();

  const primaryKw = post?.seo_keywords && typeof post.seo_keywords !== 'string' && post.seo_keywords.primary?.[0] 
    ? post.seo_keywords.primary[0].trim() 
    : '';
  
  const secondaryKw = post?.seo_keywords && typeof post.seo_keywords !== 'string' && post.seo_keywords.secondary?.[0]
    ? post.seo_keywords.secondary[0].trim()
    : '';

  const pageTitle = post 
    ? (primaryKw ? `${post.seo_title || post.title} - ${primaryKw} | Bodilicious` : `${post.seo_title || post.title} | Bodilicious`)
    : 'Blog | Bodilicious';

  const ogAlt = post 
    ? (secondaryKw ? `${post.title} - ${secondaryKw}` : `${post.title}`)
    : undefined;

  useSEO({
    title: pageTitle,
    description: post?.seo_description || post?.excerpt || 'Read on the Bodilicious blog.',
    keywords: blogKeywords,
    canonical: post ? `/blogs/${post.slug}` : '/blogs',
    ogImage: post?.coverImage || undefined,
    ogImageAlt: ogAlt,
  });

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      setError('');
      try {
        const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs/${slug}`);
        if (res.status === 404) { setNotFound(true); return; }
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        setPost(data.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

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
            {post.author?.name && (
              <span className="flex items-center gap-2">
                <User size={16} /> {post.author.name}
              </span>
            )}
            {post.publishedAt && (
              <span className="flex items-center gap-2">
                <Calendar size={16} />
                {new Date(post.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
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

        {/* Back link */}
        <div className="mt-16 text-center">
          <Link to="/blogs" className="inline-flex items-center gap-2 text-b-burgundy font-medium hover:text-ruby-red transition-colors text-sm border border-b-burgundy/20 hover:border-ruby-red/40 px-6 py-3 rounded-full hover:shadow-sm">
            <ArrowLeft size={16} /> Back to Blogs
          </Link>
        </div>
      </div>
    </main>
  );
};

export default BlogPostPage;
