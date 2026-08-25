document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Sticky nav ---------- */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Active nav state (top-level items whose own link matches the current page) ---------- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item > a[href]').forEach(a => {
    if (a.getAttribute('href').split('?')[0].split('#')[0] === currentPage) a.classList.add('nav-active');
  });
  document.querySelectorAll('.mobile-menu > a[href]').forEach(a => {
    if (a.getAttribute('href').split('?')[0].split('#')[0] === currentPage) a.classList.add('nav-active');
  });

  /* ---------- Legal page: active "On This Page" highlight on scroll ---------- */
  const legalToc = document.querySelector('.legal-rail-toc');
  if (legalToc) {
    const tocLinks = [...legalToc.querySelectorAll('a[href^="#"]')];
    const sections = tocLinks
      .map(a => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);
    if (sections.length) {
      const setActive = id => {
        tocLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
      };
      const observer = new IntersectionObserver(entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      }, { rootMargin: '-110px 0px -70% 0px', threshold: 0 });
      sections.forEach(s => observer.observe(s));
    }
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

    const urlParams = new URLSearchParams(window.location.search);
    const interestParam = urlParams.get('interest');
    const subParam = urlParams.get('sub');
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
        const sub = el.dataset.presetSub;
        if (sub) applySub(sub);
      });
    });
    contactForm.addEventListener('change', evaluateVisibility);
    evaluateVisibility();

    // Pre-select a sub-field (e.g. the "What can we help with?" select) within whichever
    // group is currently visible, matching an option by its exact value/text.
    function applySub(subValue) {
      const activeGroup = document.querySelector('.cf-group[data-cat]:not([hidden])');
      if (!activeGroup) return;
      const subSelect = [...activeGroup.querySelectorAll('select')].find(sel =>
        [...sel.options].some(o => o.value === subValue)
      );
      if (subSelect) {
        subSelect.value = subValue;
        subSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (subParam) applySub(subParam);

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

  /* ---------- Schedule page: sport filter (All / Basketball / Volleyball) ---------- */
  const schedFilterTabs = document.querySelectorAll('.sched-filter-tab');
  if (schedFilterTabs.length) {
    const schedCards = document.querySelectorAll('.sched-gate-card');
    const showSport = sport => {
      schedFilterTabs.forEach(t => {
        const active = t.dataset.sport === sport;
        t.classList.toggle('active', active);
        t.setAttribute('aria-current', active ? 'true' : 'false');
      });
      schedCards.forEach(c => {
        const match = sport === 'all' || c.dataset.sport === sport || c.dataset.sport === 'both';
        c.classList.toggle('is-hidden', !match);
      });
    };
    schedFilterTabs.forEach(t => t.addEventListener('click', () => showSport(t.dataset.sport)));
    const typeParam = new URLSearchParams(window.location.search).get('type');
    const initialSport = [...schedFilterTabs].some(t => t.dataset.sport === typeParam) ? typeParam : 'all';
    showSport(initialSport);
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

  /* ---------- Events page: month tabs (show one month's head + list at a time) ---------- */
  (() => {
    const monthTabs = document.querySelectorAll('.events-month-tab');
    if (!monthTabs.length) return;
    const showMonth = month => {
      monthTabs.forEach(t => t.classList.toggle('active', t.dataset.month === month));
      document.querySelectorAll('.cal-month-head[id]').forEach(head => {
        head.style.display = head.id === month ? '' : 'none';
      });
      document.querySelectorAll('.cal-list[data-month-group]').forEach(list => {
        list.style.display = list.dataset.monthGroup === month ? '' : 'none';
      });
    };
    monthTabs.forEach(tab => tab.addEventListener('click', () => showMonth(tab.dataset.month)));
    const monthParam = new URLSearchParams(window.location.search).get('month');
    const hashMonth = window.location.hash.replace('#', '');
    const candidates = [monthParam, hashMonth];
    const initialMonth = candidates.find(m => [...monthTabs].some(t => t.dataset.month === m)) || monthTabs[0].dataset.month;
    showMonth(initialMonth);
    if (hashMonth === initialMonth) {
      const head = document.getElementById(hashMonth);
      if (head) setTimeout(() => head.scrollIntoView({ block: 'start' }), 50);
    }
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
