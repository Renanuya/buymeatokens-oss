import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineScript } from "../src/components/inline-script";

describe("InlineScript", () => {
  it("is a real script in the server's HTML, so it runs before the first paint", () => {
    expect(renderToStaticMarkup(<InlineScript html="document.documentElement.classList.add('js')" />)).toBe(
      `<script type="text/javascript">document.documentElement.classList.add('js')</script>`,
    );
  });
});
