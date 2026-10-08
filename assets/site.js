// Site scripts extracted from index.html to permit a restrictive script-src policy.

  function cmsDateKey(value) {
    const raw = String(value || '').trim();
    const eu = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (eu) return eu[3] + '-' + eu[2] + '-' + eu[1];
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
  }

  function cmsDisplayDate(value) {
    const key = cmsDateKey(value);
    return key ? key.split('-').reverse().join('.') : '';
  }

  function cmsMediaUrl(value) {
    if (typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw) return '';
    try {
      const url = new URL(raw.replace(/^\/+/, ''), document.baseURI);
      const mediaRoot = new URL('media/', document.baseURI);
      if (url.origin !== mediaRoot.origin || !url.pathname.startsWith(mediaRoot.pathname)) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  const menuToggle = document.querySelector('.menu-toggle');
  const mainMenu = document.getElementById('main-menu');
  if (menuToggle && mainMenu) {
    menuToggle.addEventListener('click', () => {
      const open = mainMenu.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  const titles = {
    home: ["Parafia w Metz", "Wspólnota wiary i polskości przy parafii Sainte-Ségolène, nad brzegiem Mozeli."],
    msze: ["Msze i nabożeństwa", "Godziny i miejsca sprawowania Mszy świętych oraz nabożeństw."],
    aktualnosci: ["Ogłoszenia Duszpasterskie", "Bieżące ogłoszenia i informacje z życia parafii."],
    wydarzenia: ["Wydarzenia", "Katecheza, spotkania i uroczystości naszej wspólnoty."],
    misja: ["Nasza Misja", "Duszpasterstwo Polaków w Metz i Lotaryngii."],
    sakramenty: ["Sakramenty", "Chrzest, Komunia, bierzmowanie, małżeństwo i spowiedź po polsku."],
    kosciol: ["Kościół Sainte-Ségolène", "Jeden z najstarszych kościołów parafialnych Metzu."],
    "misje-francja": ["Polskie Misje we Francji", "Znajdź polską parafię lub ośrodek duszpasterski podczas podróży po Francji."],
    kontakt: ["Kontakt", "Napisz, zadzwoń lub odwiedź nas osobiście."]
  };

  const buttons = document.querySelectorAll('nav.menu button');
  const sections = document.querySelectorAll('.content section');
  const hero = document.getElementById('hero');
  const heroTitle = document.getElementById('hero-title');
  const heroTag = document.getElementById('hero-tag');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;

      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(s => s.classList.remove('active'));
      document.getElementById('sec-' + target).classList.add('active');

      heroTitle.textContent = titles[target][0];
      heroTag.textContent = titles[target][1];
      hero.classList.toggle('compact', target !== 'home');

      document.querySelector('nav.menu').classList.remove('open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      if (location.hash !== '#' + target) history.pushState(null, '', '#' + target);
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });

  function openSectionFromHash() {
    const target = location.hash.slice(1);
    const button = target && /^[a-z0-9-]+$/i.test(target) ? document.querySelector('nav.menu button[data-section="' + target + '"]') : null;
    if (button) button.click();
  }
  window.addEventListener('hashchange', openSectionFromHash);
  window.addEventListener('popstate', openSectionFromHash);
  if (location.hash) openSectionFromHash();

;

// Pages CMS: content is stored separately from the page design.
function renderSafeRichText(container, value) {
  const raw = String(value || '');

  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    container.textContent = raw;
    container.style.whiteSpace = 'pre-wrap';
    return;
  }

  const source = new DOMParser().parseFromString('<div>' + raw + '</div>', 'text/html').body.firstElementChild;
  const allowedTags = new Set([
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote',
    'a', 'code', 'pre', 'hr', 'table', 'thead', 'tbody',
    'tr', 'th', 'td'
  ]);

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.nodeValue || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tag = node.tagName.toLowerCase();

    if (!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();
      node.childNodes.forEach(child => fragment.append(cleanNode(child)));
      return fragment;
    }

    const clean = document.createElement(tag);

    if (tag === 'a') {
      const href = (node.getAttribute('href') || '').trim();
      if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(href)) {
        clean.setAttribute('href', href);
        if (/^https?:/i.test(href)) {
          clean.setAttribute('target', '_blank');
          clean.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }

    if (tag === 'th' || tag === 'td') {
      for (const attr of ['colspan', 'rowspan']) {
        const value = node.getAttribute(attr);
        if (value && /^\d{1,2}$/.test(value)) clean.setAttribute(attr, value);
      }
    }

    node.childNodes.forEach(child => clean.append(cleanNode(child)));
    return clean;
  }

  const fragment = document.createDocumentFragment();
  source.childNodes.forEach(child => fragment.append(cleanNode(child)));
  container.replaceChildren(fragment);
}

(async function loadAnnouncements() {
  const container = document.getElementById('announcements');
  try {
    const response = await fetch('./content/aktualnosci.json', {cache: 'no-cache'});
    if (!response.ok) throw new Error('Aktualności request failed');
    const data = await response.json();
    if (typeof data.lede === 'string' && document.getElementById('aktualnosci-lede')) document.getElementById('aktualnosci-lede').textContent = data.lede;
    const items = Array.isArray(data.items) ? data.items : [];
    const published = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item && item.published === true && typeof item.title === 'string' && typeof item.body === 'string')
      .sort((a, b) => cmsDateKey(b.item.date).localeCompare(cmsDateKey(a.item.date)) || b.index - a.index)
      .map(({ item }) => item);
    const fragment = document.createDocumentFragment();
    for (const item of published) {
      const article = document.createElement('article');
      article.className = 'contact-card';
      article.style.margin = '20px 0';
      const title = document.createElement('h3');
      title.textContent = item.title;
      article.append(title);
      if (typeof item.date === 'string') {
        const isoDate = cmsDateKey(item.date);
        const displayDate = cmsDisplayDate(item.date);
        if (displayDate) {
          const date = document.createElement('time');
          date.dateTime = isoDate;
          date.textContent = displayDate;
          date.className = 'note';
          article.append(date);
        }
      }
      const body = document.createElement('div');
      const alignment = ['center', 'right', 'justify'].includes(item.alignment) ? item.alignment : 'left';
      body.className = 'announcement-body align-' + alignment;
      renderSafeRichText(body, item.body);
      article.append(body);

      // Aktualności sections are hidden until selected. Measuring scrollHeight while
      // the section is hidden returns 0, which previously caused long articles to
      // appear fully expanded without a toggle on some initial page loads.
      const initAnnouncementToggle = () => {
        if (!body.isConnected || body.scrollHeight === 0) return false;
        if (body.dataset.toggleInitialized === 'true') return true;
        body.dataset.toggleInitialized = 'true';

        if (body.scrollHeight > 430) {
          body.classList.add('is-collapsed');
          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'text-toggle';
          toggle.textContent = 'Czytaj więcej';
          toggle.setAttribute('aria-expanded', 'false');
          toggle.addEventListener('click', () => {
            const collapsed = body.classList.toggle('is-collapsed');
            toggle.textContent = collapsed ? 'Czytaj więcej' : 'Zwiń';
            toggle.setAttribute('aria-expanded', String(!collapsed));
          });
          article.append(toggle);
        }
        return true;
      };

      const visibilityObserver = new ResizeObserver(() => {
        if (initAnnouncementToggle()) visibilityObserver.disconnect();
      });
      visibilityObserver.observe(body);
      requestAnimationFrame(initAnnouncementToggle);
      fragment.append(article);
    }
    if (!published.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = 'Obecnie brak nowych aktualności.';
      fragment.append(empty);
    }
    container.replaceChildren(fragment);
  } catch (error) {
    container.textContent = 'Nie udało się wczytać ogłoszeń. Odśwież stronę lub spróbuj ponownie później.';
    console.error('Loading announcements:', error);
  }
})();

;

const imageLightbox = document.getElementById('image-lightbox');
const imageLightboxImg = document.getElementById('image-lightbox-img');
const imageLightboxClose = document.querySelector('.image-lightbox-close');

function openImageLightbox(src, alt) {
  imageLightboxImg.src = src;
  imageLightboxImg.alt = alt || '';
  imageLightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  imageLightboxClose.focus();
}

function closeImageLightbox() {
  imageLightbox.classList.remove('open', 'zoomed');
  imageLightboxImg.removeAttribute('src');
  document.body.style.overflow = '';
  imageLightbox.scrollTop = 0;
  imageLightbox.scrollLeft = 0;
}

imageLightboxClose.addEventListener('click', closeImageLightbox);
imageLightboxImg.addEventListener('click', (event) => {
  event.stopPropagation();
  const zoomed = imageLightbox.classList.toggle('zoomed');
  if (!zoomed) {
    imageLightbox.scrollTop = 0;
    imageLightbox.scrollLeft = 0;
  }
});
imageLightbox.addEventListener('click', (event) => {
  if (event.target === imageLightbox) closeImageLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && imageLightbox.classList.contains('open')) closeImageLightbox();
});

;

// Pages CMS: editable events.
(async function loadEvents() {
  const container = document.getElementById('events');
  if (!container) return;

  try {
    const response = await fetch('./content/wydarzenia.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Wydarzenia request failed: ' + response.status);

    const data = await response.json();

    const communityContainer = document.getElementById('community-items');
    const communityItems = Array.isArray(data.communityItems) ? data.communityItems : [];
    const communityDialog = document.getElementById('community-dialog');
    const communityDialogTitle = document.getElementById('community-dialog-title');
    const communityDialogBody = document.getElementById('community-dialog-body');
    const communityDialogClose = communityDialog?.querySelector('.community-dialog-close');
    let communityDialogOpener = null;
    if (communityDialog && communityDialogClose) {
      communityDialogClose.addEventListener('click', () => communityDialog.close());
      communityDialog.addEventListener('click', event => {
        if (event.target !== communityDialog) return;
        const rect = communityDialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) communityDialog.close();
      });
      communityDialog.addEventListener('close', () => {
        if (communityDialogOpener?.isConnected) communityDialogOpener.focus();
        communityDialogOpener = null;
      });
    }
    const iconSvgs = {
      book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5c2.8-.8 5.8-.2 9 1.8v12c-3.2-2-6.2-2.6-9-1.8z"/><path d="M21 5.5c-2.8-.8-5.8-.2-9 1.8v12c3.2-2 6.2-2.6 9-1.8z"/></svg>',
      coffee: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 2v3M10 2v3M14 2v3"/></svg>',
      star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 2l2.5 5 5.5.7-4 3.9 1 5.5L12 14.8 7 17.1l1-5.5-4-3.9L9.5 7z"/></svg>',
      calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
      cross: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 2v20M7 7h10"/></svg>',
      people: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="9" cy="8" r="3"/><path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2"/><path d="M16 15c2.8 0 5 2.2 5 5"/></svg>',
      church: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 2v5M9.5 4.5h5"/><path d="M5 22V10l7-4 7 4v12"/><path d="M9 22v-6h6v6"/></svg>'
    };

    if (communityContainer) {
      const communityFragment = document.createDocumentFragment();
      for (const item of communityItems.filter(item => item && item.visible !== false)) {
        const card = document.createElement('div');
        card.className = 'icon-item';

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.innerHTML = iconSvgs[item.icon] || iconSvgs.calendar;

        const content = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = typeof item.title === 'string' ? item.title : '';
        const body = document.createElement('p');
        body.textContent = typeof item.body === 'string' ? item.body : '';
        content.append(title, body);

        if (communityDialog && item.expandable === true && typeof item.details === 'string') {
          const detailsText = new DOMParser().parseFromString(item.details, 'text/html').body.textContent.trim();
          if (detailsText) {
            card.classList.add('is-clickable');
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.setAttribute('aria-haspopup', 'dialog');
            card.setAttribute('aria-label', 'Otwórz szczegóły: ' + (item.title || 'wydarzenie'));
            const more = document.createElement('span');
            more.className = 'community-card-more';
            more.textContent = 'Czytaj więcej →';
            content.append(more);
            const openDetails = () => {
              communityDialogTitle.textContent = item.title || 'Szczegóły wydarzenia';
              renderSafeRichText(communityDialogBody, item.details);
              communityDialogOpener = card;
              communityDialog.showModal();
              communityDialogClose.focus();
            };
            card.addEventListener('click', openDetails);
            card.addEventListener('keydown', event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openDetails();
              }
            });
          }
        }
        card.append(icon, content);
        communityFragment.append(card);
      }

      if (!communityFragment.childNodes.length) {
        const empty = document.createElement('p');
        empty.className = 'note';
        empty.textContent = 'Brak stałych informacji.';
        communityFragment.append(empty);
      }

      communityContainer.replaceChildren(communityFragment);
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const todayKey = new Date().toISOString().slice(0, 10);
    const published = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        item &&
        item.published === true &&
        typeof item.title === 'string' &&
        typeof item.body === 'string'
      )
      .sort((a, b) => {
        const aDate = cmsDateKey(a.item.date);
        const bDate = cmsDateKey(b.item.date);
        const aFuture = aDate >= todayKey;
        const bFuture = bDate >= todayKey;

        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        if (aFuture && bFuture) return aDate.localeCompare(bDate) || b.index - a.index;
        return bDate.localeCompare(aDate) || b.index - a.index;
      })
      .map(({ item }) => item);

    const fragment = document.createDocumentFragment();
    const pastFragment = document.createDocumentFragment();
    let pastCount = 0;

    for (const item of published) {
      const article = document.createElement('article');
      article.className = 'event-card';

      if (typeof item.image === 'string' && item.image.trim()) {
        const img = document.createElement('img');
        const safeImageUrl = cmsMediaUrl(item.image);
        if (!safeImageUrl) continue;
        img.src = safeImageUrl;
        img.alt = item.title;
        img.loading = 'lazy';
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', 'Otwórz zdjęcie: ' + item.title);
        img.addEventListener('click', () => openImageLightbox(img.src, img.alt));
        img.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openImageLightbox(img.src, img.alt);
          }
        });
        img.addEventListener('error', () => img.remove(), { once: true });
        article.append(img);
      }

      const title = document.createElement('h3');
      title.textContent = item.title;
      article.append(title);

      const metaParts = [];
      if (typeof item.date === 'string') {
        const day = cmsDisplayDate(item.date);
        if (day) metaParts.push(day);
      }
      if (typeof item.time === 'string' && item.time.trim()) metaParts.push(item.time.trim());
      if (typeof item.place === 'string' && item.place.trim()) metaParts.push(item.place.trim());

      if (metaParts.length) {
        const meta = document.createElement('p');
        meta.className = 'event-meta';
        meta.textContent = metaParts.join(' · ');
        article.append(meta);
      }

      const body = document.createElement('div');
      const alignment = ['center', 'right', 'justify'].includes(item.alignment) ? item.alignment : 'left';
      body.className = 'event-body align-' + alignment;
      renderSafeRichText(body, item.body);
      article.append(body);

      const initEventToggle = () => {
        if (!body.isConnected || body.scrollHeight === 0) return false;
        if (body.dataset.toggleInitialized === 'true') return true;
        body.dataset.toggleInitialized = 'true';

        if (body.scrollHeight > 430) {
          body.classList.add('is-collapsed');
          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'text-toggle';
          toggle.textContent = 'Czytaj więcej';
          toggle.setAttribute('aria-expanded', 'false');
          toggle.addEventListener('click', () => {
            const collapsed = body.classList.toggle('is-collapsed');
            toggle.textContent = collapsed ? 'Czytaj więcej' : 'Zwiń';
            toggle.setAttribute('aria-expanded', String(!collapsed));
          });
          article.append(toggle);
        }
        return true;
      };

      const eventVisibilityObserver = new ResizeObserver(() => {
        if (initEventToggle()) eventVisibilityObserver.disconnect();
      });
      eventVisibilityObserver.observe(body);
      requestAnimationFrame(initEventToggle);

      const isPast = cmsDateKey(item.date) && cmsDateKey(item.date) < todayKey;
      if (isPast) { pastFragment.append(article); pastCount++; } else { fragment.append(article); }
    }

    if (!published.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = 'Obecnie brak opublikowanych wydarzeń.';
      fragment.append(empty);
    } else if (pastCount) {
      fragment.append(pastFragment);
    }

    container.replaceChildren(fragment);
  } catch (error) {
    container.textContent = 'Nie udało się wczytać wydarzeń. Odśwież stronę lub spróbuj ponownie później.';
    console.error('Loading events:', error);
  }
})();

