"use client";
import { cloneElement, useId, useState, type FormEvent, type ReactElement } from "react";
import { ApiClientError } from "@/lib/api";
import { LIMITS, PRIORITY_LABEL, STATUS_LABEL, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/constants";
import type { ProjectInput, Ticket, TicketInput } from "@/lib/types";
import { btnPrimary, btnSecondary, inputCls } from "./ui/states";

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement<Record<string, unknown>> }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined })}
      {error && <span id={errorId} role="alert" className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}

type Errors = Record<string, string>;
function toErrors(e: unknown): { fields: Errors; form?: string } {
  if (e instanceof ApiClientError) return { fields: e.fields ?? {}, form: e.fields ? undefined : e.message };
  return { fields: {}, form: "Something went wrong. Please try again." };
}

export function ProjectForm({ onSubmit, onCancel }: { onSubmit: (v: ProjectInput) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState<ProjectInput>({ name: "", description: "", githubRepo: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return; // guards double-submit (Enter key + click)
    const local: Errors = {};
    if (!v.name.trim()) local.name = "Name is required";
    if (!v.description.trim()) local.description = "Description is required";
    setErrors(local);
    setFormError(undefined);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await onSubmit(v);
    } catch (err) {
      const r = toErrors(err);
      setErrors(r.fields);
      setFormError(r.form);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Name" error={errors.name}>
        <input className={inputCls} value={v.name} maxLength={LIMITS.projectName + 50} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
      </Field>
      <Field label="Description" error={errors.description}>
        <textarea className={inputCls} rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      <Field label="GitHub repository (optional)" error={errors.githubRepo}>
        <input className={inputCls} placeholder="owner/repo or https://github.com/owner/repo" value={v.githubRepo} onChange={(e) => setV({ ...v, githubRepo: e.target.value })} />
      </Field>
      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className={btnPrimary} disabled={saving}>{saving ? "Creating…" : "Create project"}</button>
      </div>
    </form>
  );
}

export function TicketForm({
  initial, submitLabel, onSubmit, onCancel,
}: {
  initial?: Ticket;
  submitLabel: string;
  onSubmit: (v: TicketInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState<TicketInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "TODO",
    priority: initial?.priority ?? "MEDIUM",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const local: Errors = {};
    if (!v.title.trim()) local.title = "Title is required";
    setErrors(local);
    setFormError(undefined);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await onSubmit(v);
    } catch (err) {
      const r = toErrors(err);
      setErrors(r.fields);
      setFormError(r.form);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Title" error={errors.title}>
        <input className={inputCls} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus />
      </Field>
      <Field label="Description" error={errors.description}>
        <textarea className={inputCls} rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" error={errors.status}>
          <select className={inputCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as TicketInput["status"] })}>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Priority" error={errors.priority}>
          <select className={inputCls} value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as TicketInput["priority"] })}>
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </Field>
      </div>
      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className={btnPrimary} disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
