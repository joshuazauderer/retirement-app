"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/FormDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  realEstatePropertySchema,
  type RealEstatePropertyInput,
} from "@/lib/validations/financial";

type RealEstateProperty = {
  id: string;
  type: string;
  label: string;
  ownershipType: string;
  currentMarketValue: string;
  mortgageBalance: string | null;
  monthlyMortgagePayment: string | null;
  annualPropertyTax: string | null;
  isPrimaryResidence: boolean;
  downsizingCandidate: boolean;
};

const PROPERTY_TYPES = [
  "PRIMARY_RESIDENCE",
  "VACATION_HOME",
  "RENTAL_PROPERTY",
  "LAND",
  "OTHER",
];
const OWNERSHIP_TYPES = ["INDIVIDUAL", "JOINT", "HOUSEHOLD"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function HousingPage() {
  const [properties, setProperties] = useState<RealEstateProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RealEstateProperty | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    const res = await fetch("/api/housing");
    const data = await res.json();
    setProperties(data.properties || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RealEstatePropertyInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(realEstatePropertySchema) as any,
    defaultValues: {
      ownershipType: "JOINT",
      isPrimaryResidence: false,
      downsizingCandidate: false,
    },
  });

  const openAdd = () => {
    setEditing(null);
    reset({
      ownershipType: "JOINT",
      isPrimaryResidence: false,
      downsizingCandidate: false,
    });
    setDialogOpen(true);
  };

  const openEdit = (p: RealEstateProperty) => {
    setEditing(p);
    reset({
      type: p.type as RealEstatePropertyInput["type"],
      label: p.label,
      ownershipType: p.ownershipType as RealEstatePropertyInput["ownershipType"],
      currentMarketValue: p.currentMarketValue,
      mortgageBalance: p.mortgageBalance ?? undefined,
      monthlyMortgagePayment: p.monthlyMortgagePayment ?? undefined,
      annualPropertyTax: p.annualPropertyTax ?? undefined,
      isPrimaryResidence: p.isPrimaryResidence,
      downsizingCandidate: p.downsizingCandidate,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: RealEstatePropertyInput) => {
    setError(null);
    const url = editing ? `/api/housing/${editing.id}` : "/api/housing";
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
    fetchProperties();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    await fetch(`/api/housing/${id}`, { method: "DELETE" });
    fetchProperties();
  };

  const totalValue = properties.reduce(
    (s, p) => s + Number(p.currentMarketValue),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Real Estate</h1>
          <p className="text-slate-500 mt-1">
            Total value: <strong>{fmt(totalValue)}</strong>
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Property</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 mb-4">No properties yet.</p>
          <Button onClick={openAdd}>Add your first property</Button>
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
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Market Value
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Mortgage Balance
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Primary
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {properties.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{p.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(Number(p.currentMarketValue))}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {p.mortgageBalance
                      ? fmt(Number(p.mortgageBalance))
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.isPrimaryResidence ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(p.id)}
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
        title={editing ? "Edit Property" : "Add Property"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                {...register("type")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Ownership</Label>
              <select
                {...register("ownershipType")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {OWNERSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Label</Label>
            <Input
              {...register("label")}
              placeholder="e.g. Primary Home - Austin, TX"
            />
            {errors.label && (
              <p className="text-xs text-red-500">{errors.label.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Current Market Value</Label>
            <Input
              {...register("currentMarketValue")}
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 500000"
            />
            {errors.currentMarketValue && (
              <p className="text-xs text-red-500">
                {errors.currentMarketValue.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Mortgage Balance</Label>
              <Input
                {...register("mortgageBalance")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 300000"
              />
            </div>
            <div className="space-y-1">
              <Label>Monthly Payment</Label>
              <Input
                {...register("monthlyMortgagePayment")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 2000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Annual Property Tax</Label>
              <Input
                {...register("annualPropertyTax")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 8000"
              />
            </div>
            <div className="space-y-1">
              <Label>Annual Insurance</Label>
              <Input
                {...register("annualInsuranceCost")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 2000"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register("isPrimaryResidence")}
                id="isPrimary"
              />
              <Label htmlFor="isPrimary">Primary residence</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register("downsizingCandidate")}
                id="downsizing"
              />
              <Label htmlFor="downsizing">Downsizing candidate</Label>
            </div>
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
                  : "Add Property"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
