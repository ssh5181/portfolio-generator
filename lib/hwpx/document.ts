/**
 * Minimal HWPX editor: fills table cells, toggles check boxes and embeds images
 * while keeping the original template's styles, tables and layout.
 */
import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Document, type Element, type Node } from "@xmldom/xmldom";

const HP = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const HC = "http://www.hancom.co.kr/hwpml/2011/core";
const CONTENT_HPF = "Contents/content.hpf";

type El = Element;

export interface ImageInput {
  data: Uint8Array;
  /** "png" | "jpg" | "jpeg" | "gif" | "bmp" */
  ext: string;
}

export interface ImageOptions {
  /** fraction of the text width an image may take (default 1) */
  widthRatio?: number;
  /** maximum image height in HWPUNIT (default ~ 60% of the printable height) */
  maxHeight?: number;
}

function children(el: Node, localName?: string): El[] {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!localName || (n as El).localName === localName)) out.push(n as El);
  }
  return out;
}

function descendants(el: El | Document, localName: string): El[] {
  return Array.from(el.getElementsByTagNameNS(HP, localName)) as El[];
}

export function textOf(el: El): string {
  return descendants(el, "t")
    .map((t) => t.textContent ?? "")
    .join("");
}

const norm = (s: string) => s.replace(/\s+/g, "");

export class HwpxDocument {
  private constructor(
    private zip: JSZip,
    private sections: { path: string; doc: Document }[],
    private hpf: Document,
    private header: Document,
  ) {}

