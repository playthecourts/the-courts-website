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

  /* ---------- Schedule page: sport x age pill filters ---------- */
  const scheduleFilterBar = document.querySelector('.schedule-filters');
  if (scheduleFilterBar) {
    const sportGroup = scheduleFilterBar.querySelector('[data-sched-filter="sport"]');
    const ageGroup = scheduleFilterBar.querySelector('[data-sched-filter="age"]');
    const dayGroups = document.querySelectorAll('.day-group');
    const schedEmpty = document.getElementById('scheduleEmpty');

    const setActivePill = (group, value) => {
      const pill = [...group.querySelectorAll('.filter-pill')].find(p => p.dataset.value === value);
      if (!pill) return false;
      group.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      return true;
    };

    const applySchedFilters = (pushState) => {
      const sport = sportGroup.querySelector('.filter-pill.active').dataset.value;
      const age = ageGroup.querySelector('.filter-pill.active').dataset.value;
      let totalVisible = 0;
      dayGroups.forEach(group => {
        let groupVisible = 0;
        group.querySelectorAll('.schedule-row').forEach(row => {
          const sportMatch = sport === 'all' || row.dataset.sport === sport;
          const ageMatch = age === 'all' || row.dataset.age === age || row.dataset.age === 'all';
          const match = sportMatch && ageMatch;
          row.classList.toggle('is-hidden', !match);
          if (match) groupVisible++;
        });
        group.classList.toggle('is-hidden', groupVisible === 0);
        totalVisible += groupVisible;
      });
      if (schedEmpty) schedEmpty.classList.toggle('show', totalVisible === 0);

      if (pushState) {
        const params = new URLSearchParams(window.location.search);
        sport === 'all' ? params.delete('sport') : params.set('sport', sport);
        age === 'all' ? params.delete('age') : params.set('age', age);
        const qs = params.toString();
        history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
      }
    };

    [...sportGroup.querySelectorAll('.filter-pill'), ...ageGroup.querySelectorAll('.filter-pill')].forEach(pill => {
      pill.addEventListener('click', () => {
        pill.parentElement.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        applySchedFilters(true);
      });
    });

    const schedParams = new URLSearchParams(window.location.search);
    if (schedParams.get('sport')) setActivePill(sportGroup, schedParams.get('sport'));
    if (schedParams.get('age')) setActivePill(ageGroup, schedParams.get('age'));
    applySchedFilters(false);

    const schedReset = document.getElementById('scheduleReset');
    if (schedReset) {
      schedReset.addEventListener('click', () => {
        setActivePill(sportGroup, 'all');
        setActivePill(ageGroup, 'all');
        applySchedFilters(true);
      });
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
