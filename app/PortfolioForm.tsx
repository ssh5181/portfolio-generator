"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TEMPLATES,
  STRATEGY_KEYS,
  fillPortfolio,
  type AttachmentKey,
  type StrategyKey,
  type TemplateId,
  type ReflectionKey,
} from "../lib/templates";
import {
  emptyAttachments,
  emptyForm,
  loadAttachments,
  loadDraft,
  saveAttachments,
  saveDraft,
  clearDraft,
  type Attachments,
  type FormData,
} from "../lib/form/state";

const STRATEGY_GROUPS: { area: string; keys: StrategyKey[] }[] = [
  { area: "수업 운영", keys: ["orientation", "teamwork", "motivation"] },
  { area: "수업 방법", keys: ["contentDelivery", "performance", "media"] },
  { area: "수업 정리", keys: ["activityEval", "achievementEval", "transfer"] },
];

const ROLE_OPTIONS = ["문제제공", "평가/심사/피드백/자문/멘토링", "수업/특강", "현장견학안내", "기타"];

/** "2026-03-02" -> "2026. 3. 2." */
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[1]}. ${+m[2]}. ${+m[3]}.` : iso;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function PortfolioForm() {
  const [templateId, setTemplateId] = useState<TemplateId>("PBL");
  const [data, setData] = useState<FormData>(emptyForm);
  const [files, setFiles] = useState<Attachments>(emptyAttachments);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cfg = TEMPLATES[templateId];

  // restore draft once
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setTemplateId(d.templateId);
      setData(d.data);
      setSavedAt(d.savedAt ?? null);
    }
    loadAttachments().then((a) => {
      setFiles(a);
      setLoaded(true);
    });
  }, []);

  // autosave text (debounced)
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      const at = new Date().toISOString();
      if (saveDraft({ templateId, data, savedAt: at })) setSavedAt(at);
    }, 600);
    return () => clearTimeout(t);
  }, [templateId, data, loaded]);

  useEffect(() => {
    if (loaded) saveAttachments(files);
  }, [files, loaded]);

  const up = <K extends keyof FormData>(key: K, value: FormData[K]) => setData((d) => ({ ...d, [key]: value }));
  const upIn = <K extends "applicant" | "intro" | "industry" | "strategies" | "reflection">(
    key: K,
    patch: Partial<FormData[K]>,
  ) => setData((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const reset = async () => {
    if (!window.confirm("작성 중인 내용을 모두 지우고 새로 시작할까요?")) return;
    clearDraft();
    setData(emptyForm());
    setFiles(emptyAttachments());
    setSavedAt(null);
  };

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const tpl = await fetch(`/templates/${cfg.file}`).then((r) => {
        if (!r.ok) throw new Error("서식 파일을 불러오지 못했습니다.");
        return r.arrayBuffer();
      });
      const attachments: Partial<Record<AttachmentKey, { data: Uint8Array; ext: string }[]>> = {};
      for (const k of Object.keys(cfg.attachments) as AttachmentKey[]) {
        attachments[k] = await Promise.all(
          files[k].map(async (f) => ({
            data: new Uint8Array(await f.blob.arrayBuffer()),
            ext: f.type.split("/")[1] ?? "png",
          })),
        );
      }
      const bytes = await fillPortfolio(tpl, cfg, {
        ...data,
        intro: { ...data.intro, developedAt: fmtDate(data.intro.developedAt), revisedAt: fmtDate(data.intro.revisedAt) },
        weeks: data.weeks,
        attachments,
        industry: cfg.industry ? data.industry : undefined,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/hwp+zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const name = data.courseName.trim() || "결과포트폴리오";
      a.download = `${name}_학습자중심수업 결과 포트폴리오(${cfg.id}).hwpx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <h1>학습자중심수업 결과 포트폴리오</h1>
            <p className="muted small">
              {savedAt ? `이 브라우저에 자동 저장됨 · ${new Date(savedAt).toLocaleTimeString("ko-KR")}` : "작성 내용은 이 브라우저에 자동 저장됩니다"}
            </p>
          </div>
          <div className="actions">
            <button className="btn ghost" onClick={reset}>
              새로 작성
            </button>
            <button className="btn primary" onClick={download} disabled={busy}>
              {busy ? "만드는 중…" : "한글(hwpx) 내려받기"}
            </button>
          </div>
        </div>
        <nav className="tabs">
          <a href="#s0">서식 선택</a>
          <a href="#s1">Ⅰ. 수업운영</a>
          <a href="#s2">Ⅱ. 수업결과물</a>
          <a href="#s3">Ⅲ. 수업성찰</a>
        </nav>
      </header>

      {error && <div className="alert">내려받기 실패: {error}</div>}

      <main className="content">
        <section id="s0" className="card">
          <h2>서식 선택</h2>
          <div className="template-grid">
            {Object.values(TEMPLATES).map((t) => (
              <button
                key={t.id}
                className={`template ${t.id === templateId ? "selected" : ""}`}
                onClick={() => setTemplateId(t.id)}
              >
                <strong>{t.id}</strong>
                <span>{t.title.replace(/^.*?\(/, "").replace(/\)$/, "")}</span>
              </button>
            ))}
          </div>
        </section>

        <section id="s1" className="card">
          <h2>Ⅰ. 수업운영</h2>

          <div className="grid2">
            <Field label="교과유형">
              <Checks
                options={["전공필수", "전공선택", "교양"]}
                value={data.courseType}
                onToggle={(v) => up("courseType", toggle(data.courseType, v as never))}
              />
            </Field>
            <Field label="수강학년">
              <Checks
                options={["1학년", "2학년", "3학년", "4학년"]}
                value={data.grades}
                onToggle={(v) => up("grades", toggle(data.grades, v as never))}
              />
            </Field>
            <Field label="운영형태">
              <div className="row">
                <Radios
                  options={["단독운영", "코티칭", "팀티칭"]}
                  value={data.operation.type}
                  onChange={(v) => up("operation", { ...data.operation, type: v as FormData["operation"]["type"] })}
                />
                {data.operation.type !== "단독운영" && (
                  <label className="inline">
                    <input
                      type="number"
                      min={2}
                      className="num"
                      value={data.operation.count ?? ""}
                      onChange={(e) => up("operation", { ...data.operation, count: +e.target.value || undefined })}
                    />
                    명
                  </label>
                )}
              </div>
            </Field>
            <Field label="분반여부">
              <div className="row">
                <Radios
                  options={["예", "아니오"]}
                  value={data.split.yes ? "예" : "아니오"}
                  onChange={(v) => up("split", { ...data.split, yes: v === "예" })}
                />
                {data.split.yes && (
                  <label className="inline">
                    <input
                      type="number"
                      min={2}
                      className="num"
                      value={data.split.count ?? ""}
                      onChange={(e) => up("split", { ...data.split, count: +e.target.value || undefined })}
                    />
                    개 분반
                  </label>
                )}
              </div>
            </Field>
            <Field label="개설학과(부)(전공)">
              <input value={data.department} onChange={(e) => up("department", e.target.value)} />
            </Field>
            <Field label="교과목명">
              <input value={data.courseName} onChange={(e) => up("courseName", e.target.value)} />
            </Field>
            <Field label="학점-강의-실습" hint="예: 3-2-2">
              <input value={data.credits} placeholder="3-3-0" onChange={(e) => up("credits", e.target.value)} />
            </Field>
            <Field label="수강규모">
              <label className="inline">
                <input
                  type="number"
                  min={1}
                  className="num"
                  value={data.enrollment}
                  onChange={(e) => up("enrollment", e.target.value)}
                />
                명
              </label>
            </Field>
            <Field label="전용강의실 사용">
              <Radios
                options={["예", "아니오"]}
                value={data.dedicatedRoom ? "예" : "아니오"}
                onChange={(v) => up("dedicatedRoom", v === "예")}
              />
            </Field>
            <Field label="구분">
              <span className="badge">{cfg.id}</span>
            </Field>
          </div>

          <LongField
            label="수업목적"
            hint="학습자중심수업의 수업목적"
            value={data.purpose}
            onChange={(v) => up("purpose", v)}
          />

          <h3>수업 운영 및 평가 전략</h3>
          {STRATEGY_GROUPS.map((g) => (
            <div key={g.area} className="group">
              <div className="group-title">{g.area}</div>
              {g.keys.map((k) => (
                <LongField
                  key={k}
                  label={cfg.strategyLabels[k]}
                  rows={2}
                  value={data.strategies[k] ?? ""}
                  onChange={(v) => upIn("strategies", { [k]: v })}
                />
              ))}
            </div>
          ))}

          <h3>신청자 정보</h3>
          <div className="grid2">
            <Field label="성명" hint="교수자가 여러 명이면 모두 기재">
              <input value={data.applicant.names} onChange={(e) => upIn("applicant", { names: e.target.value })} />
            </Field>
            <Field label="소속">
              <input
                value={data.applicant.affiliation}
                onChange={(e) => upIn("applicant", { affiliation: e.target.value })}
              />
            </Field>
            <Field label="e-mail">
              <input
                type="email"
                value={data.applicant.email}
                onChange={(e) => upIn("applicant", { email: e.target.value })}
              />
            </Field>
            <Field label="Tel">
              <input value={data.applicant.phone} onChange={(e) => upIn("applicant", { phone: e.target.value })} />
            </Field>
          </div>
          <label className="consent">
            <input type="checkbox" checked={data.consent} onChange={(e) => up("consent", e.target.checked)} />
            개인정보수집활용에 동의합니다 (필수)
          </label>
        </section>

        <section id="s2" className="card">
          <h2>Ⅱ. 수업결과물</h2>

          <h3>{cfg.intro.heading}</h3>
          <div className="grid2">
            <Field label={cfg.intro.title}>
              <input value={data.intro.title} onChange={(e) => upIn("intro", { title: e.target.value })} />
            </Field>
            <Field label={cfg.intro.source}>
              <input value={data.intro.source} onChange={(e) => upIn("intro", { source: e.target.value })} />
            </Field>
            <Field label={cfg.intro.developedAt}>
              <input
                type="date"
                value={data.intro.developedAt}
                onChange={(e) => upIn("intro", { developedAt: e.target.value })}
              />
            </Field>
            <Field label="수정일자">
              <input
                type="date"
                value={data.intro.revisedAt}
                onChange={(e) => upIn("intro", { revisedAt: e.target.value })}
              />
            </Field>
          </div>

          <h3>2. 주차별 세부 활동</h3>
          <p className="muted small">{cfg.weeksHint}을 주차별로 적어주세요.</p>
          <div className="weeks">
            <div className="weeks-head">
              <span>주차</span>
              <span>교수자</span>
              <span>학습자</span>
              <span />
            </div>
            {data.weeks.map((w, i) => (
              <div key={i} className="weeks-row">
                <span className="week-no">{i + 1}</span>
                <textarea
                  rows={2}
                  aria-label={`${i + 1}주차 교수자`}
                  value={w.professor}
                  onChange={(e) =>
                    up(
                      "weeks",
                      data.weeks.map((x, j) => (j === i ? { ...x, professor: e.target.value } : x)),
                    )
                  }
                />
                <textarea
                  rows={2}
                  aria-label={`${i + 1}주차 학습자`}
                  value={w.student}
                  onChange={(e) =>
                    up(
                      "weeks",
                      data.weeks.map((x, j) => (j === i ? { ...x, student: e.target.value } : x)),
                    )
                  }
                />
                <button
                  className="icon"
                  title="이 주차 삭제"
                  onClick={() => up("weeks", data.weeks.filter((_, j) => j !== i))}
                  disabled={data.weeks.length <= 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button className="btn ghost small" onClick={() => up("weeks", [...data.weeks, { professor: "", student: "" }])}>
              + 주차 추가
            </button>
          </div>

          {(Object.keys(cfg.attachments) as AttachmentKey[]).map((k, i) => (
            <AttachmentBox
              key={k}
              title={`${i + 3}. ${cfg.attachments[k]!.label} 첨부`}
              hint={cfg.attachments[k]!.hint}
              items={files[k]}
              onChange={(items) => setFiles((f) => ({ ...f, [k]: items }))}
            />
          ))}

          {cfg.industry && (
            <>
              <h3>{Object.keys(cfg.attachments).length + 3}. 현장연계 사항</h3>
              <div className="grid2">
                <Field label="현장명(기업/기관명)">
                  <input value={data.industry.company} onChange={(e) => upIn("industry", { company: e.target.value })} />
                </Field>
                <Field label="현장 전문가 성명">
                  <input
                    value={data.industry.expertName}
                    onChange={(e) => upIn("industry", { expertName: e.target.value })}
                  />
                </Field>
                <Field label="직급/업무분야">
                  <input
                    value={data.industry.expertPosition}
                    onChange={(e) => upIn("industry", { expertPosition: e.target.value })}
                  />
                </Field>
                <Field label="이메일 주소">
                  <input
                    type="email"
                    value={data.industry.expertEmail}
                    onChange={(e) => upIn("industry", { expertEmail: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="현장전문가 참여 역할">
                <div className="row">
                  <Checks
                    options={ROLE_OPTIONS}
                    value={data.industry.roles}
                    onToggle={(v) => upIn("industry", { roles: toggle(data.industry.roles, v) })}
                  />
                  {data.industry.roles.includes("기타") && (
                    <input
                      className="short"
                      placeholder="기타 역할"
                      value={data.industry.roleOther ?? ""}
                      onChange={(e) => upIn("industry", { roleOther: e.target.value })}
                    />
                  )}
                </div>
              </Field>
              <LongField
                label="현장연계 사항"
                hint="현장 전문가 참여 역할 및 현장연계에 대한 주요 사항"
                value={data.industry.details}
                onChange={(v) => upIn("industry", { details: v })}
              />
            </>
          )}
        </section>

        <section id="s3" className="card">
          <h2>Ⅲ. 수업성찰</h2>
          <p className="muted small">교과목 전체가 아니라 본 학습자중심수업에 대해 적어주세요.</p>
          {(Object.entries(cfg.reflectionLabels) as [ReflectionKey, string][]).map(([k, label]) => (
            <LongField
              key={k}
              label={label}
              rows={4}
              value={data.reflection[k] ?? ""}
              onChange={(v) => upIn("reflection", { [k]: v })}
            />
          ))}
        </section>

        <div className="bottom-actions">
          <button className="btn primary" onClick={download} disabled={busy}>
            {busy ? "만드는 중…" : "한글(hwpx) 내려받기"}
          </button>
        </div>
      </main>
    </div>
  );
}

// ---------- small components ----------

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="label">
        {label}
        {hint && <span className="hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function LongField(props: { label: string; hint?: string; value: string; rows?: number; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <div className="label">
        {props.label}
        {props.hint && <span className="hint">{props.hint}</span>}
      </div>
      <textarea rows={props.rows ?? 3} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

function Checks(props: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="choices">
      {props.options.map((o) => (
        <label key={o} className={`choice ${props.value.includes(o) ? "on" : ""}`}>
          <input type="checkbox" checked={props.value.includes(o)} onChange={() => props.onToggle(o)} />
          {o}
        </label>
      ))}
    </div>
  );
}

function Radios(props: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="choices">
      {props.options.map((o) => (
        <label key={o} className={`choice ${props.value === o ? "on" : ""}`}>
          <input type="radio" checked={props.value === o} onChange={() => props.onChange(o)} />
          {o}
        </label>
      ))}
    </div>
  );
}

function AttachmentBox(props: {
  title: string;
  hint: string;
  items: Attachments[AttachmentKey];
  onChange: (items: Attachments[AttachmentKey]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const urls = useMemo(() => props.items.map((i) => URL.createObjectURL(i.blob)), [props.items]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => /^image\/(png|jpeg|gif|bmp)$/.test(f.type));
    const skipped = list.length - imgs.length;
    if (skipped) window.alert(`이미지(png, jpg)만 넣을 수 있어요. PDF는 다음 단계에서 지원됩니다. (${skipped}개 제외)`);
    props.onChange([
      ...props.items,
      ...imgs.map((f) => ({ id: crypto.randomUUID(), name: f.name, type: f.type, blob: f as Blob })),
    ]);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...props.items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    props.onChange(next);
  };

  return (
    <div className="attach">
      <h3>{props.title}</h3>
      <p className="muted small">{props.hint}</p>
      <div
        className={`drop ${drag ? "drag" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
      >
        파일을 끌어다 놓거나 눌러서 선택하세요 (png, jpg)
        <input ref={input} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
      {props.items.length > 0 && (
        <ul className="thumbs">
          {props.items.map((it, i) => (
            <li key={it.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[i]} alt={it.name} />
              <span className="thumb-name" title={it.name}>
                {it.name}
              </span>
              <div className="thumb-actions">
                <button className="icon" title="앞으로" onClick={() => move(i, -1)} disabled={i === 0}>
                  ‹
                </button>
                <button className="icon" title="뒤로" onClick={() => move(i, 1)} disabled={i === props.items.length - 1}>
                  ›
                </button>
                <button className="icon" title="삭제" onClick={() => props.onChange(props.items.filter((x) => x.id !== it.id))}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