;

// Pages CMS: editable Msze, Sakramenty and Kontakt sections.
const cmsIconSvgs = {
  clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 3v4M5 8l2 2M19 8l-2 2M4 16h16M8 16a4 4 0 018 0"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 21c4-3 7-6.5 7-10a7 7 0 10-14 0c0 3.5 3 7 7 10z"/></svg>',
  baptism: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 21c4-3 7-6.5 7-10a7 7 0 10-14 0c0 3.5 3 7 7 10z"/></svg>',
  person: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="12" cy="8" r="3"/><path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>',
  marriage: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M20 12a8 8 0 11-3.5-6.6M16 3v4h4"/></svg>',
  phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 2 .6 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.9.5 2.9.6a2 2 0 011.7 2z"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  church: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 2v4M9 6h6l1 4H8l1-4z"/><path d="M6 21V10l6-4 6 4v11"/><path d="M10 21v-6h4v6"/></svg>',
  pin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/></svg>'
};

function cmsIcon(name, fallback = 'church') {
  return cmsIconSvgs[name] || cmsIconSvgs[fallback];
}

(async function loadMassSchedule() {
  try {
    const response = await fetch('./content/msze.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Msze request failed: ' + response.status);
    const data = await response.json();

    if (typeof data.lede === 'string') document.getElementById('msze-lede').textContent = data.lede;
    if (typeof data.note === 'string') document.getElementById('msze-note').textContent = data.note;

    const items = Array.isArray(data.items) ? data.items.filter(item => item && item.visible !== false) : [];
    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const block = document.createElement('div');
      block.className = 'schedule-block';

      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.innerHTML = cmsIcon(item.icon, 'clock');

      const content = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = item.title || '';
      content.append(title);

      const rows = Array.isArray(item.rows) ? item.rows : [];
      for (const row of rows) {
        if (!row || typeof row.text !== 'string') continue;
        const line = document.createElement('div');
        line.className = 'schedule-row';
        if (typeof row.label === 'string' && row.label.trim()) {
          const label = document.createElement('span');
          label.className = 'when';
          label.textContent = row.label.trim();
          line.append(label);
        }
        line.append(document.createTextNode(row.text));
        content.append(line);
      }

      block.append(icon, content);
      fragment.append(block);
    }

    if (items.length) document.getElementById('mass-schedule').replaceChildren(fragment);
  } catch (error) {
    console.error('Loading Msze:', error);
  }
})();

