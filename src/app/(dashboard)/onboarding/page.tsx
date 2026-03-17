"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

const STEPS = ["Your Info", "Household Type", "Spouse", "Location & Taxes", "Retirement Goals"];
const TOTAL_STEPS = STEPS.length;

const step1Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().refine((val) => {
    const d = new Date(val);
    const now = new Date();
    const age = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return age >= 18 && age <= 100;
  }, "Must be between 18 and 100"),
});

const step2Schema = z.object({
  planningMode: z.enum(["INDIVIDUAL", "COUPLE"]),
});

const step3Schema = z.object({
  spouseFirstName: z.string().min(1, "First name is required"),
  spouseLastName: z.string().min(1, "Last name is required"),
  spouseDateOfBirth: z.string().refine((val) => {
    const d = new Date(val);
    const now = new Date();
    const age = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return age >= 18 && age <= 100;
  }, "Must be between 18 and 100"),
});

const step4Schema = z.object({
  stateOfResidence: z.string().min(2, "State is required"),
  filingStatus: z.enum(["SINGLE", "MARRIED_FILING_JOINTLY", "MARRIED_FILING_SEPARATELY", "HEAD_OF_HOUSEHOLD"]),
});

const step5Schema = z.object({
  retirementTargetAge: z.number().min(50).max(80),
  lifeExpectancy: z.number().min(60).max(120),
  spouseRetirementTargetAge: z.number().min(50).max(80).optional(),
  spouseLifeExpectancy: z.number().min(60).max(120).optional(),
});

type FormData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  planningMode: "INDIVIDUAL" | "COUPLE";
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseDateOfBirth?: string;
  stateOfResidence: string;
  filingStatus: "SINGLE" | "MARRIED_FILING_JOINTLY" | "MARRIED_FILING_SEPARATELY" | "HEAD_OF_HOUSEHOLD";
  retirementTargetAge: number;
  lifeExpectancy: number;
  spouseRetirementTargetAge?: number;
  spouseLifeExpectancy?: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<FormData>>({
    planningMode: "INDIVIDUAL",
    lifeExpectancy: 90,
    spouseLifeExpectancy: 90,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const next = (data: Partial<FormData>) => {
    const updated = { ...formData, ...data };
    setFormData(updated);
    if (step === 2 && data.planningMode === "INDIVIDUAL") {
      setStep(4);
    } else {
      setStep((s) => s + 1);
    }
  };

  const back = () => {
    if (step === 4 && formData.planningMode === "INDIVIDUAL") {
      setStep(2);
    } else {
      setStep((s) => s - 1);
    }
  };

  const submit = async (data: Partial<FormData>) => {
    const final = { ...formData, ...data };
    setLoading(true);
    setError(null);

    try {
      const householdRes = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${final.firstName} ${final.lastName}${final.planningMode === "COUPLE" ? ` & ${final.spouseFirstName} ${final.spouseLastName}` : ""}'s Household`,
          filingStatus: final.filingStatus,
          stateOfResidence: final.stateOfResidence,
          planningMode: final.planningMode,
        }),
      });

      if (!householdRes.ok) {
        const json = await householdRes.json();
        throw new Error(json.error || "Failed to create household");
      }

      const { household } = await householdRes.json();

      await fetch("/api/household/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: household.id,
          firstName: final.firstName,
          lastName: final.lastName,
          relationshipType: "PRIMARY",
          dateOfBirth: final.dateOfBirth,
          retirementTargetAge: final.retirementTargetAge,
          lifeExpectancy: final.lifeExpectancy,
        }),
      });

      if (final.planningMode === "COUPLE" && final.spouseFirstName) {
        await fetch("/api/household/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            householdId: household.id,
            firstName: final.spouseFirstName,
            lastName: final.spouseLastName,
            relationshipType: "SPOUSE",
            dateOfBirth: final.spouseDateOfBirth,
            retirementTargetAge: final.spouseRetirementTargetAge,
            lifeExpectancy: final.spouseLifeExpectancy,
          }),
        });
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{STEPS[step - 1]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && <Step1 defaultValues={formData} onNext={next} />}
      {step === 2 && <Step2 defaultValues={formData} onNext={next} onBack={back} />}
      {step === 3 && formData.planningMode === "COUPLE" && (
        <Step3 defaultValues={formData} onNext={next} onBack={back} />
      )}
      {step === 4 && (
        <Step4 defaultValues={formData} onNext={next} onBack={back} />
      )}
      {step === 5 && (
        <Step5
          defaultValues={formData}
          planningMode={formData.planningMode || "INDIVIDUAL"}
          onSubmit={submit}
          onBack={back}
          loading={loading}
        />
      )}
    </div>
  );
}

