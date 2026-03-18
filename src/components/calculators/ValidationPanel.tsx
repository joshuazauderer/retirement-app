interface ValidationPanelProps { errors: string[]; warnings: string[] }
export function ValidationPanel({ errors, warnings }: ValidationPanelProps) {
  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-medium text-red-800 mb-2">Required data is missing:</p>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="font-medium text-yellow-800 mb-2">Heads up:</p>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