(async function loadSacraments() {
  try {
    const response = await fetch('./content/sakramenty.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Sakramenty request failed: ' + response.status);
    const data = await response.json();

    if (typeof data.lede === 'string') document.getElementById('sakramenty-lede').textContent = data.lede;
    if (typeof data.note === 'string') document.getElementById('sakramenty-note').textContent = data.note;

    const items = Array.isArray(data.items) ? data.items.filter(item => item && item.visible !== false) : [];
    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'icon-item';

      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.innerHTML = cmsIcon(item.icon, 'church');

      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.title || '';

      const body = document.createElement('div');
      renderSafeRichText(body, typeof item.body === 'string' ? item.body : '');

      content.append(title, body);
      card.append(icon, content);
      fragment.append(card);
    }

    if (items.length) document.getElementById('sacraments-list').replaceChildren(fragment);
  } catch (error) {
    console.error('Loading Sakramenty:', error);
  }
})();

(async function loadContactPage() {
  try {
    const response = await fetch('./content/kontakt.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Kontakt request failed: ' + response.status);
    const data = await response.json();

    if (typeof data.lede === 'string') document.getElementById('kontakt-lede').textContent = data.lede;
    if (typeof data.note === 'string') document.getElementById('kontakt-note').textContent = data.note;

    const contactItems = Array.isArray(data.contactItems) ? data.contactItems.filter(item => item && item.visible !== false) : [];
    if (contactItems.length) {
      const fragment = document.createDocumentFragment();

      for (const item of contactItems) {
        const card = document.createElement('div');
        card.className = 'contact-card';

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.innerHTML = cmsIcon(item.icon, 'pin');

        const title = document.createElement('h3');
        title.textContent = item.title || '';

        const body = document.createElement('p');
        body.style.margin = '0';
        body.style.whiteSpace = 'pre-line';
        body.textContent = item.body || '';

        card.append(icon, title, body);

        const label = typeof item.buttonLabel === 'string' ? item.buttonLabel.trim() : '';
        const url = typeof item.buttonUrl === 'string' ? item.buttonUrl.trim() : '';
        if (label && /^(https?:|mailto:|tel:)/i.test(url)) {
          const button = document.createElement('a');
          button.className = 'btn';
          button.href = url;
          button.textContent = label;
          if (/^https?:/i.test(url)) {
            button.target = '_blank';
            button.rel = 'noopener noreferrer';
          }
          card.append(button);
        }

        fragment.append(card);
      }

      document.getElementById('contact-items').replaceChildren(fragment);
    }

    const priests = Array.isArray(data.priests) ? data.priests.filter(item => item && item.visible !== false && (item.firstName || item.lastName)) : [];
    const panel = document.getElementById('priests-panel');
    const layout = document.getElementById('contact-layout');

    if (priests.length) {
      document.getElementById('priests-title').textContent =
        typeof data.priestsTitle === 'string' && data.priestsTitle.trim() ? data.priestsTitle : 'Duszpasterze';

      const fragment = document.createDocumentFragment();

      for (const priest of priests) {
        const card = document.createElement('article');
        card.className = 'priest-card';

        if (typeof priest.photo === 'string' && priest.photo.trim()) {
          const img = document.createElement('img');
          const safeImageUrl = cmsMediaUrl(priest.photo);
          if (!safeImageUrl) {
            const placeholder = document.createElement('div');
            placeholder.className = 'priest-photo-placeholder';
            placeholder.innerHTML = cmsIcon('person', 'person');
            card.append(placeholder);
          } else {
            img.src = safeImageUrl;
          img.alt = [priest.firstName, priest.lastName].filter(Boolean).join(' ');
          img.className = 'priest-photo';
          img.loading = 'lazy';
          img.addEventListener('error', () => img.remove(), {once:true});
            card.append(img);
          }
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'priest-photo-placeholder';
          placeholder.innerHTML = cmsIcon('person', 'person');
          card.append(placeholder);
        }

        const name = document.createElement('h4');
        name.className = 'priest-name';
        name.textContent = [priest.title, priest.firstName, priest.lastName].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()).join(' ');
        card.append(name);

        if (typeof priest.role === 'string' && priest.role.trim()) {
          const role = document.createElement('p');
          role.className = 'priest-role';
          role.textContent = priest.role.trim();
          card.append(role);
        }

        if (typeof priest.phone === 'string' && priest.phone.trim()) {
          const line = document.createElement('p');
          line.className = 'priest-contact';
          const link = document.createElement('a');
          link.href = 'tel:' + priest.phone.replace(/[^+\d]/g, '');
          link.textContent = priest.phone.trim();
          line.append(link);
          card.append(line);
        }

        if (typeof priest.email === 'string' && priest.email.trim()) {
          const line = document.createElement('p');
          line.className = 'priest-contact';
          const link = document.createElement('a');
          link.href = 'mailto:' + priest.email.trim();
          link.textContent = priest.email.trim();
          line.append(link);
          card.append(line);
        }

        fragment.append(card);
      }

      document.getElementById('priests-list').replaceChildren(fragment);
      panel.hidden = false;
      layout.classList.remove('single-column');
    } else {
      panel.hidden = true;
      layout.classList.add('single-column');
    }
  } catch (error) {
    console.error('Loading Kontakt:', error);
  }
})();

