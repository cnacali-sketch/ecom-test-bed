import { describe, expect, test } from "vitest";

import imageLoader, { MEDIA_WIDTHS } from "./image-loader";

/**
 * The storefront had `unoptimized: true`, so `next/image` generated no srcset
 * and every `sizes` prop was decorative -- a phone downloaded the desktop
 * image. On the homepage that is 78 images, nearly all of them Pexels, served
 * at one fixed width to every visitor.
 *
 * These cover the two things a loader can get wrong: asking a host for a size
 * it will not serve, and rewriting a URL into one that does not exist.
 */

describe("pexels", () => {
  const src =
    "https://images.pexels.com/photos/12144990/pexels-photo-12144990.jpeg?auto=compress&cs=tinysrgb&w=800&h=1000&fit=crop";

  test("asks for the width the device actually needs", () => {
    expect(imageLoader({ src, width: 400 })).toContain("w=400");
    expect(imageLoader({ src, width: 1200 })).toContain("w=1200");
  });

  test("keeps the compression parameters the URL was authored with", () => {
    /** Dropping auto=compress would ask for the untouched original, which is
     * how a "responsive images" change makes every image bigger. */
    const out = imageLoader({ src, width: 400 });

    expect(out).toContain("auto=compress");
    expect(out).toContain("cs=tinysrgb");
    expect(out).toContain("fit=crop");
  });

  test("drops the authored height instead of keeping it", () => {
    /** `h` was written next to a fixed `w` to express a crop ratio. Carrying
     * it unchanged while the width varies asks for a different shape at every
     * breakpoint, so the same photo is cropped differently on a phone. */
    expect(imageLoader({ src, width: 400 })).not.toContain("h=1000");
  });

  test("a url with no query string still gets a width", () => {
    const bare = "https://images.pexels.com/photos/1/pexels-photo-1.jpeg";

    expect(imageLoader({ src: bare, width: 800 })).toBe(
      "https://images.pexels.com/photos/1/pexels-photo-1.jpeg?w=800",
    );
  });
});

describe("our own media", () => {
  const src = "https://api.savvyinteal.com/media/abc123__photo.png";

  test("points at the generated webp derivative", () => {
    expect(imageLoader({ src, width: 400 })).toBe(
      "https://api.savvyinteal.com/media/abc123__photo__w400.webp",
    );
  });

  test("rounds up to the next derivative rather than down", () => {
    /** Rounding down serves an image smaller than its slot, which is visible
     * as blur. Rounding up costs bytes and looks correct. */
    expect(imageLoader({ src, width: 500 })).toContain("__w800.webp");
  });

  test("falls back to the original above the largest derivative", () => {
    /** Nothing wider exists on disk; a __w2400 URL would simply 404. */
    const largest = MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];

    expect(imageLoader({ src, width: largest + 1 })).toBe(src);
  });

  test("a derivative url is left alone rather than derived twice", () => {
    const derivative = "https://api.savvyinteal.com/media/abc__photo__w400.webp";

    expect(imageLoader({ src: derivative, width: 400 })).toBe(derivative);
  });

  test("a relative /media path works the same way", () => {
    /** Content authored before the API origin was baked into URLs. */
    expect(imageLoader({ src: "/media/abc__photo.png", width: 400 })).toBe(
      "/media/abc__photo__w400.webp",
    );
  });

  test("a file with no extension does not lose its name", () => {
    expect(imageLoader({ src: "/media/plainfile", width: 400 })).toBe(
      "/media/plainfile__w400.webp",
    );
  });
});

describe("everything else", () => {
  test("an unknown host is returned untouched", () => {
    /** Guessing at a resizing API a host may not have turns working images
     * into 404s, which is worse than a large image. */
    const src = "https://placehold.co/600x400.png";

    expect(imageLoader({ src, width: 400 })).toBe(src);
  });

  test("a local public asset is returned untouched", () => {
    expect(imageLoader({ src: "/brand/logo.webp", width: 400 })).toBe("/brand/logo.webp");
  });

  test("an empty src does not throw", () => {
    /** Content fields are nullable; a missing image must not take the page
     * down on the server during render. */
    expect(() => imageLoader({ src: "", width: 400 })).not.toThrow();
  });
});
