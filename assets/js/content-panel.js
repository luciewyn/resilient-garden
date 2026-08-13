// Shared manager for the site's static editorial content panels (Energy,
// Seed, and any future Soil/Compost/Harvest panel): one authoritative
// "currently open panel" state, so at most one of them is ever visible
// at a time, regardless of which trigger (map hotspot or Map Index
// entry) opened it. Deliberately not used by the Greenhouse dialog,
// which stays a true showModal() tool dialog with its own focus trap
// and scroll lock -- see assets/js/greenhouse-dialog.js. Greenhouse only
// touches this module at one integration point: it closes the active
// content panel (without restoring focus) before it opens itself.
window.ContentPanel = (function () {
  var activeContentPanel = null;
  var activeContentTrigger = null;

  function closeActiveContentPanel(options) {
    var restoreFocus = (options && options.restoreFocus) || false;

    if (!activeContentPanel) {
      return;
    }

    var panel = activeContentPanel;
    var trigger = activeContentTrigger;

    activeContentPanel = null;
    activeContentTrigger = null;

    // Any colour reveal inside this panel (assets/js/image-reveal.js) is
    // only ever meant to last for the current open state -- reset it
    // here so the next time this same panel opens, its images are back
    // to black-and-white, regardless of how it was closed (close
    // button, Escape, or switching straight to a different panel).
    if (window.ImageReveal) {
      window.ImageReveal.reset(panel);
    }

    if (panel.open) {
      panel.close();
    }

    if (restoreFocus && trigger instanceof HTMLElement) {
      // preventScroll: closing a panel must never move the page or the
      // Garden Map underneath it.
      trigger.focus({ preventScroll: true });
    }
  }

  function openContentPanel(panel, trigger) {
    if (!panel) {
      return;
    }

    // Already the open one -- leave it alone rather than closing and
    // reopening it (which would reset its internal scroll position for
    // no reason).
    if (activeContentPanel === panel && panel.open) {
      return;
    }

    // Mutual exclusion: at most one static content panel open at a
    // time, in either direction (Energy -> Seed, Seed -> Energy, and
    // symmetrically for any future panel). restoreFocus: false here
    // specifically -- switching panels must not send focus back to the
    // panel that's being replaced.
    closeActiveContentPanel({ restoreFocus: false });

    activeContentPanel = panel;
    activeContentTrigger = trigger || null;

    panel.show();
  }

  // Wires one static content panel's dialog + close button + every
  // trigger that opens it (map hotspot and Map Index alike) into the
  // shared manager above, so every panel behaves identically and there
  // is exactly one code path -- openContentPanel() -- that ever opens
  // any of them.
  function register(dialog, closeButton, triggers) {
    if (!dialog || !closeButton || !triggers.length) {
      return;
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        // Mirrors the same guard assets/js/ascii-map-drag.js and
        // assets/js/entrance.js use: content panels must stay inert for
        // as long as the Entrance hasn't been dismissed.
        if (document.body.classList.contains("intro-active")) {
          return;
        }
        openContentPanel(dialog, trigger);
        // preventScroll: these panels don't save/restore the page's
        // scroll position (the visitor may keep moving through the
        // Garden Map while one stays open), so focusing the close
        // button must not itself scroll anything into view.
        closeButton.focus({ preventScroll: true });
      });
    });

    closeButton.addEventListener("click", function () {
      closeActiveContentPanel({ restoreFocus: true });
    });

    // Close-event safety: only clear shared state if this dialog is
    // still the one the manager considers active. Switching panels
    // already clears activeContentPanel itself (see openContentPanel)
    // before calling the outgoing panel's close(), so by the time this
    // fires for that outgoing panel, activeContentPanel already points
    // at the new one (or is null) -- without this guard, an unconditional
    // clear here would erase the newly-opened panel's state instead of
    // the one actually being closed.
    dialog.addEventListener("close", function () {
      // Defensive: closeActiveContentPanel() above already resets this
      // dialog's images on the paths it controls, but any native close
      // this manager didn't initiate should still not leave a colour
      // reveal behind.
      if (window.ImageReveal) {
        window.ImageReveal.reset(dialog);
      }
      if (activeContentPanel === dialog) {
        activeContentPanel = null;
        activeContentTrigger = null;
      }
    });

    // Non-modal dialog.show() does not auto-close on Escape the way
    // showModal() does, so that has to be added back explicitly. Since
    // only one static content panel can ever be open, this needs no
    // topmost/stacking-order search: closeActiveContentPanel() always
    // means "close the one panel that's open," and stopPropagation
    // keeps this from also reaching any unrelated ancestor listener.
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeActiveContentPanel({ restoreFocus: true });
      }
    });
  }

  return {
    open: openContentPanel,
    closeActive: closeActiveContentPanel,
    register: register,
  };
})();
