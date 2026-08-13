// Progressive enhancement only: every .field-note-video-figure ships
// with its poster <img> visible and its <video> hidden in the HTML
// itself, so without this script the visitor just sees a still image --
// nothing missing, nothing broken, just not playable. There is no
// native-video fallback path to preserve here the way image-reveal.js
// preserves a BW <img> src: a hidden [hidden] <video> with no JS to
// un-hide it is simply a still poster forever, which is an acceptable
// no-JS reading of a process photograph.
//
// Deliberately a separate class/script from assets/js/image-reveal.js:
// a video poster's click means "play this video," not "reveal the
// colour version of this image" -- the two interactions never combine
// on the same button. See BW -> COLOUR INTERACTION CONFLICT in the
// brief this implements.
(function () {
  async function activateFieldNoteVideo(trigger) {
    var figure = trigger.closest(".field-note-video-figure");
    if (!figure) return;

    var video = figure.querySelector(".field-note-video");
    if (!video) return;

    // The poster and the video are two different files with two
    // different intrinsic aspect ratios (a photo vs. a screen
    // recording) -- garden.css sizes each of them from its own natural
    // ratio under the same viewport-height rule, which is not
    // guaranteed to produce the same box for both. Locking the video's
    // width/height in pixels to the poster's actual rendered box (right
    // before swapping visibility) makes the poster's box authoritative;
    // object-fit: contain (see garden.css) then letterboxes the video
    // inside that fixed box if its own ratio doesn't match, rather than
    // the switch itself changing the box size.
    var rect = trigger.getBoundingClientRect();
    if (rect.width && rect.height) {
      video.style.width = rect.width + "px";
      video.style.height = rect.height + "px";
    }

    trigger.hidden = true;
    video.hidden = false;

    try {
      await video.play();
    } catch (error) {
      console.info("Video playback requires user interaction.", error);
    }
  }

  function resetFieldNoteVideos(container) {
    var scope = container || document;
    var figures = scope.querySelectorAll(".field-note-video-figure");

    figures.forEach(function (figure) {
      var trigger = figure.querySelector(".field-note-video-trigger");
      var video = figure.querySelector(".field-note-video");

      if (!trigger || !video) return;

      video.pause();
      video.currentTime = 0;
      video.hidden = true;
      video.style.removeProperty("width");
      video.style.removeProperty("height");
      trigger.hidden = false;
    });
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest(".field-note-video-trigger");
    if (!trigger) return;
    activateFieldNoteVideo(trigger);
  });

  // Covers plain reloads (the HTML already starts poster-visible/
  // video-hidden, so this is belt-and-suspenders) and, more
  // importantly, browser Back/Forward restorations from bfcache, which
  // resurrect the DOM exactly as the visitor left it -- a mid-playback
  // video included -- without re-running this script from scratch.
  window.addEventListener("pageshow", function () {
    resetFieldNoteVideos(document);
  });

  window.FieldNoteVideo = {
    activate: activateFieldNoteVideo,
    reset: resetFieldNoteVideos,
  };
})();