  static async load(data: ArrayBuffer | Uint8Array | Buffer): Promise<HwpxDocument> {
    const zip = await JSZip.loadAsync(data);
    const parse = async (p: string) =>
      new DOMParser().parseFromString(await zip.file(p)!.async("string"), "application/xml");
    const hpf = await parse(CONTENT_HPF);
    const paths = Object.keys(zip.files)
      .filter((n) => /^Contents\/section\d+\.xml$/.test(n))
      .sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0]);
    const sections = await Promise.all(paths.map(async (path) => ({ path, doc: await parse(path) })));
    return new HwpxDocument(zip, sections, hpf, await parse("Contents/header.xml"));
  }

  // ---------- lookup ----------

  private get doc(): Document {
    return this.sections[0].doc;
  }

  /** Top-level body paragraphs of all sections, in order. */
  bodyParagraphs(): El[] {
    return this.sections.flatMap((s) => children(s.doc.documentElement!, "p"));
  }

  tables(): El[] {
    return this.sections.flatMap((s) => descendants(s.doc, "tbl"));
  }

  /** The first table that contains a cell whose text equals `label` (spaces ignored). */
  tableWith(label: string): El {
    const t = this.tables().find((tbl) => this.cells(tbl).some((c) => norm(textOf(c)) === norm(label)));
    if (!t) throw new Error(`table with "${label}" not found`);
    return t;
  }

  cells(tbl: El): El[] {
    return children(tbl, "tr").flatMap((tr) => children(tr, "tc"));
  }

  addr(tc: El) {
    const a = children(tc, "cellAddr")[0];
    const s = children(tc, "cellSpan")[0];
    return {
      row: +a.getAttribute("rowAddr")!,
      col: +a.getAttribute("colAddr")!,
      rowSpan: +(s?.getAttribute("rowSpan") ?? 1),
      colSpan: +(s?.getAttribute("colSpan") ?? 1),
    };
  }

  cellAt(tbl: El, row: number, col: number): El | undefined {
    return this.cells(tbl).find((c) => {
      const a = this.addr(c);
      return a.row <= row && row < a.row + a.rowSpan && a.col <= col && col < a.col + a.colSpan;
    });
  }

  /** Cell whose text equals `label`; with `match: "startsWith"` a prefix match. */
  findCell(label: string, opts: { table?: El; match?: "exact" | "startsWith" } = {}): El {
    const pool = opts.table ? this.cells(opts.table) : this.tables().flatMap((t) => this.cells(t));
    const want = norm(label);
    const hit = pool.find((c) => {
      const t = norm(textOf(c));
      return opts.match === "startsWith" ? t.startsWith(want) : t === want;
    });
    if (!hit) throw new Error(`cell "${label}" not found`);
    return hit;
  }

  /** The cell directly to the right of the cell labelled `label`. */
  valueCellOf(label: string, opts: { table?: El; match?: "exact" | "startsWith" } = {}): El {
    const lab = this.findCell(label, opts);
    const tbl = this.tableOf(lab);
    const a = this.addr(lab);
    const right = this.cellAt(tbl, a.row, a.col + a.colSpan);
    if (!right) throw new Error(`no cell right of "${label}"`);
    return right;
  }

  tableOf(el: El): El {
    let n: Node | null = el.parentNode;
    while (n && (n as El).localName !== "tbl") n = n.parentNode;
    return n as El;
  }

  // ---------- writing text ----------

  /** charPr id used by ordinary (black, non-guide) body text in a cell. */
  private bodyCharPr(tc: El): string {
    const ids = descendants(tc, "run").map((r) => r.getAttribute("charPrIDRef")!);
    const ok = ids.find((id) => !this.isGuideCharPr(id));
    if (ok) return ok;
    // fall back to the most common plain (black, not bold) char style in the table, then the document
    const pick = (scope: El[]) => {
      const counts = new Map<string, number>();
      for (const r of scope.flatMap((t) => descendants(t, "run"))) {
        const id = r.getAttribute("charPrIDRef")!;
        if (!this.isGuideCharPr(id) && !this.isBold(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    return pick([this.tableOf(tc)]) ?? pick(this.tables()) ?? ids[0] ?? "0";
  }

  private charPrEl(id: string) {
    return Array.from(this.header.getElementsByTagName("hh:charPr")).find((c) => c.getAttribute("id") === id);
  }

  private isBold(id: string): boolean {
    return (this.charPrEl(id)?.getElementsByTagName("hh:bold").length ?? 0) > 0;
  }

  private isGuideCharPr(id: string): boolean {
    const cp = this.charPrEl(id);
    const color = cp?.getAttribute("textColor")?.toUpperCase() ?? "#000000";
    return color !== "#000000";
  }

  /**
   * Replace a cell's content with `text` (one paragraph per line). The first paragraph's
   * paragraph style is kept; guide-coloured text styles are swapped for body text.
   */
  setCellText(tc: El, text: string, opts: { long?: boolean } = {}): void {
    const sub = children(tc, "subList")[0];
    const paras = children(sub, "p");
    const tmpl = paras[0];
    const charPr = this.bodyCharPr(tc);
    const paraPr = opts.long ? this.bodyParaPr(this.tableOf(tc)) : undefined;
    if (opts.long) sub.setAttribute("vertAlign", "TOP");
    for (const p of paras) sub.removeChild(p);
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    for (const line of lines) {
      const p = this.newParagraph(tmpl, charPr, line, paraPr);
      sub.appendChild(p);
    }
  }

  private alignOf(paraPrId: string): string | undefined {
    const pp = Array.from(this.header.getElementsByTagName("hh:paraPr")).find((p) => p.getAttribute("id") === paraPrId);
    return pp?.getElementsByTagName("hh:align")[0]?.getAttribute("horizontal") ?? undefined;
  }

  /** Most common left/justified paragraph style among a table's cells (for long prose). */
  private bodyParaPr(tbl: El): string | undefined {
    const pick = (scope: El[]) => {
      const counts = new Map<string, number>();
      for (const p of scope.flatMap((t) => descendants(t, "p"))) {
        const id = p.getAttribute("paraPrIDRef")!;
        const al = this.alignOf(id);
        if (al === "JUSTIFY" || al === "LEFT") counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    return pick([tbl]) ?? pick(this.tables());
  }

  private newParagraph(tmpl: El, charPr: string, text: string, paraPr?: string): El {
    const doc = tmpl.ownerDocument!;
    const p = doc.createElementNS(HP, "hp:p");
    for (const attr of ["id", "paraPrIDRef", "styleIDRef", "pageBreak", "columnBreak", "merged"]) {
      p.setAttribute(attr, tmpl.getAttribute(attr) ?? "0");
    }
    p.setAttribute("pageBreak", "0");
    if (paraPr) p.setAttribute("paraPrIDRef", paraPr);
    const run = doc.createElementNS(HP, "hp:run");
    run.setAttribute("charPrIDRef", charPr);
    if (text) {
      const t = doc.createElementNS(HP, "hp:t");
      t.appendChild(doc.createTextNode(text));
      run.appendChild(t);
    }
    p.appendChild(run);
    return p;
  }

  /** Regex-replace inside the text runs of an element (e.g. "( 명)" -> "( 3명)"). */
  replaceText(el: El, pattern: RegExp, replacement: string): boolean {
    // Text may be split over several <hp:t> runs; match over each run of consecutive
    // text nodes (split at controls like check boxes) and write the result into the first.
    let done = false;
    const setText = (t: El, s: string) => {
      while (t.firstChild) t.removeChild(t.firstChild);
      if (s) t.appendChild(t.ownerDocument!.createTextNode(s));
    };
    for (const p of descendants(el, "p")) {
      const segments: El[][] = [[]];
      for (const run of children(p, "run")) {
        for (const c of children(run)) {
          if (c.localName === "t") segments[segments.length - 1].push(c);
          else segments.push([]);
        }
      }
      for (const seg of segments) {
        if (!seg.length) continue;
        const before = seg.map((t) => t.textContent ?? "").join("");
        const after = before.replace(pattern, replacement);
        if (after === before) continue;
        setText(seg[0], after);
        seg.slice(1).forEach((t) => setText(t, ""));
        this.dropLayoutCache(seg[0]);
        done = true;
        if (!pattern.global) return done;
      }
    }
    return done;
  }

  /** Remove cached line layout so 한글 re-flows the edited paragraph. */
  private dropLayoutCache(inside: El): void {
    let n: Node | null = inside;
    while (n && (n as El).localName !== "p") n = n.parentNode;
    if (!n) return;
    for (const ls of children(n, "linesegarray")) n.removeChild(ls);
  }

  // ---------- check boxes ----------

  /** Check boxes inside `scope`, each with the label text that follows it. */
  checkBoxes(scope: El): { box: El; label: string }[] {
    const out: { box: El; label: string }[] = [];
    for (const p of descendants(scope, "p")) {
      let current: { box: El; label: string } | null = null;
      for (const run of children(p, "run")) {
        for (const c of children(run)) {
          if (c.localName === "checkBtn") {
            current = { box: c, label: "" };
            out.push(current);
          } else if (c.localName === "t" && current) {
            current.label += c.textContent ?? "";
          }
        }
      }
    }
    return out;
  }

  /**
   * Set check boxes in `scope`: boxes whose label starts with one of `selected` are checked,
   * the others unchecked.
   */
  setChecks(scope: El, selected: string[]): string[] {
    const hits: string[] = [];
    for (const { box, label } of this.checkBoxes(scope)) {
      const l = norm(label);
      const on = selected.some((s) => l === norm(s) || l.startsWith(norm(s) + "(") || l.startsWith(norm(s)));
      box.setAttribute("value", on ? "CHECKED" : "UNCHECKED");
      if (on) hits.push(label.trim());
    }
    return hits;
  }

  /** All cells in the same row band as `tc` (used as a check-box scope). */
  rowCells(tc: El): El[] {
    const tbl = this.tableOf(tc);
    const a = this.addr(tc);
    return this.cells(tbl).filter((c) => {
      const b = this.addr(c);
      return b.row < a.row + a.rowSpan && a.row < b.row + b.rowSpan;
    });
  }

  // ---------- table rows ----------

  /** Ensure the table has at least `count` rows by cloning its last row. */
  ensureRows(tbl: El, count: number): void {
    const rows = children(tbl, "tr");
    let n = rows.length;
    const last = rows[n - 1];
    while (n < count) {
      const clone = last.cloneNode(true) as El;
      for (const tc of children(clone, "tc")) {
        children(tc, "cellAddr")[0].setAttribute("rowAddr", String(n));
        const sub = children(tc, "subList")[0];
        const ps = children(sub, "p");
        ps.slice(1).forEach((p) => sub.removeChild(p));
        for (const t of descendants(ps[0], "t")) t.parentNode!.removeChild(t);
        for (const ls of children(ps[0], "linesegarray")) ps[0].removeChild(ls);
      }
      tbl.appendChild(clone);
      n++;
    }
    tbl.setAttribute("rowCnt", String(n));
  }

  // ---------- body paragraphs ----------

  /** Index of the top-level paragraph whose text starts with `heading`. */
  findHeading(heading: string): number {
    const ps = this.bodyParagraphs();
    const want = norm(heading);
    const i = ps.findIndex((p) => norm(textOf(p)).startsWith(want));
    if (i < 0) throw new Error(`heading "${heading}" not found`);
    return i;
  }

  /** Guide paragraphs ("※ 작성 지침" etc.) directly under a heading. */
  guideParagraphs(headingIdx: number): El[] {
    const ps = this.bodyParagraphs();
    const out: El[] = [];
    for (let i = headingIdx + 1; i < ps.length; i++) {
      const p = ps[i];
      if (descendants(p, "tbl").length) break;
      const runs = descendants(p, "run");
      const text = textOf(p).trim();
      if (!text) break;
      if (!runs.every((r) => this.isGuideCharPr(r.getAttribute("charPrIDRef")!))) break;
      out.push(p);
    }
    return out;
  }

  // ---------- images ----------

  private textWidth(): number {
    const pagePr = descendants(this.doc, "pagePr")[0];
    const m = children(pagePr, "margin")[0];
    return +pagePr.getAttribute("width")! - +m.getAttribute("left")! - +m.getAttribute("right")!;
  }

  private printableHeight(): number {
    const pagePr = descendants(this.doc, "pagePr")[0];
    const m = children(pagePr, "margin")[0];
    return (
      +pagePr.getAttribute("height")! -
      +m.getAttribute("top")! -
      +m.getAttribute("bottom")! -
      +m.getAttribute("header")! -
      +m.getAttribute("footer")!
    );
  }

  private centerParaPr(): string | undefined {
    const pp = Array.from(this.header.getElementsByTagName("hh:paraPr")).find((p) => {
      const al = p.getElementsByTagName("hh:align")[0];
      return al?.getAttribute("horizontal") === "CENTER";
    });
    return pp?.getAttribute("id") ?? undefined;
  }

  private nextBinId(): number {
    const ids = Array.from(this.hpf.getElementsByTagName("opf:item"))
      .map((i) => /^image(\d+)$/.exec(i.getAttribute("id") ?? "")?.[1])
      .filter(Boolean)
      .map(Number);
    return (ids.length ? Math.max(...ids) : 0) + 1;
  }

  private addBinary(img: ImageInput): string {
    const n = this.nextBinId();
    const ext = img.ext.toLowerCase() === "jpeg" ? "jpg" : img.ext.toLowerCase();
    const id = `image${n}`;
    const href = `BinData/${id}.${ext}`;
    this.zip.file(href, img.data);
    const manifest = this.hpf.getElementsByTagName("opf:manifest")[0];
    const item = this.hpf.createElementNS("http://www.idpf.org/2007/opf/", "opf:item");
    item.setAttribute("id", id);
    item.setAttribute("href", href);
    item.setAttribute("media-type", ext === "jpg" ? "image/jpeg" : `image/${ext}`);
    item.setAttribute("isEmbeded", "1");
    manifest.appendChild(item);
    return id;
  }

  private picElement(d: Document, binId: string, w: number, h: number, pxW: number, pxH: number): El {
    const el = (name: string, attrs: Record<string, string | number> = {}, ns = HP) => {
      const e = d.createElementNS(ns, name);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      return e;
    };
    const uid = Math.floor(Math.random() * 2 ** 31);
    const pic = el("hp:pic", {
      id: uid,
      zOrder: 0,
      numberingType: "PICTURE",
      textWrap: "TOP_AND_BOTTOM",
      textFlow: "BOTH_SIDES",
      lock: 0,
      dropcapstyle: "None",
      href: "",
      groupLevel: 0,
      instid: uid + 1,
      reverse: 0,
    });
    // original size in HWPUNIT at 96 dpi (75 units per pixel)
    const ow = pxW * 75;
    const oh = pxH * 75;
    pic.appendChild(el("hp:offset", { x: 0, y: 0 }));
    pic.appendChild(el("hp:orgSz", { width: ow, height: oh }));
    pic.appendChild(el("hp:curSz", { width: w, height: h }));
    pic.appendChild(el("hp:flip", { horizontal: 0, vertical: 0 }));
    pic.appendChild(el("hp:rotationInfo", { angle: 0, centerX: Math.round(w / 2), centerY: Math.round(h / 2), rotateimage: 1 }));
    const ri = el("hp:renderingInfo");
    const sx = (w / ow).toFixed(6);
    const sy = (h / oh).toFixed(6);
    ri.appendChild(el("hc:transMatrix", { e1: 1, e2: 0, e3: 0, e4: 0, e5: 1, e6: 0 }, HC));
    ri.appendChild(el("hc:scaMatrix", { e1: sx, e2: 0, e3: 0, e4: 0, e5: sy, e6: 0 }, HC));
    ri.appendChild(el("hc:rotMatrix", { e1: 1, e2: 0, e3: 0, e4: 0, e5: 1, e6: 0 }, HC));
    pic.appendChild(ri);
    const rect = el("hp:imgRect");
    rect.appendChild(el("hc:pt0", { x: 0, y: 0 }, HC));
    rect.appendChild(el("hc:pt1", { x: ow, y: 0 }, HC));
    rect.appendChild(el("hc:pt2", { x: ow, y: oh }, HC));
    rect.appendChild(el("hc:pt3", { x: 0, y: oh }, HC));
    pic.appendChild(rect);
    pic.appendChild(el("hp:imgClip", { left: 0, right: ow, top: 0, bottom: oh }));
    pic.appendChild(el("hp:inMargin", { left: 0, right: 0, top: 0, bottom: 0 }));
    pic.appendChild(el("hp:imgDim", { dimwidth: ow, dimheight: oh }));
    pic.appendChild(el("hc:img", { binaryItemIDRef: binId, bright: 0, contrast: 0, effect: "REAL_PIC", alpha: 0 }, HC));
    pic.appendChild(el("hp:effects"));
    pic.appendChild(el("hp:sz", { width: w, widthRelTo: "ABSOLUTE", height: h, heightRelTo: "ABSOLUTE", protect: 0 }));
    pic.appendChild(
      el("hp:pos", {
        treatAsChar: 1,
        affectLSpacing: 0,
        flowWithText: 1,
        allowOverlap: 0,
        holdAnchorAndSO: 0,
        vertRelTo: "PARA",
        horzRelTo: "COLUMN",
        vertAlign: "TOP",
        horzAlign: "LEFT",
        vertOffset: 0,
        horzOffset: 0,
      }),
    );
    pic.appendChild(el("hp:outMargin", { left: 280, right: 280, top: 280, bottom: 280 }));
    return pic;
  }

  /**
   * Insert images as centred paragraphs after the top-level paragraph at `afterIdx`.
   * With widthRatio 0.48, two images share a line.
   */
  insertImagesAfter(afterIdx: number, images: ImageInput[], opts: ImageOptions = {}): void {
    if (!images.length) return;
    const ps = this.bodyParagraphs();
    const anchor = ps[afterIdx];
    const tmpl = anchor;
    const charPr = descendants(anchor, "run")[0]?.getAttribute("charPrIDRef") ?? "0";
    const maxW = Math.floor(this.textWidth() * (opts.widthRatio ?? 1)) - 600;
    const maxH = opts.maxHeight ?? Math.floor(this.printableHeight() * 0.6);
    const p = this.newParagraph(tmpl, charPr, "", this.centerParaPr());
    const run = children(p, "run")[0];
    for (const img of images) {
      const { width: pxW, height: pxH } = imageSize(img.data);
      const scale = Math.min(maxW / (pxW * 75), maxH / (pxH * 75), 1);
      const w = Math.round(pxW * 75 * scale);
      const h = Math.round(pxH * 75 * scale);
      run.appendChild(this.picElement(anchor.ownerDocument!, this.addBinary(img), w, h, pxW, pxH));
    }
    anchor.parentNode!.insertBefore(p, anchor.nextSibling);
  }

  removeParagraph(p: El): void {
    p.parentNode?.removeChild(p);
  }

  // ---------- output ----------

  async save(): Promise<Uint8Array> {
    const ser = new XMLSerializer();
    for (const s of this.sections) this.zip.file(s.path, ser.serializeToString(s.doc));
    this.zip.file(CONTENT_HPF, ser.serializeToString(this.hpf));
    // mimetype must stay first and uncompressed
    const mime = await this.zip.file("mimetype")!.async("string");
    const out = new JSZip();
    out.file("mimetype", mime, { compression: "STORE" });
    for (const [name, f] of Object.entries(this.zip.files)) {
      if (name === "mimetype" || f.dir) continue;
      out.file(name, await f.async("uint8array"));
    }
    return out.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }
}

/** Read pixel size from PNG / JPEG / GIF / BMP headers. */
export function imageSize(b: Uint8Array): { width: number; height: number } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 0x89 && b[1] === 0x50) return { width: dv.getUint32(16), height: dv.getUint32(20) };
  if (b[0] === 0x47 && b[1] === 0x49) return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
  if (b[0] === 0x42 && b[1] === 0x4d) return { width: dv.getInt32(18, true), height: Math.abs(dv.getInt32(22, true)) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      }
      i += 2 + len;
    }
  }
  throw new Error("unsupported image format");
}
