/*!
 * buymeatokens website button. https://buymeatokens.com
 *
 *   <script src="https://buymeatokens.com/widget.js" data-user="yourname" async></script>
 *
 * data-mode      "floating" (default): a button at the bottom of the page; "inline": the button where the tag is
 * data-theme     "dark" (default), "light", "iris" or "lilac"
 * data-position  "center" (default), "left" or "right", for the floating button
 *
 * It only draws a link to your page. No cookies, no tracking, no requests to anyone.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || !document.createElement("div").attachShadow) return;

  var user = (script.getAttribute("data-user") || "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38})$/.test(user)) {
    if (window.console) console.warn("[buymeatokens] Set data-user to your page name, e.g. data-user=\"yourname\".");
    return;
  }
  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    return;
  }
  var inline = script.getAttribute("data-mode") === "inline";
  var position = script.getAttribute("data-position");
  // Centred at the bottom unless a corner is asked for.
  var place = position === "left" ? "left:20px" : position === "right" ? "right:20px" : "left:50%;transform:translateX(-50%)";
  if (!inline && document.querySelector("[data-buymeatokens-floating]")) return;

  // [background, text, round tile, mark on the tile, hairline]
  var THEMES = {
    dark: ["#1c1c1e", "#ffffff", "#cdd2fb", "#1c1c1e", "rgba(255,255,255,.14)"],
    light: ["#ffffff", "#1c1c1e", "#cdd2fb", "#1c1c1e", "rgba(28,28,30,.14)"],
    iris: ["#5b6cf2", "#ffffff", "#ffffff", "#5b6cf2", "rgba(255,255,255,.2)"],
    lilac: ["#cdd2fb", "#1c1c1e", "#1c1c1e", "#ffffff", "rgba(28,28,30,.1)"],
  };
  var t = THEMES[script.getAttribute("data-theme")] || THEMES.dark;

  var host = document.createElement(inline ? "span" : "div");
  var root = host.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent =
    ":host{all:initial}" +
    (inline ? ":host{display:inline-block;vertical-align:middle}" : "") +
    "a{box-sizing:border-box;display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 18px 0 6px;" +
    "border-radius:999px;background:" + t[0] + ";color:" + t[1] + ";box-shadow:inset 0 0 0 1px " + t[4] + ";" +
    "font:600 15px/1 'Inter Tight',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
    "letter-spacing:-.01em;text-decoration:none;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;" +
    "transition:transform .18s ease,box-shadow .18s ease}" +
    "a:hover{transform:translateY(-1px)}" +
    "a:focus-visible{outline:2px solid #5b6cf2;outline-offset:3px}" +
    "i{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:" + t[2] + ";color:" + t[3] + ";flex:none}" +
    "svg{width:18px;height:18px}" +
    (inline
      ? ""
      : ":host{position:fixed;z-index:2147483000;bottom:calc(20px + env(safe-area-inset-bottom,0px));" + place + "}" +
        "a{height:52px;padding:0 22px 0 8px;box-shadow:inset 0 0 0 1px " + t[4] + ",0 10px 30px rgba(28,28,30,.22)}" +
        "i{width:36px;height:36px}" +
        // Phones: just the round mark, so the button doesn't cover the page. Narrow desktop windows keep the label.
        "@media (max-width:480px) and (hover:none) and (pointer:coarse){a{width:52px;padding:0;justify-content:center}span{display:none}}") +
    "@media (prefers-reduced-motion:reduce){a{transition:none}a:hover{transform:none}}";

  var link = document.createElement("a");
  // No noreferrer: the visit then counts under this site in the creator's Analytics.
  link.href = origin + "/" + user;
  link.target = "_blank";
  link.rel = "noopener";
  link.setAttribute("aria-label", "Buy me AI tokens on buymeatokens");
  link.title = "Buy me AI tokens";

  var tile = document.createElement("i");
  tile.setAttribute("aria-hidden", "true");
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  var path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  tile.appendChild(svg);

  var label = document.createElement("span");
  label.textContent = "Buy me AI tokens";

  link.appendChild(tile);
  link.appendChild(label);
  root.appendChild(style);
  root.appendChild(link);

  if (inline) {
    script.parentNode.insertBefore(host, script.nextSibling);
  } else {
    host.setAttribute("data-buymeatokens-floating", "");
    var place = function () {
      document.body.appendChild(host);
    };
    if (document.body) place();
    else document.addEventListener("DOMContentLoaded", place);
  }
})();