;

// Pages CMS: editable Strona główna, Nasza Misja and Kościół Sainte-Ségolène.
function setCmsText(id, value) {
  const el=document.getElementById(id);
  if (el && typeof value==='string') el.textContent=value;
}
async function loadEditableSection(path, apply) {
  try {
    const response=await fetch(path,{cache:'no-store'});
    if (!response.ok) throw new Error(path+' request failed: '+response.status);
    apply(await response.json());
  } catch(error) { console.error('Loading editable section:',error); }
}
loadEditableSection('./content/strona-glowna.json', data => {
  setCmsText('home-lede',data.lede); setCmsText('home-mass-label',data.massLabel); setCmsText('home-mass-value',data.massValue);
  setCmsText('home-address-label',data.addressLabel); setCmsText('home-address-value',data.addressValue); setCmsText('home-contact-label',data.contactLabel); setCmsText('home-contact-value',data.contactValue);
  setCmsText('home-paragraph1',data.paragraph1); setCmsText('home-callout',data.callout);
  if (typeof data.paragraph2==='string') renderSafeRichText(document.getElementById('home-paragraph2'),data.paragraph2);
});
loadEditableSection('./content/misja.json', data => {
  setCmsText('misja-lede',data.lede); setCmsText('misja-paragraph1',data.paragraph1); setCmsText('misja-paragraph2',data.paragraph2); setCmsText('misja-callout',data.callout);
});
loadEditableSection('./content/kosciol.json', data => {
  setCmsText('kosciol-lede',data.lede); setCmsText('kosciol-paragraph1',data.paragraph1);
  if (typeof data.paragraph2==='string') renderSafeRichText(document.getElementById('kosciol-paragraph2'),data.paragraph2);
  setCmsText('kosciol-address-label',data.addressLabel); setCmsText('kosciol-address-value',data.addressValue); setCmsText('kosciol-patron-label',data.patronLabel); setCmsText('kosciol-patron-value',data.patronValue); setCmsText('kosciol-feast-label',data.feastLabel); setCmsText('kosciol-feast-value',data.feastValue);
});

