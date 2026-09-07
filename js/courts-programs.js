/* ---------------------------------------------------------------------------
   Live program cards for playthecourts.com.

   Reads the published programme feed from Courts OS and renders cards into any
   container marked up for it. Adding a camp or an event is then a publish in
   Courts OS — not an HTML edit and a deploy.

     <div data-courts-programs
          data-sport="Basketball"     (optional)
          data-type="camp"            (optional)
          data-limit="6">             (optional)
     </div>

   Everything it shows comes from the Offering an admin published: name, dates,
   grades, price, availability. Nothing is hand-maintained here, and nothing is
   invented — if a field is empty in Courts OS, the card omits it rather than
   filling the gap with a guess.
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  // Production feed. Overridable per-container with data-api, and pointed at a
  // local Courts OS automatically when previewing from localhost, so this file
  // is testable without deploying.
  var PROD_API = "https://admin.playthecourts.com/api/public/programs";
  var LOCAL_API = "http://localhost:3000/api/public/programs";

  function apiFor(mount) {
    if (mount.dataset.api) return mount.dataset.api;
    var host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" ? LOCAL_API : PROD_API;
  }

  // Availability wording comes from the platform so the website and the Parent
  // App never disagree about whether something is full.
  var AVAILABILITY_CLASS = {
    available: "cp-ok",
    few_spots: "cp-low",
    waitlist: "cp-full",
    full: "cp-full",
    registration_closed: "cp-closed",
    coming_soon: "cp-soon"
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function formatDates(p) {
    if (!p.startDate) return null;
    var opts = { month: "short", day: "numeric", timeZone: "UTC" };
    var start = new Date(p.startDate).toLocaleDateString("en-US", opts);
    if (!p.endDate || p.startDate === p.endDate) return start;
    return start + " – " + new Date(p.endDate).toLocaleDateString("en-US", opts);
  }

  function card(p) {
    var a = el("a", "cp-card");
    a.href = p.registrationUrl;

    var top = el("div", "cp-card-top");
    var tags = el("div", "cp-tags");
    if (p.sport) tags.appendChild(el("span", "sport-tag", p.sport));
    tags.appendChild(el("span", "cp-type", p.typeLabel));
    top.appendChild(tags);

    var state = el("span", "cp-state " + (AVAILABILITY_CLASS[p.availability] || ""));
    state.textContent = p.availabilityLabel;
    top.appendChild(state);
    a.appendChild(top);

    a.appendChild(el("h3", "cp-name", p.name + (p.season ? " · " + p.season : "")));

    var meta = [formatDates(p), p.grades, p.price].filter(Boolean).join(" · ");
    if (meta) a.appendChild(el("p", "cp-meta", meta));

    if (p.shortDescription) a.appendChild(el("p", "cp-copy", p.shortDescription));

    var cta = el("span", "cp-cta");
    // A full or closed programme shouldn't say "Register" — the label follows
    // what the visitor can actually do.
    cta.textContent =
      p.availability === "waitlist" ? "Join the waitlist" :
      p.availability === "registration_closed" ? "Registration closed" :
      p.availability === "coming_soon" ? "Opens soon" :
      (p.cta || "Register");
    a.appendChild(cta);

    return a;
  }

  function render(mount, programs) {
    mount.innerHTML = "";
    if (!programs.length) {
      // Honest empty state: says nothing is published, not "check back soon"
      // dressed up as if something were coming.
      mount.appendChild(
        el("p", "cp-empty", "Nothing published for this right now. Check the full schedule for what's on.")
      );
      return;
    }
    var grid = el("div", "cp-grid");
    programs.forEach(function (p) { grid.appendChild(card(p)); });
    mount.appendChild(grid);
  }

  function load(mount) {
    var params = new URLSearchParams();
    if (mount.dataset.sport) params.set("sport", mount.dataset.sport);
    if (mount.dataset.type) params.set("type", mount.dataset.type);
    if (mount.dataset.limit) params.set("limit", mount.dataset.limit);

    mount.setAttribute("aria-busy", "true");

    fetch(apiFor(mount) + (params.toString() ? "?" + params : ""), { credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        render(mount, data.programs || []);
      })
      .catch(function () {
        // A failed fetch must never leave a blank hole where content should be,
        // and must not pretend there is no programming — it points at the page
        // that is always available.
        mount.innerHTML = "";
        var p = el("p", "cp-empty");
        p.appendChild(document.createTextNode("Couldn't load programs just now. "));
        var link = el("a", null, "See the full schedule");
        link.href = "/schedule.html";
        p.appendChild(link);
        p.appendChild(document.createTextNode("."));
        mount.appendChild(p);
      })
      .finally(function () {
        mount.removeAttribute("aria-busy");
      });
  }

  function init() {
    var mounts = document.querySelectorAll("[data-courts-programs]");
    for (var i = 0; i < mounts.length; i++) load(mounts[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
