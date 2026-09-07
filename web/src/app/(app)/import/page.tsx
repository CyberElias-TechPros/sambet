'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  Download,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { ImportPreview, ImportRecord } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Skeleton } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/primitives';
import { useToast } from '@/hooks/use-toast';
import { downloadUrl, formatDateTime, formatNumber } from '@/lib/format';

type Stage = { kind: 'idle' } | { kind: 'parsing' } | { kind: 'review'; preview: ImportPreview } | { kind: 'executing' } | { kind: 'done'; preview: ImportPreview; created: number; updated: number; skipped: number };

function StepDots({ step }: { step: number }) {
  const labels = ['Upload', 'Review', 'Done'];
  return (
    <ol className="flex items-center gap-2">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              i + 1 < step
                ? 'bg-leaf-600 text-white'
                : i + 1 === step
                  ? 'bg-leaf-50 text-leaf-800 ring-2 ring-leaf-600'
                  : 'bg-stone-100 text-ink-faint'
            }`}
          >
            {i + 1 < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={`text-xs font-medium ${i + 1 === step ? 'text-ink' : 'text-ink-faint'}`}>{l}</span>
          {i < labels.length - 1 && <span className="h-px w-8 bg-stone-200" />}
        </li>
      ))}
    </ol>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'green' | 'sky' | 'stone' | 'rose' }) {
  const tones = {
    green: 'text-leaf-700',
    sky: 'text-sky-700',
    stone: 'text-stone-500',
    rose: 'text-rose-600',
  };
  return (
    <div className="rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-inset ring-stone-100">
      <p className={`text-[26px] font-bold leading-none tabular ${tones[tone]}`}>{formatNumber(value)}</p>
      <p className="mt-1.5 text-xs font-medium text-ink-soft">{label}</p>
    </div>
  );
}

export default function ImportPage() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [strategy, setStrategy] = useState<'update' | 'skip'>('update');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = () => {
    api.listImports(1).then((r) => setHistory(r.data)).catch(() => {});
  };
  useEffect(loadHistory, []);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStage({ kind: 'parsing' });
    try {
      const { data } = await api.previewImport(file, strategy);
      setStage({ kind: 'review', preview: data });
    } catch (e) {
      setStage({ kind: 'idle' });
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  }

  async function execute() {
    if (stage.kind !== 'review') return;
    setStage({ kind: 'executing' });
    try {
      const { data } = await api.executeImport(stage.preview.uploadId, strategy);
      setStage({ kind: 'done', preview: stage.preview, created: data.created, updated: data.updated, skipped: data.skipped });
      loadHistory();
    } catch (e) {
      setStage({ kind: 'review', preview: stage.preview });
      toast('error', e instanceof Error ? e.message : 'Import failed.');
    }
  }

  function reset() {
    setStage({ kind: 'idle' });
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const step = stage.kind === 'idle' || stage.kind === 'parsing' ? 1 : stage.kind === 'done' ? 3 : 2;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Import</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Bring in a workbook (.xlsx, .xls or .csv) the same shape as your current registry — we map the columns, validate every
          row, and let you review before anything is saved.
        </p>
      </div>

      <Card className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <StepDots step={step} />
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-ink-soft">When a row matches an existing organization:</span>
            <Segmented
              value={strategy}
              onChange={(v) => setStrategy(v)}
              options={[
                { value: 'update', label: 'Update it' },
                { value: 'skip', label: 'Skip it' },
              ]}
            />
          </div>
        </div>

        {/* Step 1: upload */}
        {(stage.kind === 'idle' || stage.kind === 'parsing') && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
                dragOver ? 'border-leaf-500 bg-leaf-50/60' : 'border-stone-300 bg-stone-50/50 hover:border-leaf-400 hover:bg-leaf-50/30'
              }`}
            >
              {stage.kind === 'parsing' ? (
                <>
                  <Loader2 className="mb-4 h-10 w-10 animate-spin text-leaf-600" />
                  <p className="text-[15px] font-medium text-ink">Reading {fileName}…</p>
                  <p className="mt-1 text-[13px] text-ink-soft">Validating rows and matching against existing records.</p>
                </>
              ) : (
                <>
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
                    <UploadCloud className="h-7 w-7" />
                  </span>
                  <p className="text-[15px] font-medium text-ink">
                    Drag your workbook here, or{' '}
                    <button onClick={() => inputRef.current?.click()} className="font-semibold text-leaf-700 underline-offset-2 hover:underline">
                      browse files
                    </button>
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">.xlsx, .xls or .csv · up to 10 MB · headers like “NAME OF ORGANIZATION”, “PHONE NUMBER”, “BANK”…</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
              <p className="text-xs text-ink-faint">Not sure about the format? Grab a template to copy from.</p>
              <Button variant="outline" size="sm" onClick={() => downloadUrl(api.templateUrl())}>
                <Download className="h-3.5 w-3.5" /> Download template
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: review */}
        {stage.kind === 'review' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-9 w-9 shrink-0 rounded-lg bg-leaf-50 p-1.5 text-leaf-700 ring-1 ring-leaf-100" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{stage.preview.filename}</p>
                <p className="text-xs text-ink-soft">
                  {formatNumber(stage.preview.total)} data rows found
                  {stage.preview.unmappedHeaders.length > 0 && ` · ${stage.preview.unmappedHeaders.length} column(s) ignored`}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" /> Choose another file
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Will be added" value={stage.preview.create} tone="green" />
              <SummaryCard label={`Will be ${strategy === 'update' ? 'updated' : 'skipped'}`} value={strategy === 'update' ? stage.preview.update : stage.preview.skip} tone={strategy === 'update' ? 'sky' : 'stone'} />
              <SummaryCard label="Rows with warnings" value={stage.preview.warningTotal} tone="stone" />
              <SummaryCard label="Rows with errors" value={stage.preview.errorTotal} tone="rose" />
            </div>

            {stage.preview.errorTotal > 0 && (
              <div>
                <h4 className="mb-2 text-[13px] font-semibold text-ink">
                  Errors <span className="font-normal text-ink-faint">— these rows will be skipped</span>
                </h4>
                <div className="max-h-56 overflow-y-auto rounded-xl ring-1 ring-inset ring-stone-200">
                  <table className="w-full text-left text-[13px]">
                    <thead className="sticky top-0 bg-stone-50 text-[11px] uppercase tracking-wide text-ink-faint">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {stage.preview.errors.map((e) => (
                        <tr key={`${e.excelRow}-${e.reason}`}>
                          <td className="px-3 py-2 tabular-nums text-ink-faint">{e.excelRow}</td>
                          <td className="px-3 py-2 text-rose-700">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stage.preview.warningTotal > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-[13px] font-semibold text-ink">
                  Warnings <span className="font-normal text-ink-faint">— rows will still be imported ({stage.preview.warningTotal})</span>
                </summary>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl ring-1 ring-inset ring-stone-200">
                  <table className="w-full text-left text-[13px]">
                    <tbody className="divide-y divide-stone-100">
                      {stage.preview.warnings.map((w, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 tabular-nums text-ink-faint">{w.excelRow}</td>
                          <td className="px-3 py-2 text-amber-700">{w.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Back
              </Button>
              <Button onClick={execute} disabled={stage.preview.create + (strategy === 'update' ? stage.preview.update : 0) === 0}>
                Import {stage.preview.create + (strategy === 'update' ? stage.preview.update : 0)} rows <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {stage.kind === 'executing' && (
          <div className="flex flex-col items-center py-14">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-leaf-600" />
            <p className="text-[15px] font-medium text-ink">Importing…</p>
            <p className="mt-1 text-[13px] text-ink-soft">Saving rows and archiving the original file.</p>
          </div>
        )}

        {/* Step 3: done */}
        {stage.kind === 'done' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center py-6 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-leaf-50 ring-8 ring-leaf-50/50">
                <CheckCircle2 className="h-8 w-8 text-leaf-600" />
              </span>
              <h3 className="font-display text-xl font-semibold text-ink">Import complete</h3>
              <p className="mt-1 text-sm text-ink-soft">{stage.preview.filename}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Added" value={stage.created} tone="green" />
              <SummaryCard label="Updated" value={stage.updated} tone="sky" />
              <SummaryCard label="Skipped" value={stage.skipped} tone="stone" />
              <SummaryCard label="Errors" value={stage.preview.errorTotal} tone="rose" />
            </div>
            <div className="flex justify-center gap-2 border-t border-stone-100 pt-4">
              <Button variant="outline" onClick={reset}>
                <UploadCloud className="h-4 w-4" /> Import another file
              </Button>
              <Button
                onClick={() => {
                  window.location.href = '/organizations';
                }}
              >
                View registry
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* History */}
      <Card>
        <CardHeader title="Import history" subtitle="Every import is archived and logged." />
        {history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-faint">No imports yet — your first one will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-stone-100 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  <th className="px-5 py-2.5">File</th>
                  <th className="px-3 py-2.5">Result</th>
                  <th className="px-3 py-2.5">By</th>
                  <th className="px-3 py-2.5 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((i) => (
                  <tr key={i.id}>
                    <td className="max-w-[280px] truncate px-5 py-3 text-[13px] font-medium text-ink">{i.filename}</td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1.5">
                        {i.created_count > 0 && <Badge tone="green">+{i.created_count}</Badge>}
                        {i.updated_count > 0 && <Badge tone="sky">{i.updated_count} updated</Badge>}
                        {i.skipped_count > 0 && <Badge tone="stone">{i.skipped_count} skipped</Badge>}
                        {i.error_count > 0 && <Badge tone="rose">{i.error_count} errors</Badge>}
                        {i.status !== 'completed' && <Badge tone="amber">{i.status}</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-ink-soft">{i.actor_email ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-xs text-ink-faint">{formatDateTime(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
