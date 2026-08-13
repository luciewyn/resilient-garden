// Progressive enhancement only: every .field-note-figure image already
// carries the viewport-aware max-height/object-fit sizing from
// garden.css on its own, so without this script each image just
// displays at whatever height its own aspect ratio produces under that
// shared rule -- readable, just visually inconsistent from one figure
// to the next within the same note (a small poster-quality source file
// like a video thumbnail renders far shorter than a full photograph,
// since plain width:auto/height:auto sizing never enlarges an image
// past its own intrinsic resolution).
//
// This script makes a note's own first image the height reference for
// every image after it in the same article, so a sequence of process
// images reads as one consistent visual band rather than a jumble of
// different heights. Bare video figures with no poster image (nothing
// for .field-note-figure img to select) are left alone -- there is
// nothing to measure or resize there.
(function () {
  function primaryImage(figure) {
    return figure.querySelector("img");
  }

  function matchHeights(article) {
    var figures = Array.prototype.filter.call(
      article.querySelectorAll(".field-note-figure"),
      function (figure) {
        return !!primaryImage(figure);
      }
    );

    if (figures.length < 2) return;

    var reference = primaryImage(figures[0]);

    function apply() {
      var height = reference.getBoundingClientRect().height;
      if (!height) return;

      figures.slice(1).forEach(function (figure) {
        var img = primaryImage(figure);
        img.style.width = "auto";
        img.style.height = height + "px";
      });
    }

    if (reference.complete) {
      requestAnimationFrame(apply);
    } else {
      reference.addEventListener("load", function () {
        requestAnimationFrame(apply);
      }, { once: true });
    }
  }

  document
    .querySelectorAll(".field-note-page article.field-note")
    .forEach(matchHeights);
})();
