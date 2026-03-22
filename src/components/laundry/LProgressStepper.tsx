/**
 * Progress Stepper Component
 * 
 * Step indicator for multi-step flows
 */

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
    id: string;
    label: string;
}

interface LProgressStepperProps {
    steps: Step[];
    currentStep: number;
    className?: string;
}

export function LProgressStepper({
    steps,
    currentStep,
    className,
}: LProgressStepperProps) {
    return (
        <div className={cn("flex items-center justify-between", className)}>
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                    <div
                        key={step.id}
                        className="flex items-center flex-1 last:flex-none"
                    >
                        {/* Step Circle */}
                        <div className="flex flex-col items-center">
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                    "transition-colors",
                                    isCompleted && "bg-primary text-white",
                                    isCurrent && "bg-primary text-white",
                                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    index + 1
                                )}
                            </div>
                            <span
                                className={cn(
                                    "text-xs mt-1 text-center",
                                    isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                                )}
                            >
                                {step.label}
                            </span>
                        </div>

                        {/* Connector Line */}
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    "flex-1 h-0.5 mx-2 mt-[-20px]",
                                    index < currentStep ? "bg-primary" : "bg-muted"
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
