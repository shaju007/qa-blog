import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const automationDir = dirname(fileURLToPath(import.meta.url));
const blogDir = resolve(process.env.QA_BLOG_DIR ?? resolve(automationDir, '..'));
const siteDir = resolve(process.env.QA_SITE_DIR ?? resolve(blogDir, '.site-build'));
const base = '/qa-blog/';
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const posts = readdirSync(blogDir)
  .map(file => ({ file, match: /^qa-(thinking|interview)-day-(\d+)\.md$/.exec(file) }))
  .filter(entry => entry.match)
  .map(({ file, match }) => {
    const markdown = readFileSync(join(blogDir, file), 'utf8');
    const plain = execFileSync('pandoc', ['-f', 'gfm-raw_html', '-t', 'plain'], {
      input: markdown, encoding: 'utf8',
    });
    const heading = markdown.match(/^## (?:Question: )?(.+)$/m)?.[1] ?? file;
    const title = execFileSync('pandoc', ['-f', 'gfm-raw_html', '-t', 'plain', '--wrap=none'], {
      input: heading, encoding: 'utf8',
    }).trim();
    const firstParagraph = plain.split(/\n\s*\n/).slice(2).find(paragraph =>
      paragraph.replace(/\s+/g, ' ').trim().length > 30) ?? '';
    return {
      file,
      day: Number(match[2]),
      series: match[1],
      title,
      excerpt: firstParagraph.replace(/\s+/g, ' ').slice(0, 210).trim(),
      markdown,
      href: `${base}posts/${file.replace(/\.md$/, '.html')}`,
    };
  })
  .sort((left, right) => right.day - left.day);

const siteHead = (title, description) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)} | QA Field Notes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${base}assets/site.css">
  <script src="${base}assets/site.js" defer></script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="${base}" aria-label="QA Field Notes home"><span class="brand-mark" aria-hidden="true">Q<span>A</span></span><span>QA Field Notes</span></a>
      <nav aria-label="Main navigation"><a href="${base}#thinking">Learning blog</a><a href="${base}#interview">Interview Q&A</a></nav>
    </div>
  </header>`;

const siteFooter = `
  <footer class="site-footer"><div class="content-width"><span>QA Field Notes</span><span>Testing, quality, and the decisions between them.</span></div></footer>
</body>
</html>
`;

const listItem = post => `<article class="post-row" data-series="${post.series}" data-search="${escapeHtml(`${post.title} ${post.excerpt} ${post.series}`.toLowerCase())}">
  <div class="post-number">${post.series === 'thinking' ? 'Lesson' : 'Interview'} <span>${String(post.day).padStart(2, '0')}</span></div>
  <div class="post-summary"><h3><a href="${post.href}">${escapeHtml(post.title)}</a></h3><p>${escapeHtml(post.excerpt)}</p></div>
  <a class="post-arrow" href="${post.href}" aria-label="Read ${escapeHtml(post.title)}">↗</a>
</article>`;

const thinking = posts.filter(post => post.series === 'thinking');
const interview = posts.filter(post => post.series === 'interview');
const index = `${siteHead('All articles', 'Practical QA learning articles and interview questions.')}
<main class="content-width">
  <div class="intro"><p class="eyebrow">A working library for quality engineers</p><h1>Test with better questions.</h1><p>Practical lessons and interview scenarios for people who care about how software actually behaves.</p></div>
  <section class="library" aria-label="Article library">
    <div class="library-toolbar"><h2>All writing <span>${posts.length}</span></h2><label class="search-label">Search articles <input id="post-search" type="search" placeholder="Topic, domain, or question" autocomplete="off"></label></div>
    <div class="filters" role="group" aria-label="Filter articles"><button type="button" data-filter="all" aria-pressed="true">All <span>${posts.length}</span></button><button type="button" data-filter="thinking" aria-pressed="false">Learning blog <span>${thinking.length}</span></button><button type="button" data-filter="interview" aria-pressed="false">Interview Q&A <span>${interview.length}</span></button></div>
    <div class="post-group" id="thinking"><div class="group-heading"><h2>Learning blog</h2><span>Thinking in risks, systems, and people</span></div>${thinking.map(listItem).join('\n')}</div>
    <div class="post-group" id="interview"><div class="group-heading"><h2>Interview Q&A</h2><span>Questions worth thinking through</span></div>${interview.map(listItem).join('\n')}</div>
    <p class="empty-state" hidden>No articles match that search.</p>
  </section>
</main>${siteFooter}`;

mkdirSync(join(siteDir, 'posts'), { recursive: true });
mkdirSync(join(siteDir, 'assets'), { recursive: true });
writeFileSync(join(siteDir, 'index.html'), index);
if (automationDir !== siteDir && automationDir !== join(siteDir, '.site-source')) {
  copyFileSync(join(automationDir, 'site.css'), join(siteDir, 'assets/site.css'));
  copyFileSync(join(automationDir, 'site.js'), join(siteDir, 'assets/site.js'));
}

for (const post of posts) {
  const body = execFileSync('pandoc', ['-f', 'gfm-raw_html', '-t', 'html5'], {
    input: post.markdown, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  const siblings = posts.filter(item => item.series === post.series).sort((a, b) => a.day - b.day);
  const position = siblings.findIndex(item => item.day === post.day);
  const previous = siblings[position - 1];
  const next = siblings[position + 1];
  const neighbors = [previous && `<a href="${previous.href}" rel="prev"><span>Previous</span>${escapeHtml(previous.title)}</a>`,
    next && `<a href="${next.href}" rel="next"><span>Next</span>${escapeHtml(next.title)}</a>`].filter(Boolean).join('');
  const html = `${siteHead(post.title, post.excerpt)}
<main class="article-width">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${base}">All writing</a><span aria-hidden="true">/</span><span>${post.series === 'thinking' ? 'Learning blog' : 'Interview Q&A'}</span><span aria-hidden="true">/</span><span>Day ${post.day}</span></nav>
  <article class="article-body">${body}</article>
  <nav class="article-neighbors" aria-label="More articles">${neighbors}</nav>
  <a class="back-link" href="${base}">← Back to all writing</a>
</main>${siteFooter}`;
  writeFileSync(join(siteDir, 'posts', post.file.replace(/\.md$/, '.html')), html);
}

console.log(`Built ${posts.length} articles in ${siteDir}`);