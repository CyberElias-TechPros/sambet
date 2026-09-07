'use client';

import React from 'react';
import { Phone, Mail, MapPin, Landmark, FolderKanban, FileText, Copy, Check } from 'lucide-react';
import type { Organization } from '@/lib/types';
import { Badge } from '@/components/ui/primitives';
import { displayPhone, formatDate, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="w-32 shrink-0 pt-0.5 text-[12px] font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      <span className={`min-w-0 flex-1 text-right text-[13.5px] leading-relaxed text-ink ${mono ? 'tabular' : ''}`}>
        {value || <span className="text-ink-faint">—</span>}
      </span>
    </div>
  );
}

export function OrgDetail({
  org,
  onEdit,
  onDelete,
  onOpenDuplicate,
}: {
  org: Organization;
  onEdit: () => void;
  onDelete: () => void;
  onOpenDuplicate: (id: number) => void;
}) {
  const { toast } = useToast();
  const copy = (v: string, what: string) => {
    navigator.clipboard?.writeText(v).then(
      () => toast('info', `${what} copied.`),
      () => toast('error', 'Could not copy.'),
    );
  };
  const CopyBtn = ({ value, what }: { value: string; what: string }) => (
    <button
      onClick={() => copy(value, what)}
      className="ml-1.5 inline-flex align-middle text-ink-faint transition hover:text-leaf-700"
      title={`Copy ${what.toLowerCase()}`}
      aria-label={`Copy ${what.toLowerCase()}`}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {org.sn != null && <Badge tone="stone">S/N {org.sn}</Badge>}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[org.status] ?? ''}`}>
          {STATUS_LABELS[org.status] ?? org.status}
        </span>
        <Badge tone="sky">{org.project_category}</Badge>
        {org.cycle !== 'Project 1' && <Badge tone="stone">{org.cycle}</Badge>}
        {org.is_duplicate && <Badge tone="amber">Possible duplicate</Badge>}
        {org.missing.length > 0 && <Badge tone="rose">{org.missing.length} field{org.missing.length > 1 ? 's' : ''} missing</Badge>}
      </div>

      {org.missing.length > 0 && (
        <div className="rounded-xl bg-rose-50/70 p-3.5 ring-1 ring-inset ring-rose-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Incomplete record</p>
          <p className="mt-1 text-[13px] text-rose-800/80">
            Missing: {org.missing.join(', ')}. Edit the record to complete it.
          </p>
        </div>
      )}

      <div className="divide-y divide-stone-100">
        <Row label="Organization" value={org.name} />
        <Row label="Representative" value={org.ceo_name} />
        <Row
          label="Phone"
          value={
            org.phone && (
              <a href={`tel:${org.phone}`} className="inline-flex items-center gap-1.5 text-leaf-700 hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {displayPhone(org.phone)}
                <CopyBtn value={org.phone} what="Phone" />
              </a>
            )
          }
        />
        <Row
          label="E-mail"
          value={
            org.email && (
              <a href={`mailto:${org.email}`} className="inline-flex items-center gap-1.5 break-all text-leaf-700 hover:underline">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {org.email}
                <CopyBtn value={org.email} what="E-mail" />
              </a>
            )
          }
        />
        <Row
          label="Bank"
          value={
            org.bank && (
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" />
                {org.bank}
                {org.bank_norm && org.bank_norm !== org.bank && (
                  <span className="text-xs text-ink-faint">→ {org.bank_norm}</span>
                )}
              </span>
            )
          }
        />
        <Row label="Account no." value={org.account_number && <span className="tabular">{org.account_number}<CopyBtn value={org.account_number} what="Account number" /></span>} />
        <Row
          label="Location"
          value={
            (org.state || org.lga) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {org.lga || '—'}
                {org.state && <> · {org.state}</>
                }
                {org.state_norm && org.state_norm !== org.state && (
                  <span className="text-xs text-ink-faint">({org.state_norm})</span>
                )}
              </span>
            )
          }
        />
        <Row
          label="Project"
          value={
            org.project_type && (
              <span className="inline-flex items-start gap-1.5">
                <FolderKanban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {org.project_type}
              </span>
            )
          }
        />
        {org.notes && (
          <Row
            label="Notes"
            value={
              <span className="inline-flex items-start gap-1.5">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="text-left">{org.notes}</span>
              </span>
            }
          />
        )}
      </div>

      {(org.duplicates?.length ?? 0) > 0 && (
        <div className="rounded-xl bg-amber-50/70 p-4 ring-1 ring-inset ring-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Possible duplicates</p>
          <ul className="mt-2 space-y-1">
            {org.duplicates!.map((d) => (
              <li key={d.id}>
                <button onClick={() => onOpenDuplicate(d.id)} className="text-[13px] text-amber-800 underline-offset-2 hover:underline">
                  {d.sn != null ? `#${d.sn} · ` : ''}{d.name}
                  {d.lga ? ` (${d.lga})` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 pt-4 text-[11.5px] text-ink-faint">
        <span>
          Added {formatDate(org.created_at)} · Updated {formatDate(org.updated_at)} · via {org.source}
        </span>
        <span className="tabular">ID {org.id}</span>
      </div>
    </div>
  );
}
