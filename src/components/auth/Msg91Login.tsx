import { useEffect, useState, useImperativeHandle, forwardRef, useRef } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { functions, auth } from "@/lib/firebase";
import { LSpinner } from "@/components/laundry";
import { httpsCallable as getCallable } from "firebase/functions";

// Extend window object for MSG91
declare global {
    interface Window {
        initSendOTP?: (config: any) => void;
    }
}

interface Msg91LoginProps {
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

export interface Msg91Handle {
    openWidget: (phoneNumber: string) => void;
}

export const Msg91Login = forwardRef<Msg91Handle, Msg91LoginProps>(({ onSuccess, onError }, ref) => {
    const [loading, setLoading] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const currentPhoneRef = useRef<string>("");

    // Load MSG91 Script
    useEffect(() => {
        if (document.getElementById("msg91-script")) {
            setScriptLoaded(true);
            return;
        }

        const script = document.createElement("script");
        script.id = "msg91-script";
        script.src = "https://verify.msg91.com/otp-provider.js";
        script.async = true;

        script.onload = () => {
            setScriptLoaded(true);
        };

        script.onerror = () => {
            const fallback = document.createElement("script");
            fallback.src = "https://verify.phone91.com/otp-provider.js";
            fallback.onload = () => setScriptLoaded(true);
            document.head.appendChild(fallback);
        };

        document.head.appendChild(script);
    }, []);

    const openWidget = (phoneNumber: string) => {
        if (!scriptLoaded || !window.initSendOTP) {
            if (onError) onError("Verification service loading... please try again.");
            return;
        }

        currentPhoneRef.current = phoneNumber;

        // Clean phone number (remove +91 if present for passing to identifier, or keep it depending on widget)
        // Widget usually takes the number as is.

        window.initSendOTP({
            widgetId: "356b766a3237343037343235",
            tokenAuth: "449167TcQzNJeWfJC68c632aaP1",
            identifier: phoneNumber, // Pre-fill/Target specific number
            exposeMethods: false,
            success: handleMsg91Success,
            failure: handleMsg91Failure
        });
    };

    useImperativeHandle(ref, () => ({
        openWidget
    }));

    const handleMsg91Success = async (data: any) => {
        console.log("MSG91 Raw Success Data:", JSON.stringify(data, null, 2));
        setLoading(true);

        try {
            // Use the phone number we initiated with, as fallback or primary source
            // MSG91 widget ensures the user verified this number
            const phoneToVerify = data?.mobile || data?.identifier || currentPhoneRef.current;

            if (!phoneToVerify) {
                // If we also lost the ref, we are stuck.
                throw new Error("Could not identify verified phone number.");
            }

            console.log(`Attempting login for: ${phoneToVerify}`);

            // Call Cloud Function to get Firebase Token
            const loginFn = getCallable(functions, 'loginWithMsg91');
            const result = await loginFn({ phone: phoneToVerify });
            const { token } = result.data as { token: string };

            // Sign in to Firebase
            await signInWithCustomToken(auth, token);

            if (onSuccess) onSuccess();

        } catch (error: any) {
            console.error("Login failed:", error);
            if (onError) onError(error.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleMsg91Failure = (error: any) => {
        console.error("MSG91 Failure:", error);
        if (onError) onError("Verification passed failed or cancelled.");
    };

    return (
        <div className="w-full">
            {loading && (
                <div className="flex justify-center p-4">
                    <div className="flex flex-col items-center gap-2">
                        <LSpinner />
                        <p className="text-sm text-gray-500">Verifying session...</p>
                    </div>
                </div>
            )}
        </div>
    );
});

Msg91Login.displayName = "Msg91Login";
