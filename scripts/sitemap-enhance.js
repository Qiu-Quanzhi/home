'use strict';

/**
 * Pre-computes _sitemap_recent flag on posts so the sitemap template
 * can promote recently-updated posts to priority 0.8 / changefreq weekly.
 */
const RECENT_DAYS = 90;

hexo.extend.filter.register('before_generate', function () {
  const now = Date.now();
  const threshold = now - RECENT_DAYS * 24 * 60 * 60 * 1000;

  const posts = hexo.locals.get('posts');
  if (!posts) return;

  const data = posts.toArray();
  data.forEach(post => {
    const t = (post.updated || post.date).valueOf();
    post._sitemap_recent = t >= threshold;
  });
});
