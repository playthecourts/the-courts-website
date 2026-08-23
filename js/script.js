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

  /* ---------- Contact form: conditional field groups ---------- */
  const contactForm = document.getElementById('contactForm');
  const helpSelect = document.getElementById('cHelp');
  if (contactForm && helpSelect) {
    const minorNote = document.getElementById('cfMinorNote');
    const athleteCategories = ['Programs + Membership', 'Private Training', 'Basketball Leagues'];

    const evaluateVisibility = () => {
      document.querySelectorAll('[data-cat]').forEach(el => {
        el.hidden = el.dataset.cat !== helpSelect.value;
      });
      document.querySelectorAll('[data-show-if]').forEach(el => {
        const [fieldId, valuesRaw] = el.dataset.showIf.split(':');
        const field = document.getElementById(fieldId);
        el.hidden = !(field && valuesRaw.split('|').includes(field.value));
      });
      document.querySelectorAll('[data-reveal-if]').forEach(el => {
        const cb = document.getElementById(el.dataset.revealIf);
        el.hidden = !(cb && cb.checked);
      });
      if (minorNote) minorNote.hidden = !athleteCategories.includes(helpSelect.value);
    };

    const interestParam = new URLSearchParams(window.location.search).get('interest');
    if (interestParam) {
      const match = [...helpSelect.options].find(o => o.value === interestParam);
      if (match) helpSelect.value = interestParam;
    }
    document.querySelectorAll('[data-preset]').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.dataset.preset;
        const match = [...helpSelect.options].find(o => o.value === val);
        if (match) helpSelect.value = val;
        evaluateVisibility();
      });
    });
    contactForm.addEventListener('change', evaluateVisibility);
    evaluateVisibility();

    /* ---------- Contact form submit (visual only, with inline validation) ---------- */
    const errorMessages = {
      cName: 'Enter your name',
      cEmail: 'Add an email so we know where to reply',
      cHelp: 'Choose what we can help with'
    };
    const showError = (row, msg) => {
      row.classList.add('field-invalid');
      let err = row.querySelector('.field-error, .chip-group-error');
      if (!err) {
        err = document.createElement('span');
        err.className = row.classList.contains('chip-group') ? 'chip-group-error' : 'field-error';
        row.appendChild(err);
      }
      err.textContent = msg;
    };
    const clearError = row => row.classList.remove('field-invalid');
    const isVisible = el => el.offsetParent !== null;

    contactForm.querySelectorAll('input, select, textarea').forEach(field => {
      const clear = () => { const row = field.closest('.form-row'); if (row) clearError(row); };
      field.addEventListener('input', clear);
      field.addEventListener('change', clear);
    });

    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      let valid = true;

      contactForm.querySelectorAll('[required]').forEach(field => {
        if (!isVisible(field)) return;
        const row = field.closest('.form-row');
        if (!field.value.trim()) {
          valid = false;
          showError(row, errorMessages[field.id] || 'This field is required');
        } else {
          clearError(row);
        }
      });

      contactForm.querySelectorAll('.chip-group[data-chip-required]').forEach(group => {
        if (!isVisible(group)) return;
        const checked = group.querySelector('input[type="checkbox"]:checked');
        if (!checked) {
          valid = false;
          showError(group, 'Choose at least one');
        } else {
          clearError(group);
        }
      });

      if (!valid) {
        const firstInvalid = contactForm.querySelector('.field-invalid');
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

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

  /* ---------- Filter pills (events / shop / programs) — supports multiple independent filter rows (e.g. category + month) that combine with AND logic ---------- */
  (() => {
    const filterGroups = document.querySelectorAll('.filter-pills');
    const filterableCards = document.querySelectorAll('[data-category]');
    if (!filterGroups.length || !filterableCards.length) return;
    const groupStates = new Map();

    function recomputeVisibility() {
      let visibleCount = 0;
      filterableCards.forEach(card => {
        let match = true;
        groupStates.forEach((activeValues, group) => {
          if (activeValues.size === 0) return;
          const attr = group.dataset.filterAttr || 'category';
          if (!activeValues.has(card.dataset[attr])) match = false;
        });
        card.classList.toggle('is-hidden', !match);
        if (match) visibleCount++;
      });
      document.querySelectorAll('.cal-month-head[id]').forEach(head => {
        const monthCards = document.querySelectorAll(`[data-month="${head.id}"]`);
        const anyVisible = [...monthCards].some(c => !c.classList.contains('is-hidden'));
        head.classList.toggle('is-hidden', monthCards.length > 0 && !anyVisible);
      });
      const empty = document.getElementById('eventsEmpty') || document.getElementById('filterEmpty');
      if (empty) empty.classList.toggle('show', visibleCount === 0);
    }

    filterGroups.forEach(group => {
      const groupPills = group.querySelectorAll('.filter-pill');
      if (!groupPills.length) return;
      const multi = group.dataset.mode === 'multi';
      const allPill = [...groupPills].find(p => p.dataset.filter === 'all');
      groupStates.set(group, new Set());

      groupPills.forEach(pill => {
        pill.addEventListener('click', () => {
          if (!multi) {
            groupPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            groupStates.set(group, pill.dataset.filter === 'all' ? new Set() : new Set([pill.dataset.filter]));
            recomputeVisibility();
            return;
          }
          if (pill.dataset.filter === 'all') {
            groupPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            groupStates.set(group, new Set());
          } else {
            pill.classList.toggle('active');
            const activeValues = new Set([...groupPills].filter(p => p.dataset.filter !== 'all' && p.classList.contains('active')).map(p => p.dataset.filter));
            groupStates.set(group, activeValues);
            if (allPill) allPill.classList.toggle('active', activeValues.size === 0);
          }
          recomputeVisibility();
        });
      });

      const paramName = group.dataset.filterParam || 'category';
      const paramVal = new URLSearchParams(window.location.search).get(paramName);
      if (paramVal) {
        const pill = [...groupPills].find(p => p.dataset.filter === paramVal);
        if (pill) pill.click();
      }
    });
  })();

  /* ---------- Shop: add to cart (visual only) ---------- */
  document.querySelectorAll('button.product-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const original = btn.textContent;
      btn.textContent = 'Added ✓';
      setTimeout(() => { btn.textContent = original; }, 1800);
    });
  });

  /* ---------- Footer: newsletter signup ---------- */
  document.querySelectorAll('.footer-newsletter-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const success = form.nextElementSibling;
      form.style.display = 'none';
      if (success && success.classList.contains('footer-newsletter-success')) success.classList.add('show');
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
