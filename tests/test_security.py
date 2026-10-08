#!/usr/bin/env python3
"""Non-destructive static security regression checks for the parish website."""
from html.parser import HTMLParser
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
js = (root / "assets" / "site.js").read_text(encoding="utf-8")

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csp = ""
        self.scripts = []
        self.handlers = []
    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        self.handlers.extend((tag, name) for name, _ in attrs if re.fullmatch(r"on[a-z]+", name, re.I))
        if tag == "meta" and attributes.get("http-equiv", "").lower() == "content-security-policy":
            self.csp = attributes.get("content", "")
        if tag == "script":
            self.scripts.append(attributes)

parser = AuditParser()
parser.feed(html)
assert parser.csp, "Missing Content Security Policy"
assert "script-src 'self';" in parser.csp, "Script policy must only allow same-origin scripts"
assert "'unsafe-inline'" not in parser.csp.split("script-src", 1)[1].split(";", 1)[0], "Inline scripts are permitted"
assert "object-src 'none'" in parser.csp, "Object embedding is not disabled"
assert not parser.handlers, f"Inline JS event handlers present: {parser.handlers}"
executable = [attrs for attrs in parser.scripts if attrs.get("type") != "application/ld+json"]
assert executable == [{"src": "./assets/site.js", "defer": None}], f"Unexpected executable scripts: {executable}"
assert "new URL('media/', document.baseURI)" in js, "Staging-aware image path validation missing"
assert "target && /^[a-z0-9-]+$/i.test(target)" in js, "Fragment route validation missing"
assert "function renderSafeRichText(container, value)" in js, "Rich text sanitizer missing"
assert "clean.append(cleanNode(child))" in js, "Safe DOM content rendering missing"
assert "function safeHttpUrl(value)" in js, "Map URL validation missing"
assert all(s not in js for s in ("document.write(", "eval(", "new Function(")), "Unsafe dynamic code execution"
print(f"Security regression checks passed: {len(executable)} external application script, no inline handlers.")
