/** Form state for the web UI, plus browser draft storage. */
import type { AttachmentKey, PortfolioData, TemplateId } from "../templates";

export interface AttachmentItem {
  id: string;
  name: string;
  /** image/png, image/jpeg ... */
  type: string;
  blob: Blob;
}

export type FormData = Omit<PortfolioData, "attachments" | "industry"> & {
  industry: NonNullable<PortfolioData["industry"]>;
};

export interface Draft {
  templateId: TemplateId;
  data: FormData;
  savedAt?: string;
}

export const emptyForm = (): FormData => ({
  courseType: [],
  grades: [],
  operation: { type: "단독운영" },
  split: { yes: false },
  department: "",
  courseName: "",
  credits: "",
  dedicatedRoom: true,
  enrollment: "",
  purpose: "",
  strategies: {},
  applicant: { names: "", affiliation: "", email: "", phone: "" },
  consent: false,
  intro: { title: "", source: "", developedAt: "", revisedAt: "" },
  weeks: Array.from({ length: 6 }, () => ({ professor: "", student: "" })),
  industry: { company: "", expertName: "", expertPosition: "", expertEmail: "", roles: [], roleOther: "", details: "" },
  reflection: {},
});

// ---------- text draft: localStorage ----------

const DRAFT_KEY = "portfolio-draft-v1";

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return { ...d, data: { ...emptyForm(), ...d.data } };
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): boolean {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- attachments: IndexedDB (files are too big for localStorage) ----------

const DB = "portfolio-files";
const STORE = "attachments";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type Attachments = Record<AttachmentKey, AttachmentItem[]>;
export const emptyAttachments = (): Attachments => ({ worksheets: [], photos: [], outputs: [] });

export async function saveAttachments(a: Attachments): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(a, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

export async function loadAttachments(): Promise<Attachments> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get("current");
      req.onsuccess = () => resolve({ ...emptyAttachments(), ...(req.result ?? {}) });
      req.onerror = () => resolve(emptyAttachments());
    });
  } catch {
    return emptyAttachments();
  }
}