type Step1Values = { firstName: string; lastName: string; dateOfBirth: string };
function Step1({ defaultValues, onNext }: { defaultValues: Partial<FormData>; onNext: (d: Partial<FormData>) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema) as import("react-hook-form").Resolver<Step1Values>,
    defaultValues: {
      firstName: defaultValues.firstName ?? "",
      lastName: defaultValues.lastName ?? "",
      dateOfBirth: defaultValues.dateOfBirth ?? "",
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tell us about yourself</CardTitle>
        <CardDescription>Basic information to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input {...register("firstName")} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...register("lastName")} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input type="date" {...register("dateOfBirth")} />
            {errors.dateOfBirth && <p className="text-xs text-red-500">{errors.dateOfBirth.message as string}</p>}
          </div>
          <Button type="submit" className="w-full">Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}

type Step2Values = { planningMode: "INDIVIDUAL" | "COUPLE" };
function Step2({ defaultValues, onNext, onBack }: { defaultValues: Partial<FormData>; onNext: (d: Partial<FormData>) => void; onBack: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema) as import("react-hook-form").Resolver<Step2Values>,
    defaultValues: {
      planningMode: defaultValues.planningMode ?? "INDIVIDUAL",
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning for</CardTitle>
        <CardDescription>How would you like to plan?</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div className="space-y-3">
            {[
              { value: "INDIVIDUAL", label: "Just me", desc: "Individual retirement planning" },
              { value: "COUPLE", label: "Me & my spouse/partner", desc: "Joint household planning" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" value={opt.value} {...register("planningMode")} className="mt-1" />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-sm text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {errors.planningMode && <p className="text-xs text-red-500">{errors.planningMode.message}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="w-full" onClick={onBack}>Back</Button>
            <Button type="submit" className="w-full">Continue</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type Step3Values = { spouseFirstName: string; spouseLastName: string; spouseDateOfBirth: string };
function Step3({ defaultValues, onNext, onBack }: { defaultValues: Partial<FormData>; onNext: (d: Partial<FormData>) => void; onBack: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step3Values>({
    resolver: zodResolver(step3Schema) as import("react-hook-form").Resolver<Step3Values>,
    defaultValues: {
      spouseFirstName: defaultValues.spouseFirstName ?? "",
      spouseLastName: defaultValues.spouseLastName ?? "",
      spouseDateOfBirth: defaultValues.spouseDateOfBirth ?? "",
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spouse / Partner</CardTitle>
        <CardDescription>Tell us about your spouse or partner</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input {...register("spouseFirstName")} />
              {errors.spouseFirstName && <p className="text-xs text-red-500">{errors.spouseFirstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...register("spouseLastName")} />
              {errors.spouseLastName && <p className="text-xs text-red-500">{errors.spouseLastName.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input type="date" {...register("spouseDateOfBirth")} />
            {errors.spouseDateOfBirth && <p className="text-xs text-red-500">{errors.spouseDateOfBirth.message as string}</p>}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="w-full" onClick={onBack}>Back</Button>
            <Button type="submit" className="w-full">Continue</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type Step4Values = { stateOfResidence: string; filingStatus: "SINGLE" | "MARRIED_FILING_JOINTLY" | "MARRIED_FILING_SEPARATELY" | "HEAD_OF_HOUSEHOLD" };
function Step4({ defaultValues, onNext, onBack }: { defaultValues: Partial<FormData>; onNext: (d: Partial<FormData>) => void; onBack: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step4Values>({
    resolver: zodResolver(step4Schema) as import("react-hook-form").Resolver<Step4Values>,
    defaultValues: {
      stateOfResidence: defaultValues.stateOfResidence ?? "",
      filingStatus: defaultValues.filingStatus ?? "SINGLE",
    },
  });
  const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Location & Tax Filing</CardTitle>
        <CardDescription>Used for state-specific tax calculations</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onNext)} className="space-y-4">
          <div className="space-y-2">
            <Label>State of Residence</Label>
            <select {...register("stateOfResidence")} className="w-full border rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Select state...</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.stateOfResidence && <p className="text-xs text-red-500">{errors.stateOfResidence.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Federal Filing Status</Label>
            <select {...register("filingStatus")} className="w-full border rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Select status...</option>
              <option value="SINGLE">Single</option>
              <option value="MARRIED_FILING_JOINTLY">Married Filing Jointly</option>
              <option value="MARRIED_FILING_SEPARATELY">Married Filing Separately</option>
              <option value="HEAD_OF_HOUSEHOLD">Head of Household</option>
            </select>
            {errors.filingStatus && <p className="text-xs text-red-500">{errors.filingStatus.message}</p>}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="w-full" onClick={onBack}>Back</Button>
            <Button type="submit" className="w-full">Continue</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Step5({
  defaultValues,
  planningMode,
  onSubmit,
  onBack,
  loading,
}: {
  defaultValues: Partial<FormData>;
  planningMode: "INDIVIDUAL" | "COUPLE";
  onSubmit: (d: Partial<FormData>) => void;
  onBack: () => void;
  loading: boolean;
}) {
  type Step5Values = { retirementTargetAge: number; lifeExpectancy: number; spouseRetirementTargetAge?: number; spouseLifeExpectancy?: number };
  const { register, handleSubmit, formState: { errors } } = useForm<Step5Values>({
    resolver: zodResolver(step5Schema) as import("react-hook-form").Resolver<Step5Values>,
    defaultValues: {
      retirementTargetAge: defaultValues.retirementTargetAge || 65,
      lifeExpectancy: defaultValues.lifeExpectancy || 90,
      spouseRetirementTargetAge: defaultValues.spouseRetirementTargetAge || 65,
      spouseLifeExpectancy: defaultValues.spouseLifeExpectancy || 90,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retirement Goals</CardTitle>
        <CardDescription>Set your target retirement ages</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Your Retirement Age</Label>
              <Input type="number" min={50} max={80} {...register("retirementTargetAge", { valueAsNumber: true })} />
              {errors.retirementTargetAge && <p className="text-xs text-red-500">{errors.retirementTargetAge.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Your Life Expectancy</Label>
              <Input type="number" min={60} max={120} {...register("lifeExpectancy", { valueAsNumber: true })} />
              {errors.lifeExpectancy && <p className="text-xs text-red-500">{errors.lifeExpectancy.message}</p>}
            </div>
          </div>
          {planningMode === "COUPLE" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Spouse Retirement Age</Label>
                <Input type="number" min={50} max={80} {...register("spouseRetirementTargetAge", { valueAsNumber: true })} />
                {errors.spouseRetirementTargetAge && <p className="text-xs text-red-500">{errors.spouseRetirementTargetAge.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Spouse Life Expectancy</Label>
                <Input type="number" min={60} max={120} {...register("spouseLifeExpectancy", { valueAsNumber: true })} />
                {errors.spouseLifeExpectancy && <p className="text-xs text-red-500">{errors.spouseLifeExpectancy.message}</p>}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="w-full" onClick={onBack} disabled={loading}>Back</Button>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Setting up..." : "Complete Setup"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
