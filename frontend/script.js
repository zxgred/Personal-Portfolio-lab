// script.js - Personal Portfolio (jQuery + AJAX only, no fetch/Axios)
// Flow: jQuery AJAX -> Express -> MySQL -> JSON -> jQuery builds the page

$(document).ready(function () {
  "use strict";

  /* =====================================================
     SETTINGS AND STATE
  ===================================================== */
  // When the page is opened from Express (port 3000) the API is on the same address
  const API = location.port === "3000" ? "" : "http://localhost:3000";

  let portfolio = null;      // all data loaded from MySQL
  let formConfig = null;     // describes the form that is currently open (setup or modal)
  let confirmAction = null;  // function to run when "Delete" is confirmed
  let toastTimer = null;

  /* =====================================================
     FIELD DEFINITIONS (reusable: the same builder makes every form)
  ===================================================== */
  const PROFILE_FIELDS = [
    { name: "full_name", label: "Full name", required: true, placeholder: "e.g. Pablo" },
    { name: "title", label: "Professional title", required: true, placeholder: "e.g. Full Stack Dev" },
    { name: "tagline", label: "Tagline", wide: true, placeholder: "One short sentence about you" },
    { name: "about", label: "About me", type: "textarea", required: true, wide: true, placeholder: "Write a short introduction" },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone" },
    { name: "location", label: "Location", placeholder: "City, Country" },
    { name: "github", label: "GitHub link", placeholder: "https://github.com/username" },
    { name: "linkedin", label: "LinkedIn link", placeholder: "https://linkedin.com/in/username", wide: true },
    { name: "image", label: "Profile photo (JPG, PNG, WEBP or GIF, max 2 MB)", type: "file", wide: true }
  ];

  const SECTIONS = {
    skills: {
      title: "Skill",
      endpoint: "/api/skills",
      fields: [
        { name: "name", label: "Skill name", required: true, placeholder: "e.g. JavaScript" },
        { name: "level", label: "Level (0 - 100)", type: "number", required: true, min: 0, max: 100 }
      ]
    },
    experience: {
      title: "Experience",
      endpoint: "/api/experience",
      fields: [
        { name: "role", label: "Role", required: true },
        { name: "company", label: "Company", required: true },
        { name: "start_year", label: "Start year", required: true, placeholder: "2024" },
        { name: "end_year", label: "End year (empty = present)", placeholder: "2026" },
        { name: "description", label: "Description", type: "textarea", wide: true }
      ]
    },
    education: {
      title: "Education",
      endpoint: "/api/education",
      fields: [
        { name: "degree", label: "Degree", required: true },
        { name: "institution", label: "Institution", required: true },
        { name: "start_year", label: "Start year", required: true, placeholder: "2023" },
        { name: "end_year", label: "End year (empty = present)", placeholder: "2027" },
        { name: "description", label: "Description", type: "textarea", wide: true }
      ]
    },
    projects: {
      title: "Project",
      endpoint: "/api/projects",
      multipart: true,
      fields: [
        { name: "title", label: "Project title", required: true, wide: true },
        { name: "description", label: "Description", type: "textarea", required: true, wide: true },
        { name: "tech", label: "Technologies (comma separated)", placeholder: "jQuery, Node.js, MySQL" },
        { name: "link", label: "Project link", placeholder: "https://..." },
        { name: "image", label: "Project image (max 2 MB)", type: "file", wide: true }
      ]
    }
  };

  /* =====================================================
     SMALL REUSABLE HELPERS
  ===================================================== */
  // Escape text before putting it into HTML (protects against script injection)
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Bottom message (success or error)
  function showToast(text, isError) {
    const $toast = $("#toast");
    $toast.text(text).toggleClass("error", Boolean(isError)).addClass("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.removeClass("show"); }, 3200);
  }

  // Friendly text for failed requests
  function getErrorText(jqXHR) {
    if (jqXHR.status === 0) {
      return "Cannot reach the server. Make sure Node.js is running (npm start) and MySQL is started in XAMPP.";
    }
    if (jqXHR.responseJSON && jqXHR.responseJSON.message) return jqXHR.responseJSON.message;
    return "Something went wrong (HTTP " + jqXHR.status + ").";
  }

  // Show only one of the main screens
  function showScreen(selector) {
    $("#loading, #errorBox, #setup, #portfolio").prop("hidden", true);
    $(selector).prop("hidden", false);
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function yearsText(item) {
    return item.start_year + " – " + (item.end_year || "Present");
  }

  // Edit / Delete buttons that appear only in Edit mode
  function actionButtons(section, id) {
    return `<div class="item-actions edit-only">
      <button type="button" class="chip-btn" data-action="edit" data-section="${section}" data-id="${id}">Edit</button>
      <button type="button" class="chip-btn danger" data-action="delete" data-section="${section}" data-id="${id}">Delete</button>
    </div>`;
  }

  function emptyMessage(text) {
    return `<div class="empty">${esc(text)} Turn on Edit mode to add one.</div>`;
  }

  /* =====================================================
     REUSABLE FORM BUILDER
  ===================================================== */
  function buildFields(fields, values) {
    values = values || {};
    return $.map(fields, function (f) {
      const id = "f_" + f.name;
      const req = f.required ? " required" : "";
      let control;

      if (f.type === "textarea") {
        control = `<textarea id="${id}" name="${f.name}" rows="4" placeholder="${esc(f.placeholder)}"${req}>${esc(values[f.name])}</textarea>`;
      } else if (f.type === "file") {
        const current = values.__image ? `<img class="file-preview" src="${esc(values.__image)}" alt="Current image">` : "";
        const remove = values.__image
          ? `<label class="check"><input type="checkbox" name="remove_image" value="1"> Remove current image</label>` : "";
        control = `<div class="file-row">${current}<img class="file-preview preview-new" alt="New image" hidden>
          <input type="file" id="${id}" name="${f.name}" accept="image/png,image/jpeg,image/webp,image/gif"></div>${remove}`;
      } else {
        const type = f.type === "number" ? "number" : f.type === "email" ? "email" : "text";
        const range = f.type === "number" ? ` min="${f.min}" max="${f.max}"` : "";
        control = `<input type="${type}" id="${id}" name="${f.name}" value="${esc(values[f.name])}" placeholder="${esc(f.placeholder)}"${range}${req}>`;
      }
      return `<div class="field${f.wide ? " field--wide" : ""}"><label for="${id}">${esc(f.label)}${f.required ? " *" : ""}</label>${control}</div>`;
    }).join("");
  }

  // Live preview of a newly chosen image
  $(document).on("change", "input[type=file]", function () {
    const file = this.files[0];
    const $preview = $(this).siblings(".preview-new");
    if (file) $preview.attr("src", URL.createObjectURL(file)).prop("hidden", false);
    else $preview.prop("hidden", true);
  });

  /* =====================================================
     REUSABLE MODAL (add / edit window)
  ===================================================== */
  function openModal(title, fields, values, config) {
    formConfig = config;
    $("#modalTitle").text(title);
    $("#modalForm").html(buildFields(fields, values));
    $("#modalError").text("");
    $("#modal").prop("hidden", false);
    $("#modalForm input:first, #modalForm textarea:first").first().trigger("focus");
  }

  function closeModal() {
    $("#modal").prop("hidden", true);
    $("#modalForm").empty();
  }

  $("#modalCancel").on("click", closeModal);
  $("#modal").on("click", function (event) { if (event.target === this) closeModal(); });
  $(document).on("keydown", function (event) {
    if (event.key === "Escape") { closeModal(); $("#confirmBox").prop("hidden", true); }
  });

  // Confirm window (used before deleting)
  function askConfirm(message, onYes) {
    $("#confirmText").text(message);
    confirmAction = onYes;
    $("#confirmBox").prop("hidden", false);
  }
  $("#confirmNo").on("click", function () { $("#confirmBox").prop("hidden", true); });
  $("#confirmYes").on("click", function () {
    $("#confirmBox").prop("hidden", true);
    if (confirmAction) confirmAction();
  });

  /* =====================================================
     AJAX: LOAD (GET)
  ===================================================== */
  function loadPortfolio(showLoader) {
    $.ajax({
      url: API + "/api/portfolio",
      method: "GET",
      dataType: "json",

      beforeSend: function () {
        if (showLoader) showScreen("#loading");
      },
      success: function (data) {
        console.log("GET /api/portfolio response:", data);
        portfolio = data;
        if (!data.profile) {
          // first time: nothing saved yet, show the setup form
          $("body").removeClass("has-profile edit-mode");
          $("#editToggle").text("Edit");
          $("#navBrand").text("Portfolio");
          $("title").text("Portfolio");
          $("#setupForm").html(buildFields(PROFILE_FIELDS));
          showScreen("#setup");
        } else {
          $("body").addClass("has-profile");
          renderPortfolio();
          showScreen("#portfolio");
        }
      },
      error: function (jqXHR) {
        console.log("GET /api/portfolio error:", jqXHR);
        $("#errorText").text(getErrorText(jqXHR));
        showScreen("#errorBox");
      }
    });
  }

  $("#retryBtn").on("click", function () { loadPortfolio(true); });

  /* =====================================================
     RENDERING (jQuery builds the page from the data)
  ===================================================== */
  function profileImageUrl(p) {
    return p.has_image ? API + "/api/profile/image?v=" + encodeURIComponent(p.updated_at) : "";
  }

  function renderPortfolio() {
    renderHero();
    renderSkills();
    renderTimeline("experience", "#experienceList", "role", "company", "No experience added yet.");
    renderTimeline("education", "#educationList", "degree", "institution", "No education added yet.");
    renderProjects();
    renderContact();
  }

  function renderHero() {
    const p = portfolio.profile;
    const photo = p.has_image
      ? `<img src="${esc(profileImageUrl(p))}" alt="${esc(p.full_name)}">`
      : esc(initials(p.full_name));
    let links = `<a class="btn" href="#contact">Get in touch</a>`;
    if (p.github) links += `<a class="link-more" href="${esc(p.github)}" target="_blank" rel="noopener">GitHub ›</a>`;
    if (p.linkedin) links += `<a class="link-more" href="${esc(p.linkedin)}" target="_blank" rel="noopener">LinkedIn ›</a>`;
    links += `<button type="button" class="btn btn-ghost edit-only" data-action="edit-profile">Edit profile</button>`;

    $("#home").html(`<div class="container">
      <div class="avatar">${photo}</div>
      <p class="eyebrow">${esc(p.title)}</p>
      <h1>${esc(p.full_name)}</h1>
      <p class="tagline">${esc(p.tagline)}</p>
      <div class="hero-links">${links}</div>
    </div>`);

    $("#aboutText").text(p.about);
    $("#navBrand").text(p.full_name);
    $("title").text(p.full_name + " | Portfolio");
    $("#footerText").text("© " + new Date().getFullYear() + " " + p.full_name);
  }

  function renderSkills() {
    const $list = $("#skillsList").empty();
    if (portfolio.skills.length === 0) return $list.html(emptyMessage("No skills added yet."));

    $.each(portfolio.skills, function (i, s) {
      $list.append(`<div class="card">
        <div class="skill-top">${esc(s.name)}<span>${s.level}%</span></div>
        <div class="bar"><div class="bar-fill" data-level="${s.level}"></div></div>
        ${actionButtons("skills", s.id)}
      </div>`);
    });
    // animate the bars after they are on the page
    setTimeout(function () {
      $list.find(".bar-fill").each(function () { $(this).css("width", $(this).data("level") + "%"); });
    }, 50);
  }

  // One function builds both the Experience and the Education lists
  function renderTimeline(section, listId, titleKey, subKey, emptyText) {
    const $list = $(listId).empty();
    const items = portfolio[section];
    if (items.length === 0) return $list.html(emptyMessage(emptyText));

    $.each(items, function (i, item) {
      $list.append(`<div class="card">
        <h3>${esc(item[titleKey])}</h3>
        <p class="sub">${esc(item[subKey])}</p>
        <p class="years">${esc(yearsText(item))}</p>
        <p class="desc">${esc(item.description)}</p>
        ${actionButtons(section, item.id)}
      </div>`);
    });
  }

  function renderProjects() {
    const $list = $("#projectsList").empty();
    if (portfolio.projects.length === 0) return $list.html(emptyMessage("No projects added yet."));

    $.each(portfolio.projects, function (i, p) {
      const image = p.has_image
        ? `<img src="${esc(API + "/api/projects/" + p.id + "/image?v=" + encodeURIComponent(p.updated_at))}" alt="${esc(p.title)}" loading="lazy">`
        : esc(p.title.charAt(0).toUpperCase());
      const tags = $.map(p.tech ? p.tech.split(",") : [], function (t) {
        return t.trim() ? `<span class="tag">${esc(t.trim())}</span>` : null;
      }).join("");
      const link = p.link ? `<a class="link-more" href="${esc(p.link)}" target="_blank" rel="noopener">View project ›</a>` : "";

      $list.append(`<article class="card project">
        <div class="project-img">${image}</div>
        <div class="project-body">
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
          <div class="tags">${tags}</div>
          ${link}
          ${actionButtons("projects", p.id)}
        </div>
      </article>`);
    });
  }

  function renderContact() {
    const p = portfolio.profile;
    const items = [
      ["Email", p.email, "mailto:" + p.email],
      ["Phone", p.phone, ""],
      ["Location", p.location, ""],
      ["GitHub", p.github, p.github],
      ["LinkedIn", p.linkedin, p.linkedin]
    ];
    const $list = $("#contactList").empty();
    $.each(items, function (i, item) {
      if (!item[1]) return; // skip empty values
      const value = item[2]
        ? `<a href="${esc(item[2])}" target="_blank" rel="noopener">${esc(item[1])}</a>`
        : esc(item[1]);
      $list.append(`<div class="card contact-item"><span>${item[0]}</span><strong>${value}</strong></div>`);
    });
  }

  /* =====================================================
     AJAX: SAVE (POST / PUT) - used by the setup form AND the modal
  ===================================================== */
  function submitForm(form, config, $errorBox, $button, label) {
    const settings = { url: API + config.endpoint, method: config.method, dataType: "json" };

    if (config.multipart) {
      // forms with an image are sent as FormData
      settings.data = new FormData(form);
      settings.processData = false;
      settings.contentType = false;
    } else {
      // normal forms: JavaScript object -> JSON string
      const data = {};
      $.each($(form).serializeArray(), function (i, f) { data[f.name] = f.value; });
      settings.data = JSON.stringify(data);
      settings.contentType = "application/json";
    }

    settings.beforeSend = function () {
      $errorBox.text("");
      $button.prop("disabled", true).text("Saving...");
    };
    settings.success = function (response) {
      console.log(config.method + " " + config.endpoint + " response:", response);
      showToast(response.message);
      closeModal();
      loadPortfolio(false); // refresh the data without reloading the page
    };
    settings.error = function (jqXHR) {
      console.log(config.method + " " + config.endpoint + " error:", jqXHR);
      $errorBox.text(getErrorText(jqXHR));
    };
    settings.complete = function () {
      $button.prop("disabled", false).text(label);
    };
    $.ajax(settings);
  }

  // First-time setup form
  $("#setupForm").on("submit", function (event) {
    event.preventDefault();
    submitForm(this, { endpoint: "/api/profile", method: "POST", multipart: true },
      $("#setupError"), $("#setupBtn"), "Create my portfolio");
  });

  // Add / edit window
  $("#modalForm").on("submit", function (event) {
    event.preventDefault();
    submitForm(this, formConfig, $("#modalError"), $("#modalSave"), "Save");
  });

  /* =====================================================
     BUTTONS: add, edit, delete, edit profile, reset
  ===================================================== */
  $(document).on("click", "[data-action]", function () {
    const action = $(this).data("action");
    const section = $(this).data("section");
    const id = $(this).data("id");
    const config = SECTIONS[section];

    if (action === "add") {
      openModal("Add " + config.title.toLowerCase(), config.fields, {},
        { endpoint: config.endpoint, method: "POST", multipart: Boolean(config.multipart) });
    }

    if (action === "edit") {
      const item = $.grep(portfolio[section], function (x) { return x.id === id; })[0];
      const values = $.extend({}, item);
      if (section === "projects" && item.has_image) {
        values.__image = API + "/api/projects/" + id + "/image?v=" + encodeURIComponent(item.updated_at);
      }
      openModal("Edit " + config.title.toLowerCase(), config.fields, values,
        { endpoint: config.endpoint + "/" + id, method: "PUT", multipart: Boolean(config.multipart) });
    }

    if (action === "delete") {
      askConfirm("This " + config.title.toLowerCase() + " will be permanently deleted.", function () {
        $.ajax({
          url: API + config.endpoint + "/" + id,
          method: "DELETE",
          dataType: "json",
          success: function (response) { showToast(response.message); loadPortfolio(false); },
          error: function (jqXHR) { showToast(getErrorText(jqXHR), true); }
        });
      });
    }

    if (action === "edit-profile") {
      const values = $.extend({}, portfolio.profile);
      if (values.has_image) values.__image = profileImageUrl(values);
      openModal("Edit profile", PROFILE_FIELDS, values,
        { endpoint: "/api/profile", method: "PUT", multipart: true });
    }

    if (action === "reset") {
      askConfirm("Your whole portfolio (profile, skills, experience, education and projects) will be deleted.", function () {
        $.ajax({
          url: API + "/api/portfolio",
          method: "DELETE",
          dataType: "json",
          success: function (response) { showToast(response.message); loadPortfolio(true); },
          error: function (jqXHR) { showToast(getErrorText(jqXHR), true); }
        });
      });
    }
  });

  // Edit mode switch in the navigation bar
  $("#editToggle").on("click", function () {
    const on = $("body").toggleClass("edit-mode").hasClass("edit-mode");
    $(this).text(on ? "Done" : "Edit");
    showToast(on ? "Edit mode is on. Use the buttons to add, edit or delete." : "Edit mode is off.");
  });

  /* =====================================================
     START
  ===================================================== */
  loadPortfolio(true);
});
