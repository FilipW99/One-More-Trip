/** Tiny DOM helpers: the UI is plain DOM, rebuilt per screen. */

export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'disabled' || k === 'checked' || k === 'selected') (el as unknown as Record<string, boolean>)[k] = Boolean(v);
      else if (k === 'value') (el as unknown as { value: string }).value = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Replace an element's children in one go. */
export function mount(el: Element, ...children: Child[]): void {
  clear(el);
  append(el, children);
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${fmt(n)} ${n === 1 ? word : many}`;
}
