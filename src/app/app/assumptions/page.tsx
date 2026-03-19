"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  planningAssumptionsSchema,
  type PlanningAssumptionsInput,
} from "@/lib/validations/financial";

type PlanningAssumptions = {
  inflationRate: string;
  expectedPortfolioReturn: string;
  expectedPortfolioVolatility: string;
  defaultRetirementAgeOverride: number | null;
  longevityTargetPrimary: number | null;
  longevityTargetSpouse: number | null;
  assumedTaxRate: string | null;
  simulationCountDefault: number | null;
  notes: string | null;
};

export default function AssumptionsPage() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlanningAssumptionsInput>({
    resolver: zodResolver(planningAssumptionsSchema),
    defaultValues: {
      inflationRate: 0.03,
      expectedPortfolioReturn: 0.07,
      expectedPortfolioVolatility: 0.12,
      simulationCountDefault: 1000,
    },
  });

  useEffect(() => {
    fetch("/api/assumptions")
      .then((r) => r.json())
      .then((d: { assumptions: PlanningAssumptions | null }) => {
        if (d.assumptions) {
          reset({
            inflationRate: Number(d.assumptions.inflationRate),
            expectedPortfolioReturn: Number(
              d.assumptions.expectedPortfolioReturn
            ),
            expectedPortfolioVolatility: Number(
              d.assumptions.expectedPortfolioVolatility
            ),
            defaultRetirementAgeOverride:
              d.assumptions.defaultRetirementAgeOverride ?? undefined,
            longevityTargetPrimary:
              d.assumptions.longevityTargetPrimary ?? undefined,
            longevityTargetSpouse:
              d.assumptions.longevityTargetSpouse ?? undefined,
            assumedTaxRate: d.assumptions.assumedTaxRate
              ? Number(d.assumptions.assumedTaxRate)
              : undefined,
            simulationCountDefault:
              d.assumptions.simulationCountDefault ?? 1000,
            notes: d.assumptions.notes ?? undefined,
          });
        }
        setLoading(false);
      });
  }, [reset]);

  const onSubmit = async (data: PlanningAssumptionsInput) => {
    setServerError(null);
    setSaved(false);
    const res = await fetch("/api/assumptions", {
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
    // Auto-clear the success banner after 3 seconds
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Planning Assumptions
        </h1>
        <p className="text-slate-500 mt-1">
          Macroeconomic and portfolio assumptions for projections
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {serverError && (
            <p className="text-sm text-red-500">{serverError}</p>
          )}
          {Object.keys(errors).length > 0 && (
            <p className="text-sm text-red-500">Please fix the highlighted errors before saving.</p>
          )}
          {saved && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
              <span className="text-green-600 text-sm font-medium">✓ Planning assumptions saved successfully.</span>
            </div>
          )}

          <div>
            <h3 className="font-medium text-slate-900 mb-4">
              Economic Assumptions
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Inflation Rate (decimal, e.g. 0.03)</Label>
                <Input
                  {...register("inflationRate", { valueAsNumber: true })}
                  type="number"
                  step="0.001"
                  min="0"
                  max="0.2"
                  placeholder="0.03"
                />
                {errors.inflationRate && (
                  <p className="text-xs text-red-500">
                    {errors.inflationRate.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Assumed Tax Rate (decimal, e.g. 0.22)</Label>
                <Input
                  {...register("assumedTaxRate", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.6"
                  placeholder="0.22"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">
              Portfolio Assumptions
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Expected Return (decimal, e.g. 0.07)</Label>
                <Input
                  {...register("expectedPortfolioReturn", {
                    valueAsNumber: true,
                  })}
                  type="number"
                  step="0.001"
                  min="0"
                  max="0.3"
                  placeholder="0.07"
                />
                {errors.expectedPortfolioReturn && (
                  <p className="text-xs text-red-500">
                    {errors.expectedPortfolioReturn.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Volatility (std dev, e.g. 0.12)</Label>
                <Input
                  {...register("expectedPortfolioVolatility", {
                    valueAsNumber: true,
                  })}
                  type="number"
                  step="0.001"
                  min="0"
                  max="0.5"
                  placeholder="0.12"
                />
                {errors.expectedPortfolioVolatility && (
                  <p className="text-xs text-red-500">
                    {errors.expectedPortfolioVolatility.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">
              Longevity Targets
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Primary (age)</Label>
                <Input
                  {...register("longevityTargetPrimary", {
                    valueAsNumber: true,
                  })}
                  type="number"
                  min="60"
                  max="120"
                  placeholder="e.g. 90"
                />
              </div>
              <div className="space-y-1">
                <Label>Spouse (age)</Label>
                <Input
                  {...register("longevityTargetSpouse", {
                    valueAsNumber: true,
                  })}
                  type="number"
                  min="60"
                  max="120"
                  placeholder="e.g. 92"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">Simulation</h3>
            <div className="space-y-1">
              <Label>Monte Carlo Simulation Count</Label>
              <Input
                {...register("simulationCountDefault", { valueAsNumber: true })}
                type="number"
                min="100"
                max="10000"
                step="100"
                placeholder="1000"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input {...register("notes")} placeholder="Optional notes" />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Planning Assumptions"}
          </Button>
        </form>
      </div>
    </div>
  );
}
