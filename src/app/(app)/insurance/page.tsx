"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insuranceProfileSchema,
  type InsuranceProfileInput,
} from "@/lib/validations/financial";

type InsuranceProfile = {
  healthInsuranceStatus: string;
  longTermCareCoverage: boolean;
  lifeInsuranceCoverageAmount: string | null;
  lifeInsuranceNotes: string | null;
  disabilityCoverageFlag: boolean;
  umbrellaCoverageFlag: boolean;
  notes: string | null;
};

const HEALTH_STATUS_OPTIONS = [
  { value: "employer", label: "Employer-sponsored" },
  { value: "marketplace", label: "Marketplace / ACA" },
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
  { value: "none", label: "None" },
  { value: "other", label: "Other" },
];

export default function InsurancePage() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InsuranceProfileInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(insuranceProfileSchema) as any,
    defaultValues: {
      longTermCareCoverage: false,
      disabilityCoverageFlag: false,
      umbrellaCoverageFlag: false,
    },
  });

  useEffect(() => {
    fetch("/api/insurance")
      .then((r) => r.json())
      .then((d: { profile: InsuranceProfile | null }) => {
        if (d.profile) {
          reset({
            healthInsuranceStatus: d.profile.healthInsuranceStatus,
            longTermCareCoverage: d.profile.longTermCareCoverage,
            lifeInsuranceCoverageAmount:
              d.profile.lifeInsuranceCoverageAmount ?? undefined,
            lifeInsuranceNotes: d.profile.lifeInsuranceNotes ?? undefined,
            disabilityCoverageFlag: d.profile.disabilityCoverageFlag,
            umbrellaCoverageFlag: d.profile.umbrellaCoverageFlag,
            notes: d.profile.notes ?? undefined,
          });
        }
        setLoading(false);
      });
  }, [reset]);

  const onSubmit = async (data: InsuranceProfileInput) => {
    setServerError(null);
    setSaved(false);
    const res = await fetch("/api/insurance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json();
      setServerError(j.error || "Failed to save");
      return;
    }
    setSaved(true);
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Insurance Profile
        </h1>
        <p className="text-slate-500 mt-1">
          Coverage summary for your household
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {serverError && (
            <p className="text-sm text-red-500">{serverError}</p>
          )}
          {saved && (
            <p className="text-sm text-green-600">Saved successfully.</p>
          )}

          <div className="space-y-1">
            <Label>Health Insurance Status</Label>
            <select
              {...register("healthInsuranceStatus")}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Select status...</option>
              {HEALTH_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {errors.healthInsuranceStatus && (
              <p className="text-xs text-red-500">
                {errors.healthInsuranceStatus.message}
              </p>
            )}
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">
              Coverage Flags
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("longTermCareCoverage")}
                  id="ltc"
                />
                <Label htmlFor="ltc">Long-term care coverage</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("disabilityCoverageFlag")}
                  id="disability"
                />
                <Label htmlFor="disability">Disability insurance</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("umbrellaCoverageFlag")}
                  id="umbrella"
                />
                <Label htmlFor="umbrella">Umbrella policy</Label>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">Life Insurance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Coverage Amount (optional)</Label>
                <Input
                  {...register("lifeInsuranceCoverageAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 500000"
                />
              </div>
              <div className="space-y-1">
                <Label>Life Insurance Notes</Label>
                <Input
                  {...register("lifeInsuranceNotes")}
                  placeholder="e.g. Term policy, expires 2035"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input {...register("notes")} placeholder="Optional notes" />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Insurance Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
