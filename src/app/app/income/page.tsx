"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/FormDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  incomeSourceSchema,
  type IncomeSourceInput,
} from "@/lib/validations/financial";

type HouseholdMember = {
  id: string;
  firstName: string;
  lastName: string;
};

type IncomeSource = {
  id: string;
  householdMemberId: string;
  type: string;
  label: string;
  amount: string;
  frequency: string;
  taxable: boolean;
  isActive: boolean;
  householdMember: HouseholdMember;
};

const INCOME_TYPES = [
  "SALARY",
  "BONUS",
  "PENSION",
  "RENTAL",
  "BUSINESS",
  "PART_TIME",
  "OTHER",
];
const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function annualize(amount: number, freq: string) {
  const m: Record<string, number> = {
    WEEKLY: 52,
    BIWEEKLY: 26,
    MONTHLY: 12,
    QUARTERLY: 4,
    ANNUALLY: 1,
  };
  return amount * (m[freq] ?? 1);
}

export default function IncomePage() {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    const res = await fetch("/api/income");
    const data = await res.json();
    setSources(data.sources || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSources();
    fetch("/api/household/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []));
  }, [fetchSources]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncomeSourceInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(incomeSourceSchema) as any,
    defaultValues: { taxable: true, isActive: true },
  });

  const openAdd = () => {
    setEditing(null);
    reset({ taxable: true, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (s: IncomeSource) => {
    setEditing(s);
    reset({
      type: s.type as IncomeSourceInput["type"],
      label: s.label,
      amount: s.amount,
      frequency: s.frequency as IncomeSourceInput["frequency"],
      taxable: s.taxable,
      isActive: s.isActive,
      householdMemberId: s.householdMemberId,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: IncomeSourceInput) => {
    setError(null);
    const url = editing ? `/api/income/${editing.id}` : "/api/income";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || "Failed to save");
      return;
    }
    setDialogOpen(false);
    fetchSources();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Archive this income source?")) return;
    await fetch(`/api/income/${id}`, { method: "DELETE" });
    fetchSources();
  };

  const totalAnnual = sources.reduce(
    (s, src) => s + annualize(Number(src.amount), src.frequency),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Income Sources</h1>
          <p className="text-slate-500 mt-1">
            Total annual income: <strong>{fmt(totalAnnual)}</strong>
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Income</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 mb-4">No income sources yet.</p>
          <Button onClick={openAdd}>Add your first income source</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Label
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Member
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Amount
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Frequency
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Annual
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{s.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.householdMember?.firstName} {s.householdMember?.lastName}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {fmt(Number(s.amount))}
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">
                    {s.frequency.toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(annualize(Number(s.amount), s.frequency))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(s)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(s.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Income Source" : "Add Income Source"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-1">
            <Label>Member</Label>
            <select
              {...register("householdMemberId")}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Select member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
            {errors.householdMemberId && (
              <p className="text-xs text-red-500">
                {errors.householdMemberId.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Label</Label>
            <Input {...register("label")} placeholder="e.g. Primary Salary" />
            {errors.label && (
              <p className="text-xs text-red-500">{errors.label.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                {...register("type")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {INCOME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <select
                {...register("frequency")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input
              {...register("amount")}
              placeholder="e.g. 8333.33"
              type="number"
              step="0.01"
              min="0"
            />
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register("taxable")} id="taxable" />
            <Label htmlFor="taxable">Taxable income</Label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register("isActive")} id="isActive" />
            <Label htmlFor="isActive">Is Active</Label>
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input {...register("notes")} placeholder="Optional notes" />
          </div>
          <div className="space-y-2 pt-2">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : editing
                  ? "Update"
                  : "Add Income Source"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
