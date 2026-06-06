import { describe, expect, it } from "vitest";
import {
  extractProductPageImageUrls,
  MAX_PRODUCT_PAGE_IMAGES,
} from "./productPageImages";

describe("extractProductPageImageUrls", () => {
  const base = "https://shop.example.com/products/watch-1";

  it("returns JSON-LD images in order then meta then img tags up to 6", () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://cdn.example.com/og-main.jpg" />
        </head>
        <body>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "name": "Watch",
              "image": [
                "https://cdn.example.com/gallery-1.jpg",
                "https://cdn.example.com/gallery-2.jpg"
              ]
            }
          </script>
          <img src="https://cdn.example.com/extra-3.jpg" width="800" height="800" />
          <img src="https://cdn.example.com/extra-4.jpg" width="800" height="800" />
          <img src="https://cdn.example.com/extra-5.jpg" width="800" height="800" />
          <img src="https://cdn.example.com/extra-6.jpg" width="800" height="800" />
          <img src="https://cdn.example.com/extra-7.jpg" width="800" height="800" />
        </body>
      </html>
    `;

    const urls = extractProductPageImageUrls(html, base);
    expect(urls).toHaveLength(MAX_PRODUCT_PAGE_IMAGES);
    expect(urls[0]).toBe("https://cdn.example.com/gallery-1.jpg");
    expect(urls[1]).toBe("https://cdn.example.com/gallery-2.jpg");
    expect(urls[2]).toBe("https://cdn.example.com/og-main.jpg");
    expect(urls[5]).toBe("https://cdn.example.com/extra-4.jpg");
    expect(urls).not.toContain("https://cdn.example.com/extra-7.jpg");
  });

  it("returns all available when fewer than 6 exist", () => {
    const html = `
      <meta property="og:image" content="/images/main.jpg" />
      <img src="/images/side.jpg" width="600" height="600" />
    `;
    const urls = extractProductPageImageUrls(html, base);
    expect(urls).toEqual([
      "https://shop.example.com/images/main.jpg",
      "https://shop.example.com/images/side.jpg",
    ]);
  });

  it("does not stop at 3 when 5 images exist", () => {
    const html = `
      <img src="https://cdn.example.com/a.jpg" width="400" height="400" />
      <img src="https://cdn.example.com/b.jpg" width="400" height="400" />
      <img src="https://cdn.example.com/c.jpg" width="400" height="400" />
      <img src="https://cdn.example.com/d.jpg" width="400" height="400" />
      <img src="https://cdn.example.com/e.jpg" width="400" height="400" />
    `;
    expect(extractProductPageImageUrls(html, base)).toHaveLength(5);
  });
});
