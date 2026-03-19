"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/FormDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  assetAccountSchema,
  type AssetAccountInput,
} from "@/lib/validations/financial";

type HouseholdMember = { id: string; firstName: string; lastName: string };

type AssetAccount = {
  id: string;
  householdMemberId: string | null;
  ownerType: string;
  type: string;
  institutionName: string | null;
  accountName: string;
  currentBalance: string;
  taxTreatment: string;
  isActive: boolean;
  householdMember: HouseholdMember | null;
};

const ASSET_TYPES = [
  "CHECKING",
  "SAVINGS",
  "BROKERAGE",
  "TRADITIONAL_401K",
  "ROTH_401K",
  "TRADITIONAL_IRA",
  "ROTH_IRA",
  "HSA",
  "ANNUITY",
  "CASH",
  "CD",
  "OTHER",
];
const OWNER_TYPES = ["INDIVIDUAL", "JOINT", "HOUSEHOLD"];
const TAX_TREATMENTS = ["TAXABLE", "TAX_DEFERRED", "TAX_FREE", "MIXED"];
const FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AssetsPage() {
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AssetAccount | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch("/api/assets");
    const data = await res.json();
    setAccounts(data.accounts || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetch("/api/household/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []));
  }, [fetchAccounts]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssetAccountInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(assetAccountSchema) as any,
    defaultValues: { ownerType: "INDIVIDUAL", isActive: true },
  });

  const openAdd = () => {
    setEditing(null);
    reset({ ownerType: "INDIVIDUAL", isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (a: AssetAccount) => {
    setEditing(a);
    reset({
      householdMemberId: a.householdMemberId ?? undefined,
      ownerType: a.ownerType as AssetAccountInput["ownerType"],
      type: a.type as AssetAccountInput["type"],
      institutionName: a.institutionName ?? undefined,
      accountName: a.accountName,
      currentBalance: a.currentBalance,
      taxTreatment: a.taxTreatment as AssetAccountInput["taxTreatment"],
      isActive: a.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: AssetAccountInput) => {
    setError(null);
    const url = editing ? `/api/assets/${editing.id}` : "/api/assets";
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
    fetchAccounts();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Archive this asset account?")) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    fetchAccounts();
  };

  const totalBalance = accounts.reduce(
    (s, a) => s + Number(a.currentBalance),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asset Accounts</h1>
          <p className="text-slate-500 mt-1">
            Total assets: <strong>{fmt(totalBalance)}</strong>
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Asset</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 mb-4">No asset accounts yet.</p>
          <Button onClick={openAdd}>Add your first asset account</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Account
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Owner
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Institution
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Balance
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Tax
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{a.accountName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.householdMember
                      ? `${a.householdMember.firstName} ${a.householdMember.lastName}`
                      : a.ownerType}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.institutionName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(Number(a.currentBalance))}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.taxTreatment.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(a)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(a.id)}
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
        title={editing ? "Edit Asset Account" : "Add Asset Account"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-1">
            <Label>Member (optional)</Label>
            <select
              {...register("householdMemberId")}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Joint / Household</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Owner Type</Label>
              <select
                {...register("ownerType")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {OWNER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Account Type</Label>
              <select
                {...register("type")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Account Name</Label>
            <Input
              {...register("accountName")}
              placeholder="e.g. 401(k) - Employer Plan"
            />
            {errors.accountName && (
              <p className="text-xs text-red-500">
                {errors.accountName.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Institution Name (optional)</Label>
            <Input
              {...register("institutionName")}
              placeholder="e.g. Fidelity"
            />
          </div>
          <div className="space-y-1">
            <Label>Current Balance</Label>
            <Input
              {...register("currentBalance")}
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 100000"
            />
            {errors.currentBalance && (
              <p className="text-xs text-red-500">
                {errors.currentBalance.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Tax Treatment</Label>
            <select
              {...register("taxTreatment")}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              {TAX_TREATMENTS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Annual Contribution (optional)</Label>
              <Input
                {...register("annualContributionAmount")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 23000"
              />
            </div>
            <div className="space-y-1">
              <Label>Contribution Frequency</Label>
              <select
                {...register("contributionFrequency")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">None</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Expected Return Rate (optional, e.g. 0.07)</Label>
            <Input
              {...register("expectedReturnRate")}
              type="number"
              step="0.001"
              min="0"
              max="1"
              placeholder="e.g. 0.07"
            />
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
                  : "Add Asset Account"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
