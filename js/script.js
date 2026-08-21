document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Sticky nav ---------- */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => mobileMenu.classList.toggle('open'));
    mobileMenu.querySelectorAll('.mobile-nav-toggle').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.mobile-nav-group').classList.toggle('open'));
    });
  }

  /* ---------- Coach bio accordion ---------- */
  document.querySelectorAll('.coach-bio-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const bio = btn.closest('.coach-card-body').querySelector('.coach-bio');
      const open = btn.classList.toggle('open');
      bio.style.maxHeight = open ? bio.scrollHeight + 'px' : '0';
      btn.querySelector('.coach-bio-label').textContent = open ? 'Close Bio' : 'Read Bio';
    });
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const a = item.querySelector('.faq-a');
      const open = item.classList.toggle('open');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0';
    });
  });

  /* ---------- FAQ search ---------- */
  const faqSearch = document.getElementById('faqSearch');
  if (faqSearch) {
    faqSearch.addEventListener('input', () => {
      const q = faqSearch.value.trim().toLowerCase();
      document.querySelectorAll('.faq-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = !q || text.includes(q) ? '' : 'none';
      });
      document.querySelectorAll('.faq-category').forEach(cat => {
        const visible = [...cat.querySelectorAll('.faq-item')].some(i => i.style.display !== 'none');
        cat.style.display = visible ? '' : 'none';
      });
    });
  }

  /* ---------- Contact form: pre-select interest from ?interest= or data-preset ---------- */
  const interestSelect = document.getElementById('cInterest');
  if (interestSelect) {
    const interestParam = new URLSearchParams(window.location.search).get('interest');
    if (interestParam) {
      const match = [...interestSelect.options].find(o => o.value === interestParam);
      if (match) interestSelect.value = interestParam;
    }
    document.querySelectorAll('[data-preset]').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.dataset.preset;
        const match = [...interestSelect.options].find(o => o.value === val);
        if (match) interestSelect.value = val;
      });
    });
  }

  /* ---------- Contact form submit (visual only) ---------- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      const success = document.getElementById('contactFormSuccess');
      contactForm.reset();
      contactForm.style.display = 'none';
      if (success) success.style.display = 'block';
    });
  }

  /* ---------- Schedule filters (select dropdowns) ---------- */
  const scheduleFilters = document.querySelectorAll('.filter-group select[data-filter-key]');
  if (scheduleFilters.length) {
    const applyScheduleFilters = () => {
      const active = {};
      scheduleFilters.forEach(sel => { if (sel.value) active[sel.dataset.filterKey] = sel.value; });
      let visibleCount = 0;
      document.querySelectorAll('[data-row]').forEach(row => {
        const match = Object.keys(active).every(key => row.dataset[key] === active[key]);
        row.classList.toggle('is-hidden', !match);
        if (match) visibleCount++;
      });
      const empty = document.getElementById('scheduleEmpty');
      if (empty) empty.classList.toggle('show', visibleCount === 0);
    };
    scheduleFilters.forEach(sel => sel.addEventListener('change', applyScheduleFilters));

    const sportParam = new URLSearchParams(window.location.search).get('sport');
    if (sportParam) {
      const sportSelect = document.querySelector('.filter-group select[data-filter-key="sport"]');
      if (sportSelect && [...sportSelect.options].some(o => o.value === sportParam)) {
        sportSelect.value = sportParam;
        applyScheduleFilters();
      }
    }
  }

  /* ---------- Filter pills (events / shop / programs) ---------- */
  document.querySelectorAll('.filter-pills').forEach(group => {
    const groupPills = group.querySelectorAll('.filter-pill');
    const filterableCards = document.querySelectorAll('[data-category]');
    if (!groupPills.length || !filterableCards.length) return;
    const multi = group.dataset.mode === 'multi';
    const allPill = [...groupPills].find(p => p.dataset.filter === 'all');

    function applyFilters() {
      const active = [...groupPills].filter(p => p.classList.contains('active') && p.dataset.filter !== 'all');
      let visibleCount = 0;
      filterableCards.forEach(card => {
        const match = active.length === 0 || active.some(p => p.dataset.filter === card.dataset.category);
        card.classList.toggle('is-hidden', !match);
        if (match) visibleCount++;
      });
      const empty = document.getElementById('eventsEmpty') || document.getElementById('filterEmpty');
      if (empty) empty.classList.toggle('show', visibleCount === 0);
    }

    groupPills.forEach(pill => {
      pill.addEventListener('click', () => {
        if (!multi) {
          groupPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          applyFilters();
          return;
        }
        if (pill.dataset.filter === 'all') {
          groupPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        } else {
          pill.classList.toggle('active');
          const anySelected = [...groupPills].some(p => p.dataset.filter !== 'all' && p.classList.contains('active'));
          if (allPill) allPill.classList.toggle('active', !anySelected);
        }
        applyFilters();
      });
    });

    const categoryParam = new URLSearchParams(window.location.search).get('category');
    if (categoryParam) {
      const pill = [...groupPills].find(p => p.dataset.filter === categoryParam);
      if (pill) pill.click();
    }
  });

  /* ---------- Shop: add to cart (visual only) ---------- */
  document.querySelectorAll('button.product-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const original = btn.textContent;
      btn.textContent = 'Added ✓';
      setTimeout(() => { btn.textContent = original; }, 1800);
    });
  });

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }
});
