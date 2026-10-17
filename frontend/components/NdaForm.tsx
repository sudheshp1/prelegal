"use client";

import { useId, useState } from "react";
import type { NdaData, Party } from "@/lib/nda";

type Props = {
  data: NdaData;
  onChange: (data: NdaData) => void;
};

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClass = "text-sm font-medium text-slate-700";
const hintClass = "text-xs text-slate-500";

type TextFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  rows?: number; // renders a textarea when set
  placeholder?: string;
};

function TextField({ label, hint, value, onChange, type = "text", rows, placeholder }: TextFieldProps) {
  const id = useId();
  const inputProps = {
    id,
    value,
    placeholder,
    className: inputClass,
    "aria-describedby": hint ? `${id}-hint` : undefined,
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {rows ? (
        <textarea rows={rows} onChange={(e) => onChange(e.target.value)} {...inputProps} />
      ) : (
        <input type={type} onChange={(e) => onChange(e.target.value)} {...inputProps} />
      )}
      {hint && (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      )}
    </div>
  );
}

const MIN_YEARS = 1;
const MAX_YEARS = 99;

/** Keeps the raw text while typing so the field can be cleared; commits a clamped whole number. */
function YearsInput({ label, value, disabled, onChange }: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (years: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const years = Math.min(MAX_YEARS, Math.max(MIN_YEARS, Math.round(Number(draft)) || MIN_YEARS));
    setDraft(String(years));
    onChange(years);
  };

  return (
    <input
      type="number"
      min={MIN_YEARS}
      max={MAX_YEARS}
      step={1}
      value={draft}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => {
        setDraft(e.target.value);
        const years = Number(e.target.value);
        if (Number.isInteger(years) && years >= MIN_YEARS && years <= MAX_YEARS) onChange(years);
      }}
      onBlur={commit}
      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

/** A radio group choosing between a term measured in years and an open-ended alternative. */
function TermChoice({ legend, hint, name, isYears, years, yearsPrefix, yearsLabel, otherLabel, onSelect, onYearsChange }: {
  legend: string;
  hint: string;
  name: string;
  isYears: boolean;
  years: number;
  yearsPrefix?: string;
  yearsLabel: string;
  otherLabel: string;
  onSelect: (isYears: boolean) => void;
  onYearsChange: (years: number) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className={labelClass}>{legend}</legend>
      <p className={hintClass}>{hint}</p>
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="radio" name={name} checked={isYears} onChange={() => onSelect(true)} />
          {yearsPrefix ?? "Fixed term"}
        </label>
        <YearsInput label={yearsLabel} value={years} disabled={!isYears} onChange={onYearsChange} />
        <span>year(s) from Effective Date</span>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="radio" name={name} checked={!isYears} onChange={() => onSelect(false)} />
        {otherLabel}
      </label>
    </fieldset>
  );
}

const PARTY_FIELDS: { key: keyof Party; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "name", label: "Signatory name" },
  { key: "title", label: "Title" },
  { key: "noticeAddress", label: "Notice address (email or postal)" },
];

export default function NdaForm({ data, onChange }: Props) {
  const set = <K extends keyof NdaData>(key: K, value: NdaData[K]) => onChange({ ...data, [key]: value });

  const setParty = (index: 0 | 1, key: keyof Party, value: string) => {
    const parties: [Party, Party] = [...data.parties];
    parties[index] = { ...parties[index], [key]: value };
    set("parties", parties);
  };

  return (
    <form aria-label="Mutual NDA details" className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold text-slate-900">Agreement terms</legend>

        <TextField
          label="Purpose"
          hint="How Confidential Information may be used."
          rows={3}
          value={data.purpose}
          onChange={(v) => set("purpose", v)}
        />
        <TextField
          label="Effective Date"
          type="date"
          value={data.effectiveDate}
          onChange={(v) => set("effectiveDate", v)}
        />
        <TermChoice
          legend="MNDA Term"
          hint="The length of this MNDA."
          name="mndaTerm"
          isYears={data.mndaTermType === "expires"}
          years={data.mndaTermYears}
          yearsPrefix="Expires"
          yearsLabel="MNDA term in years"
          otherLabel="Continues until terminated"
          onSelect={(isYears) => set("mndaTermType", isYears ? "expires" : "untilTerminated")}
          onYearsChange={(n) => set("mndaTermYears", n)}
        />
        <TermChoice
          legend="Term of Confidentiality"
          hint="How long Confidential Information is protected."
          name="confidentialityTerm"
          isYears={data.confidentialityTermType === "years"}
          years={data.confidentialityTermYears}
          yearsLabel="Confidentiality term in years"
          otherLabel="In perpetuity"
          onSelect={(isYears) => set("confidentialityTermType", isYears ? "years" : "perpetual")}
          onYearsChange={(n) => set("confidentialityTermYears", n)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Governing Law (state)"
            placeholder="Delaware"
            value={data.governingLaw}
            onChange={(v) => set("governingLaw", v)}
          />
          <TextField
            label="Jurisdiction"
            placeholder="New Castle, DE"
            value={data.jurisdiction}
            onChange={(v) => set("jurisdiction", v)}
          />
        </div>
        <TextField
          label="MNDA Modifications (optional)"
          rows={2}
          value={data.modifications}
          onChange={(v) => set("modifications", v)}
        />
      </fieldset>

      {([0, 1] as const).map((index) => (
        <fieldset key={index} className="space-y-4">
          <legend className="mb-2 text-lg font-semibold text-slate-900">Party {index + 1}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {PARTY_FIELDS.map(({ key, label }) => (
              <TextField
                key={key}
                label={label}
                value={data.parties[index][key]}
                onChange={(v) => setParty(index, key, v)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </form>
  );
}
