/** Lightweight rich caption editor (bold, italic, line breaks). */

export function sanitizeRichHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html ?? "");
  const allowed = new Set(["B", "STRONG", "I", "EM", "BR", "P", "DIV", "SPAN"]);
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child;
        if (!allowed.has(el.tagName)) {
          const text = document.createTextNode(el.textContent ?? "");
          el.replaceWith(text);
          return;
        }
        [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
        walk(el);
      }
    });
  };
  walk(tpl.content);
  return tpl.innerHTML.trim();
}

export function richEditorPlainText(html) {
  const div = document.createElement("div");
  div.innerHTML = sanitizeRichHtml(html);
  return (div.textContent ?? "").trim();
}

export function mountRichEditor(toolbar, editor) {
  toolbar.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      editor.focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.value ?? undefined);
    });
  });
}

export function getRichEditorHtml(editor) {
  return sanitizeRichHtml(editor.innerHTML);
}

export function setRichEditorHtml(editor, html) {
  editor.innerHTML = sanitizeRichHtml(html || "");
}
