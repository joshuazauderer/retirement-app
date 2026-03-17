"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/FormDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  benefitSourceSchema,
  type BenefitSourceInput,
} from "@/lib/validations/financial";

type HouseholdMember = { id: string; firstName: string; lastName: string };

type BenefitSource = {
  id: string;
  householdMemberId: string;
  type: string;
  label: string;
  estimatedMonthlyBenefit: string;
  claimAge: number;
  isActive: boolean;
  householdMember: HouseholdMember;
};

const BENEFIT_TYPES = [
  "SOCIAL_SECURITY",
  "PENSION",
  "ANNUITY_INCOME",
  "VETERANS_BENEFIT",
  "DISABILITY",
  "OTHER",
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function BenefitsPage() {
  const [sources, setSources] = useState<BenefitSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BenefitSource | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    const res = await fetch("/api/benefits");
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
  } = useForm<BenefitSourceInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(benefitSourceSchema) as any,
    defaultValues: { isActive: true, claimAge: 67 },
  });

  const openAdd = () => {
    setEditing(null);
    reset({ isActive: true, claimAge: 67 });
    setDialogOpen(true);
  };

  const openEdit = (s: BenefitSource) => {
    setEditing(s);
    reset({
      householdMemberId: s.householdMemberId,
      type: s.type as BenefitSourceInput["type"],
      label: s.label,
      estimatedMonthlyBenefit: s.estimatedMonthlyBenefit,
      claimAge: s.claimAge,
      isActive: s.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: BenefitSourceInput) => {
    setError(null);
    const url = editing ? `/api/benefits/${editing.id}` : "/api/benefits";
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
    if (!confirm("Archive this benefit source?")) return;
    await fetch(`/api/benefits/${id}`, { method: "DELETE" });
    fetchSources();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Benefit Sources</h1>
          <p className="text-slate-500 mt-1">
            Social Security, pensions, and other guaranteed income
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Benefit</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 mb-4">No benefit sources yet.</p>
          <Button onClick={openAdd}>Add your first benefit source</Button>
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
                  Monthly Benefit
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Claim Age
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
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(Number(s.estimatedMonthlyBenefit))}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {s.claimAge}
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
        title={editing ? "Edit Benefit Source" : "Add Benefit Source"}
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
            <Label>Type</Label>
            <select
              {...register("type")}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              {BENEFIT_TYPES.map((t) => (
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
              placeholder="e.g. Social Security (age 67)"
            />
            {errors.label && (
              <p className="text-xs text-red-500">{errors.label.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Monthly Benefit</Label>
              <Input
                {...register("estimatedMonthlyBenefit")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 2800"
              />
              {errors.estimatedMonthlyBenefit && (
                <p className="text-xs text-red-500">
                  {errors.estimatedMonthlyBenefit.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Claim Age</Label>
              <Input
                {...register("claimAge", { valueAsNumber: true })}
                type="number"
                min="50"
                max="80"
                placeholder="e.g. 67"
              />
              {errors.claimAge && (
                <p className="text-xs text-red-500">
                  {errors.claimAge.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>COLA Rate (e.g. 0.023)</Label>
              <Input
                {...register("colaRate")}
                type="number"
                step="0.001"
                min="0"
                max="1"
                placeholder="e.g. 0.023"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register("survivorEligible")}
              id="survivorEligible"
            />
            <Label htmlFor="survivorEligible">Survivor benefit eligible</Label>
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
                  : "Add Benefit Source"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
