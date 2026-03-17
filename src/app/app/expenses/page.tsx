"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  expenseProfileSchema,
  type ExpenseProfileInput,
} from "@/lib/validations/financial";

type ExpenseProfile = {
  currentMonthlySpending: string;
  retirementMonthlyEssential: string;
  retirementMonthlyDiscretionary: string;
  healthcareMonthlyEstimate: string;
  housingMonthlyEstimate: string;
  travelMonthlyEstimate: string | null;
  otherMonthlyEstimate: string | null;
  inflationAssumption: string | null;
  notes: string | null;
};

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseProfileInput>({
    resolver: zodResolver(expenseProfileSchema),
  });

  useEffect(() => {
    fetch("/api/expenses")
      .then((r) => r.json())
      .then((d: { profile: ExpenseProfile | null }) => {
        if (d.profile) {
          reset({
            currentMonthlySpending: d.profile.currentMonthlySpending,
            retirementMonthlyEssential: d.profile.retirementMonthlyEssential,
            retirementMonthlyDiscretionary:
              d.profile.retirementMonthlyDiscretionary,
            healthcareMonthlyEstimate: d.profile.healthcareMonthlyEstimate,
            housingMonthlyEstimate: d.profile.housingMonthlyEstimate,
            travelMonthlyEstimate: d.profile.travelMonthlyEstimate ?? undefined,
            otherMonthlyEstimate: d.profile.otherMonthlyEstimate ?? undefined,
            inflationAssumption: d.profile.inflationAssumption ?? undefined,
            notes: d.profile.notes ?? undefined,
          });
        }
        setLoading(false);
      });
  }, [reset]);

  const onSubmit = async (data: ExpenseProfileInput) => {
    setServerError(null);
    setSaved(false);
    const res = await fetch("/api/expenses", {
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
        <h1 className="text-2xl font-bold text-slate-900">Expense Profile</h1>
        <p className="text-slate-500 mt-1">
          Your current and projected retirement spending
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

          <div>
            <h3 className="font-medium text-slate-900 mb-4">
              Current Spending
            </h3>
            <div className="space-y-1">
              <Label>Current Monthly Spending</Label>
              <Input
                {...register("currentMonthlySpending")}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 7500"
              />
              {errors.currentMonthlySpending && (
                <p className="text-xs text-red-500">
                  {errors.currentMonthlySpending.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">
              Retirement Spending
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Monthly Essential</Label>
                <Input
                  {...register("retirementMonthlyEssential")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 4000"
                />
                {errors.retirementMonthlyEssential && (
                  <p className="text-xs text-red-500">
                    {errors.retirementMonthlyEssential.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Monthly Discretionary</Label>
                <Input
                  {...register("retirementMonthlyDiscretionary")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 2500"
                />
                {errors.retirementMonthlyDiscretionary && (
                  <p className="text-xs text-red-500">
                    {errors.retirementMonthlyDiscretionary.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">
              Category Estimates
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Healthcare (monthly)</Label>
                <Input
                  {...register("healthcareMonthlyEstimate")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 800"
                />
                {errors.healthcareMonthlyEstimate && (
                  <p className="text-xs text-red-500">
                    {errors.healthcareMonthlyEstimate.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Housing (monthly)</Label>
                <Input
                  {...register("housingMonthlyEstimate")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 2000"
                />
                {errors.housingMonthlyEstimate && (
                  <p className="text-xs text-red-500">
                    {errors.housingMonthlyEstimate.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Travel (monthly, optional)</Label>
                <Input
                  {...register("travelMonthlyEstimate")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 500"
                />
              </div>
              <div className="space-y-1">
                <Label>Other (monthly, optional)</Label>
                <Input
                  {...register("otherMonthlyEstimate")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 300"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-slate-900 mb-4">Assumptions</h3>
            <div className="space-y-1">
              <Label>Inflation Assumption (e.g. 0.03)</Label>
              <Input
                {...register("inflationAssumption")}
                type="number"
                step="0.001"
                min="0"
                max="1"
                placeholder="e.g. 0.03"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input {...register("notes")} placeholder="Optional notes" />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Expense Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