;

(async function loadFranceMissions(){
  const list=document.getElementById('mission-city-list');
  const pins=document.getElementById('mission-map-pins');
  if(!list||!pins) return;
  try{
    const response=await fetch('./content/misje-francja.json',{cache:'no-store'});
    if(!response.ok) throw new Error('Misje Francja request failed');
    const data=await response.json();
    if(typeof data.lede==='string') document.getElementById('misje-francja-lede').textContent=data.lede;
    if(typeof data.updated==='string') document.getElementById('misje-updated').textContent=data.updated;
    if(typeof data.sourceUrl==='string' && /^https:\/\//i.test(data.sourceUrl)) document.getElementById('misje-source').href=data.sourceUrl;
    const items=(Array.isArray(data.items)?data.items:[]).filter(x=>x&&x.visible!==false&&typeof x.city==='string'&&Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon))).sort((a,b)=>a.city.localeCompare(b.city,'pl'));
    const ns='http://www.w3.org/2000/svg';
    const listFrag=document.createDocumentFragment();
    function project(lat,lon){
      /* Exact same WGS-84 frame used to draw the IGN-derived France outline. */
      const west=-5.25, east=9.65, north=51.25, south=41.25;
      const width=760, height=690, pad=20;
      const x=pad+(Number(lon)-west)/(east-west)*(width-2*pad);
      const y=pad+(north-Number(lat))/(north-south)*(height-2*pad);
      return [x,y];
    }
    function setActive(key,on){
      document.querySelectorAll('[data-mission-key="'+key+'"]').forEach(el=>el.classList.toggle('active',on));
    }
    const infoBox=document.getElementById('mission-info');
    const infoTitle=document.getElementById('mission-info-title');
    const infoBody=document.getElementById('mission-info-body');
    const infoClose=document.getElementById('mission-info-close');
    function safeHttpUrl(value){
      try{const u=new URL(String(value||'')); return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}
    }
    let selectedMissionItem=null;
    function showMissionLinks(item){
      pins.querySelectorAll('.mission-link').forEach(el=>el.remove());
      const group=String(item.linkGroup||'').trim();
      if(!group) return;
      const linked=items.filter(x=>String(x.linkGroup||'').trim()===group);
      if(linked.length<2) return;
      const points=linked.map(x=>project(x.lat,x.lon));
      for(let i=0;i<points.length-1;i++){
        const line=document.createElementNS(ns,'line');
        line.setAttribute('class','mission-link');
        line.setAttribute('x1',points[i][0]); line.setAttribute('y1',points[i][1]);
        line.setAttribute('x2',points[i+1][0]); line.setAttribute('y2',points[i+1][1]);
        pins.insertBefore(line,pins.firstChild);
      }
    }
    function previewMissionLinks(item){
      showMissionLinks(item);
    }
    function restoreMissionLinks(){
      if(selectedMissionItem) showMissionLinks(selectedMissionItem);
      else pins.querySelectorAll('.mission-link').forEach(el=>el.remove());
    }
    function showMissionInfo(item,key){
      selectedMissionItem=item;
      document.querySelectorAll('.mission-city.active,.mission-pin.active').forEach(el=>el.classList.remove('active'));
      document.querySelectorAll('[data-mission-key="'+key+'"]').forEach(el=>el.classList.add('active'));
      infoTitle.textContent=item.city;
      infoBody.replaceChildren();
      const locations=Array.isArray(item.locations)?item.locations:[];
      if(!locations.length){
        const p=document.createElement('p'); p.className='mission-address'; p.textContent='Adres jest jeszcze do uzupełnienia i weryfikacji.'; infoBody.append(p);
      } else {
        locations.forEach((loc,index)=>{
          const block=document.createElement('div'); block.className='mission-location';
          if(loc.name || locations.length>1){const strong=document.createElement('strong'); strong.textContent=loc.name||('Miejsce '+(index+1)); block.append(strong);}
          const p=document.createElement('p'); p.className='mission-address'; p.textContent=loc.address||'Adres do uzupełnienia'; block.append(p);
          const links=document.createElement('div'); links.className='mission-links';
          if(loc.address){
            const route=document.createElement('a'); route.target='_blank'; route.rel='noopener noreferrer'; route.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(loc.address); route.textContent='Wyznacz trasę'; links.append(route);
          }
          const website=safeHttpUrl(loc.website);
          if(website){const a=document.createElement('a'); a.target='_blank'; a.rel='noopener noreferrer'; a.href=website; a.textContent='Strona internetowa'; links.append(a);}
          block.append(links);
          if(loc.verified!==true){const note=document.createElement('p'); note.className='mission-unverified'; note.textContent='Dane do weryfikacji przed podróżą.'; block.append(note);}
          infoBody.append(block);
        });
      }
      showMissionLinks(item);
      infoBox.classList.add('open');
    }
    function closeMissionInfo(){
      selectedMissionItem=null;
      infoBox.classList.remove('open');
      pins.querySelectorAll('.mission-link').forEach(el=>el.remove());
      document.querySelectorAll('.mission-city.active,.mission-pin.active').forEach(el=>el.classList.remove('active'));
    }
    infoClose.addEventListener('click',closeMissionInfo);
    document.addEventListener('pointerdown',(event)=>{
      if(!infoBox.classList.contains('open')) return;
      if(infoBox.contains(event.target)) return;
      if(event.target.closest('[data-mission-key]')) return;
      closeMissionInfo();
    });
    const map=document.getElementById('france-missions-map');
    const viewport=document.getElementById('france-map-viewport');
    let mapView={x:0,y:0,w:760,h:690};
    const minW=55;
    function applyMapView(){
      map.setAttribute('viewBox',[mapView.x,mapView.y,mapView.w,mapView.h].join(' '));
      const scale=mapView.w/760;
      map.querySelectorAll('.mission-pin').forEach(pin=>{
        const hit=pin.querySelector('.mission-hit');
        const icon=pin.querySelector('.mission-marker-icon');
        const label=pin.querySelector('text');
        const x=Number(pin.dataset.x), y=Number(pin.dataset.y);
        /* Keep the visible church marker roughly constant on-screen while zooming.
           Mobile uses a slightly larger base icon so the church silhouette stays legible. */
        const iconBase=window.matchMedia('(max-width:820px)').matches?1.6:.82;
        if(icon) icon.setAttribute('transform','translate('+x+' '+y+') scale('+(iconBase*scale).toFixed(4)+')');
        if(hit){
          /* Invisible hit circle keeps direct taps comfortable; the 30px nearest-marker
             fallback below still applies when the finger lands beside the icon. */
          hit.setAttribute('r',Math.max(1.8,11*scale).toFixed(3));
        }
        if(label){
          label.setAttribute('x',(x+Math.max(2.2,11*scale)).toFixed(3));
          label.setAttribute('y',(y-Math.max(2.2,11*scale)).toFixed(3));
          label.style.fontSize=Math.max(2.1,12*scale).toFixed(2)+'px';
          label.style.strokeWidth=Math.max(.7,4*scale).toFixed(2)+'px';
        }
      });
    }
    function zoomMap(factor,cx=mapView.x+mapView.w/2,cy=mapView.y+mapView.h/2){
      const newW=Math.max(minW,Math.min(760,mapView.w*factor));
      const newH=newW*(690/760);
      const rx=(cx-mapView.x)/mapView.w, ry=(cy-mapView.y)/mapView.h;
      mapView.x=Math.max(0,Math.min(760-newW,cx-rx*newW));
      mapView.y=Math.max(0,Math.min(690-newH,cy-ry*newH));
      mapView.w=newW; mapView.h=newH; applyMapView();
    }
    document.getElementById('map-zoom-in').addEventListener('click',e=>{e.stopPropagation();zoomMap(.72);});
    document.getElementById('map-zoom-out').addEventListener('click',e=>{e.stopPropagation();zoomMap(1.38);});
    document.getElementById('map-zoom-reset').addEventListener('click',e=>{e.stopPropagation();mapView={x:0,y:0,w:760,h:690};applyMapView();});
    viewport.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=map.getBoundingClientRect();
      const cx=mapView.x+(e.clientX-r.left)/r.width*mapView.w;
      const cy=mapView.y+(e.clientY-r.top)/r.height*mapView.h;
      zoomMap(e.deltaY<0?.82:1.22,cx,cy);
    },{passive:false});
    let drag=null;
    viewport.addEventListener('pointerdown',e=>{
      if(e.target.closest('.mission-pin')||e.target.closest('.map-zoom-controls')) return;
      drag={x:e.clientX,y:e.clientY,vx:mapView.x,vy:mapView.y};
      viewport.setPointerCapture(e.pointerId); viewport.classList.add('is-panning');
    });
    viewport.addEventListener('pointermove',e=>{
      if(!drag||mapView.w>=760) return;
      const r=map.getBoundingClientRect();
      mapView.x=Math.max(0,Math.min(760-mapView.w,drag.vx-(e.clientX-drag.x)/r.width*mapView.w));
      mapView.y=Math.max(0,Math.min(690-mapView.h,drag.vy-(e.clientY-drag.y)/r.height*mapView.h));
      applyMapView();
    });
    viewport.addEventListener('pointerup',e=>{
      const tap=drag && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<10;
      drag=null;
      viewport.classList.remove('is-panning');
      if(!tap || (e.pointerType!=='touch' && e.pointerType!=='pen') || e.target.closest('.mission-pin')) return;

      let nearest=null;
      let nearestDistance=Infinity;
      pins.querySelectorAll('.mission-pin').forEach(pin=>{
        const hit=pin.querySelector('.mission-hit');
        if(!hit) return;
        const rect=hit.getBoundingClientRect();
        const cx=rect.left+rect.width/2;
        const cy=rect.top+rect.height/2;
        const distance=Math.hypot(e.clientX-cx,e.clientY-cy);
        if(distance<nearestDistance){
          nearestDistance=distance;
          nearest=pin;
        }
      });

      /* Finger-friendly hit area without visually enlarging crowded map pins. */
      if(nearest && nearestDistance<=30) nearest.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    });
    viewport.addEventListener('pointercancel',()=>{drag=null;viewport.classList.remove('is-panning');});
    items.forEach((item,index)=>{
      const key='m'+index;
      const btn=document.createElement('button');
      btn.type='button'; btn.className='mission-city'; btn.textContent=item.city; btn.dataset.missionKey=key;
      btn.addEventListener('mouseenter',()=>{setActive(key,true); previewMissionLinks(item);});
      btn.addEventListener('mouseleave',()=>{setActive(key,false); restoreMissionLinks();});
      btn.addEventListener('focus',()=>{setActive(key,true); previewMissionLinks(item);});
      btn.addEventListener('blur',()=>{setActive(key,false); restoreMissionLinks();});
      btn.addEventListener('click',()=>showMissionInfo(item,key));
      listFrag.append(btn);

      const [x,y]=project(item.lat,item.lon);
      const g=document.createElementNS(ns,'g'); g.setAttribute('class','mission-pin'); g.setAttribute('tabindex','0'); g.setAttribute('role','button'); g.setAttribute('aria-label',item.city); g.dataset.missionKey=key; g.dataset.x=x; g.dataset.y=y;
      const hit=document.createElementNS(ns,'circle'); hit.setAttribute('class','mission-hit'); hit.setAttribute('cx',x); hit.setAttribute('cy',y); hit.setAttribute('r','11');
      const icon=document.createElementNS(ns,'g'); icon.setAttribute('class','mission-marker-icon'); icon.setAttribute('transform','translate('+x+' '+y+') scale(.82)');
      const body=document.createElementNS(ns,'path'); body.setAttribute('class','mission-church-body'); body.setAttribute('d','M-7 5V-2H-4V-5L-2.5-8L-1-5V-2H6V5Z');
      const roof=document.createElementNS(ns,'path'); roof.setAttribute('class','mission-church-detail'); roof.setAttribute('d','M-1-2L2.2-4.5L6-2');
      const detail=document.createElementNS(ns,'path'); detail.setAttribute('class','mission-church-detail'); detail.setAttribute('d','M-5.4-2V2M2.2-1V1.2M4.2-1V1.2');
      const door=document.createElementNS(ns,'path'); door.setAttribute('class','mission-church-door'); door.setAttribute('d','M-5.4 5V1.2H-3.6V5Z');
      const cross=document.createElementNS(ns,'path'); cross.setAttribute('class','mission-church-cross'); cross.setAttribute('d','M-2.5-8V-11M-4-9.5H-1');
      icon.append(body,roof,detail,door,cross);
      const label=document.createElementNS(ns,'text'); label.setAttribute('x',x+11); label.setAttribute('y',y-11); label.textContent=item.city;
      g.append(hit,icon,label);
      g.addEventListener('mouseenter',()=>{setActive(key,true); previewMissionLinks(item);});
      g.addEventListener('mouseleave',()=>{setActive(key,false); restoreMissionLinks();});
      g.addEventListener('focus',()=>{setActive(key,true); previewMissionLinks(item);});
      g.addEventListener('blur',()=>{setActive(key,false); restoreMissionLinks();});
      g.addEventListener('click',()=>{btn.scrollIntoView({block:'nearest',behavior:'smooth'}); showMissionInfo(item,key);});
      pins.append(g);
    });
    list.replaceChildren(listFrag);
    applyMapView();
  }catch(error){
    console.error('Loading Misje Francja:',error);
    list.textContent='Nie udało się wczytać listy miejscowości.';
  }
})();

