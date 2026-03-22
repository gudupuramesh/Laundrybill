/**
 * Customer Form Sheet
 * 
 * Add/edit customer form in responsive dialog
 * With validation feedback and duplicate checking
 */

import { useState, useEffect } from "react";
import {
    collection,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import {
    LResponsiveDialog,
    LTextInput,
    LPhoneInput,
    LTextArea,
    LButton,
    LSpacer,
    useLToast,
} from "@/components/laundry";
import type { Customer } from "@/types/customer";
import { useTranslation } from "react-i18next";
import { isValidIndianPhone, isValidEmail, normalizePhone } from "@/lib/utils";

interface CustomerFormSheetProps {
    open: boolean;
    onClose: () => void;
    customer?: Customer;
    onSubmit: (data: Partial<Customer>) => Promise<void>;
}

export function CustomerFormSheet({
    open,
    onClose,
    customer,
    onSubmit,
}: CustomerFormSheetProps) {
    const { t } = useTranslation();
    const { shopId } = useAuth();
    const { addToast } = useLToast();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
    });
    const [errors, setErrors] = useState({
        name: "",
        phone: "",
        email: "",
    });
    const [phoneTouched, setPhoneTouched] = useState(false);

    const isEdit = !!customer;

    // Reset form when customer changes
    useEffect(() => {
        if (customer) {
            setForm({
                name: customer.name || "",
                phone: customer.phone || "",
                email: customer.email || "",
                address: customer.address || "",
                notes: customer.notes || "",
            });
        } else {
            setForm({
                name: "",
                phone: "",
                email: "",
                address: "",
                notes: "",
            });
        }
        // Clear errors and touched state when opening
        setErrors({ name: "", phone: "", email: "" });
        setPhoneTouched(false);
    }, [customer, open]);

    // Check for duplicate phone number (use normalized format to match how we store)
    const checkDuplicatePhone = async (phone: string): Promise<boolean> => {
        if (!shopId || !phone) return false;
        const normalized = normalizePhone(phone);
        if (normalized.length !== 10) return false;

        try {
            const customersRef = collection(db, `shops/${shopId}/customers`);
            const q = query(customersRef, where("phone", "==", normalized));
            const snapshot = await getDocs(q);

            // If editing, exclude current customer from check
            if (isEdit && customer) {
                return snapshot.docs.some((d) => d.id !== customer.id);
            }
            return !snapshot.empty;
        } catch (error) {
            console.error("Error checking duplicate:", error);
            return false;
        }
    };

    // Check for duplicate email
    const checkDuplicateEmail = async (email: string): Promise<boolean> => {
        if (!shopId || !email) return false;

        try {
            const customersRef = collection(db, `shops/${shopId}/customers`);
            const normalizedEmail = email.toLowerCase().trim();
            const q = query(customersRef, where("email", "==", normalizedEmail));
            const snapshot = await getDocs(q);

            // If editing, exclude current customer from check
            if (isEdit && customer) {
                return snapshot.docs.some((doc) => doc.id !== customer.id);
            }
            return !snapshot.empty;
        } catch (error) {
            console.error("Error checking duplicate email:", error);
            return false;
        }
    };

    // Validate name (letters and spaces only)
    const validateName = () => {
        const nameValue = form.name.trim();
        if (!nameValue) {
            setErrors((prev) => ({ ...prev, name: t("validation.required") }));
            return false;
        }
        // Check for numbers
        if (/\d/.test(nameValue)) {
            setErrors((prev) => ({ ...prev, name: t("validation.nameLettersOnly") }));
            return false;
        }
        setErrors((prev) => ({ ...prev, name: "" }));
        return true;
    };

    // Filter name to remove numbers
    const handleNameChange = (value: string) => {
        // Remove numbers, keep letters, spaces, and common name characters
        const filtered = value.replace(/[0-9]/g, "");
        setForm({ ...form, name: filtered });
    };

    // Validate phone
    const validatePhone = () => {
        if (!form.phone) {
            setErrors((prev) => ({ ...prev, phone: t("validation.required") }));
            return false;
        }
        if (form.phone.length < 10) {
            setErrors((prev) => ({ ...prev, phone: t("validation.digitsEntered", { count: form.phone.length }) }));
            return false;
        }
        if (!isValidIndianPhone(form.phone)) {
            setErrors((prev) => ({ ...prev, phone: t("validation.phoneStart") }));
            return false;
        }
        setErrors((prev) => ({ ...prev, phone: "" }));
        return true;
    };

    // Validate email
    const validateEmail = () => {
        if (form.email && !isValidEmail(form.email)) {
            setErrors((prev) => ({ ...prev, email: t("validation.invalidEmail") }));
            return false;
        }
        setErrors((prev) => ({ ...prev, email: "" }));
        return true;
    };

    const handleSubmit = async () => {
        // Validate all fields
        const nameValid = validateName();
        const phoneValid = validatePhone();
        const emailValid = validateEmail();

        if (!nameValid || !phoneValid || !emailValid) {
            addToast({
                type: "error",
                title: t("validation.fixErrors"),
                description: t("validation.checkFields")
            });
            return;
        }

        setLoading(true);
        try {
            // Check for duplicate phone
            const isPhoneDuplicate = await checkDuplicatePhone(form.phone);
            if (isPhoneDuplicate) {
                setErrors((prev) => ({ ...prev, phone: t("validation.customerExists") }));
                addToast({
                    type: "error",
                    title: t("validation.duplicatePhone"),
                    description: t("validation.duplicatePhoneDesc")
                });
                setLoading(false);
                return;
            }

            // Check for duplicate email (if email provided)
            if (form.email) {
                const isEmailDuplicate = await checkDuplicateEmail(form.email);
                if (isEmailDuplicate) {
                    setErrors((prev) => ({ ...prev, email: t("validation.emailExists") }));
                    addToast({
                        type: "error",
                        title: t("validation.duplicateEmail"),
                        description: t("validation.duplicateEmailDesc")
                    });
                    setLoading(false);
                    return;
                }
            }

            await onSubmit({
                name: form.name,
                phone: form.phone,
                email: form.email || undefined,
                address: form.address || undefined,
                notes: form.notes || undefined,
            });
        } catch (error) {
            if (error instanceof Error && error.message === "DUPLICATE_PHONE") {
                setErrors((prev) => ({ ...prev, phone: t("validation.customerExists") }));
                addToast({
                    type: "error",
                    title: t("validation.duplicatePhone"),
                    description: t("validation.duplicatePhoneCustomerDesc", "This mobile number is already used by another customer. Each customer must have a unique phone number."),
                });
            } else {
                addToast({ type: "error", title: t("validation.saveError") });
            }
        } finally {
            setLoading(false);
        }
    };

    // Compute phone error/helper text
    const getPhoneHelperText = () => {
        if (errors.phone) return errors.phone;
        if (phoneTouched && form.phone.length > 0 && form.phone.length < 10) {
            return `${form.phone.length}/10 digits`;
        }
        return "";
    };

    const phoneHasError = phoneTouched && form.phone.length > 0 && form.phone.length < 10;

    const isValid =
        form.name.trim() &&
        !/\d/.test(form.name) &&
        form.phone.length === 10 &&
        isValidIndianPhone(form.phone) &&
        !errors.phone &&
        !errors.email &&
        !errors.name;

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={isEdit ? t('customers.editCustomer') : t('customers.addCustomer')}
            size="sm"
            snapPoints={[0.8]}
        >
            <div className="space-y-4">
                <LTextInput
                    label={t('customer.name')}
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={validateName}
                    placeholder={t('customers.namePlaceholder')}
                    required
                    error={errors.name}
                />

                <LPhoneInput
                    label={t('customer.phone')}
                    value={form.phone}
                    onValueChange={(v) => {
                        setForm({ ...form, phone: v });
                        setPhoneTouched(true);
                        // Validate when 10 digits reached
                        if (v.length === 10) {
                            if (!isValidIndianPhone(v)) {
                                setErrors((prev) => ({ ...prev, phone: t("validation.phoneStart") }));
                            } else {
                                setErrors((prev) => ({ ...prev, phone: "" }));
                            }
                        } else {
                            setErrors((prev) => ({ ...prev, phone: "" }));
                        }
                    }}
                    error={phoneHasError ? getPhoneHelperText() : errors.phone}
                    helperText={!phoneHasError && !errors.phone && phoneTouched && form.phone.length < 10
                        ? t("validation.digitsEntered", { count: form.phone.length })
                        : undefined}
                />

                <LTextInput
                    label={t('customers.emailOptional')}
                    value={form.email}
                    onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    onBlur={validateEmail}
                    placeholder="customer@example.com"
                    type="email"
                    error={errors.email}
                />

                <LTextArea
                    label={t('customers.addressOptional')}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder={t('customers.addressPlaceholder')}
                    minRows={2}
                />

                <LTextArea
                    label={t('customers.notesOptional')}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder={t('customers.notesPlaceholder')}
                    minRows={2}
                />

                <LSpacer size="md" />

                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={!isValid}
                >
                    {isEdit ? t('customers.saveChanges') : t('customers.addCustomer')}
                </LButton>
            </div>
        </LResponsiveDialog>
    );
}
