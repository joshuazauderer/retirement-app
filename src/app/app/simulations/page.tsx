"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Run = {
  id: string;
  label: string | null;
  runType: string;
  success: boolean;
  firstDepletionYear: number | null;
  endingBalance: string;
  endingNetWorth: string;
  projectionStartYear: number;
  projectionEndYear: number;
  yearsProjected: number;
  createdAt: string;
};

type ValidationState = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SimulationsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationState | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/simulations").then((r) => r.json()),
      fetch("/api/simulations/validate").then((r) => r.json()),
    ]).then(([runsData, validData]) => {
      setRuns(runsData.runs || []);
      if (validData.validation) setValidation(validData.validation);
      setLoading(false);
    });
  }, []);

  const runSimulation = async () => {
    setRunning(true);
    setError(null);
    const res = await fetch("/api/simulations", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Simulation failed");
      setRunning(false);
      return;
    }
    router.push(`/app/simulations/${data.runId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Retirement Projections
          </h1>
          <p className="text-slate-500 mt-1">
            Run deterministic baseline projections to see if your plan succeeds.
          </p>
        </div>
        <Button
          onClick={runSimulation}
          disabled={
            running ||
            loading ||
            (validation !== null && !validation.valid)
          }
        >
          {running ? "Running..." : "Run New Projection"}
        </Button>
      </div>

      {/* Validation errors */}
      {validation && !validation.valid && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-medium text-red-800 mb-2">
            Fix these issues before running:
          </p>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation warnings */}
      {validation?.warnings && validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="font-medium text-yellow-800 mb-2">Warnings:</p>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            {validation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Runs table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 text-lg mb-2">No projections yet</p>
          <p className="text-slate-400 text-sm">
            Run your first projection to see if your retirement plan succeeds.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Label
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Ending Balance
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Depletion Year
                </th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">
                  Horizon
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {run.label || "Baseline"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        run.success
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {run.success ? "Funded" : "Depletes"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {fmt(Number(run.endingBalance))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {run.firstDepletionYear ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {run.projectionStartYear}–{run.projectionEndYear}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/app/simulations/${run.id}`)
                      }
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
