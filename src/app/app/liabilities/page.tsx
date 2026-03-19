"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/FormDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  liabilitySchema,
  type LiabilityInput,
} from "@/lib/validations/financial";

type HouseholdMember = { id: string; firstName: string; lastName: string };

type Liability = {
  id: string;
  householdMemberId: string | null;
  type: string;
  label: string;
  lenderName: string | null;
  currentBalance: string;
  interestRate: string | null;
  monthlyPayment: string | null;
  isSecured: boolean;
  isActive: boolean;
  householdMember: HouseholdMember | null;
};

const LIABILITY_TYPES = [
  "MORTGAGE",
  "AUTO_LOAN",
  "STUDENT_LOAN",
  "CREDIT_CARD",
  "PERSONAL_LOAN",
  "HELOC",
  "OTHER",
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Liability | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchLiabilities = useCallback(async () => {
    const res = await fetch("/api/liabilities");
    const data = await res.json();
    setLiabilities(data.liabilities || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLiabilities();
    fetch("/api/household/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []));
  }, [fetchLiabilities]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LiabilityInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(liabilitySchema) as any,
    defaultValues: { isSecured: false, isActive: true },
  });

  const openAdd = () => {
    setEditing(null);
    reset({ isSecured: false, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (l: Liability) => {
    setEditing(l);
    reset({
      householdMemberId: l.householdMemberId ?? undefined,
      type: l.type as LiabilityInput["type"],
      label: l.label,
      lenderName: l.lenderName ?? undefined,
      currentBalance: l.currentBalance,
      interestRate: l.interestRate ?? undefined,
      monthlyPayment: l.monthlyPayment ?? undefined,
      isSecured: l.isSecured,
      isActive: l.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: LiabilityInput) => {
    setError(null);
    const url = editing
      ? `/api/liabilities/${editing.id}`
      : "/api/liabilities";
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
    fetchLiabilities();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Archive this liability?")) return;
    await fetch(`/api/liabilities/${id}`, { method: "DELETE" });
    fetchLiabilities();
  };

  const totalBalance = liabilities.reduce(
    (s, l) => s + Number(l.currentBalance),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Liabilities</h1>
          <p className="text-slate-500 mt-1">
            Total liabilities: <strong>{fmt(totalBalance)}</strong>
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Liability</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : liabilities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 mb-4">No liabilities yet.</p>
          <Button onClick={openAdd}>Add your first liability</Button>
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
                  Lender
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Balance
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Rate
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Monthly Payment
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liabilities.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{l.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.lenderName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(Number(l.currentBalance))}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {l.interestRate
                      ? `${(Number(l.interestRate) * 100).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {l.monthlyPayment ? fmt(Number(l.monthlyPayment)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(l)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(l.id)}
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
        title={editing ? "Edit Liability" : "Add Liability"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-1">
            <Label>Member (optional)</Label>
            <select
              {...register("householdMemberId")}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Household</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                {...register("type")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {LIABILITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                {...register("label")}
                placeholder="e.g. Home Mortgage"
              />
              {errors.label && (
                <p className="text-xs text-red-500">{errors.label.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Lender Name (optional)</Label>
            <Input {...register("lenderName")} placeholder="e.g. Wells Fargo" />
          </div>
          <div className="space-y-1">
            <Label>Current Balance</Label>
            <Input
              {...register("currentBalance")}
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 250000"
            />
            {errors.currentBalance && (
              <p className="text-xs text-red-500">
                {errors.currentBalance.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Interest Rate (e.g. 0.065)</Label>
              <Input
                {...register("interestRate")}
                type="number"
                step="0.0001"
                min="0"
                max="1"
                placeholder="e.g. 0.065"
              />
            </div>
            <div className="space-y-1">
              <Label>Monthly Payment</Label>
              <Input
                {...register("monthlyPayment")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register("isSecured")}
              id="isSecured"
            />
            <Label htmlFor="isSecured">Secured debt</Label>
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
                  : "Add Liability"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
