/**
 * Customer Form Sheet
 * 
 * Add/edit customer form in responsive dialog
 * With validation feedback and duplicate checking
 */

import { useState, useEffect, type CSSProperties } from "react";
import {
    collection,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { LResponsiveDialog, useLToast } from "@/components/laundry";
import type { Customer } from "@/types/customer";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import { useShop } from "@/hooks/use-shop";
import { getCountry } from "@/config/countries";
import { useTranslation } from "react-i18next";
import { isValidEmail, normalizePhone } from "@/lib/utils";

const MONO = "'IBM Plex Mono'";
const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };
const errTxt: CSSProperties = { fontSize: 11.5, color: "var(--c-error)", marginTop: 5 };

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
    const { settings } = useDeliverySettings();
    const { shop } = useShop();
    const country = getCountry(shop?.settings?.countryCode || "IN");
    const phoneDigits = country.phoneDigits;
    const areaOptions = (settings.serviceAreas || []).filter((a) => a.isActive);
    const useAreaDropdown = settings.enableServiceAreas && areaOptions.length > 0;
    const [form, setForm] = useState({
        name: "",
        phone: "",
        email: "",
        address: "",
        area: "",
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
                area: customer.area || "",
                notes: customer.notes || "",
            });
        } else {
            setForm({
                name: "",
                phone: "",
                email: "",
                address: "",
                area: "",
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
        if (form.phone.length < phoneDigits) {
            setErrors((prev) => ({ ...prev, phone: t("validation.digitsEntered", { count: form.phone.length }) }));
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
                area: form.area || undefined,
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
        if (phoneTouched && form.phone.length > 0 && form.phone.length < phoneDigits) {
            return `${form.phone.length}/${phoneDigits} digits`;
        }
        return "";
    };

    const phoneHasError = phoneTouched && form.phone.length > 0 && form.phone.length < phoneDigits;

    const isValid =
        form.name.trim() &&
        !/\d/.test(form.name) &&
        form.phone.length === phoneDigits &&
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Name */}
                <div>
                    <label style={lbl}>{t('customer.name', 'Customer Name')}</label>
                    <input value={form.name} onChange={(e) => handleNameChange(e.target.value)} onBlur={validateName} placeholder={t('customers.namePlaceholder', 'e.g. Priya Sharma')}
                        style={{ ...fld, borderColor: errors.name ? "var(--c-error)" : "var(--c-border-strong)" }} />
                    {errors.name && <div style={errTxt}>{errors.name}</div>}
                </div>

                {/* Phone */}
                <div>
                    <label style={lbl}>{t('customer.phone', 'Phone Number')}</label>
                    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${(phoneHasError || errors.phone) ? "var(--c-error)" : "var(--c-border-strong)"}`, borderRadius: 9, background: "var(--c-surface)" }}>
                        <span style={{ fontFamily: MONO, fontSize: 13.5, color: "var(--c-text-3)", paddingLeft: 12 }}>{country.phoneCode}</span>
                        <input value={form.phone} inputMode="numeric" placeholder={"0".repeat(phoneDigits)}
                            onChange={(e) => { setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, phoneDigits) }); setPhoneTouched(true); setErrors((prev) => ({ ...prev, phone: "" })); }}
                            style={{ ...fld, border: 0, fontFamily: MONO, paddingLeft: 8, background: "transparent" }} />
                    </div>
                    {(phoneHasError || errors.phone) && <div style={errTxt}>{getPhoneHelperText()}</div>}
                </div>

                {/* Email */}
                <div>
                    <label style={lbl}>{t('customers.emailOptional', 'Email (optional)')}</label>
                    <input type="email" value={form.email} onBlur={validateEmail} placeholder="customer@example.com"
                        onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors((prev) => ({ ...prev, email: "" })); }}
                        style={{ ...fld, borderColor: errors.email ? "var(--c-error)" : "var(--c-border-strong)" }} />
                    {errors.email && <div style={errTxt}>{errors.email}</div>}
                </div>

                {/* Address */}
                <div>
                    <label style={lbl}>{t('customers.addressOptional', 'Address (optional)')}</label>
                    <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t('customers.addressPlaceholder', 'Flat / building, street, city, ZIP')}
                        style={{ ...fld, resize: "vertical" }} />
                </div>

                {/* Area */}
                <div>
                    <label style={lbl}>{t('checkout.serviceArea', 'Area (optional)')}</label>
                    {useAreaDropdown ? (
                        <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} style={fld}>
                            <option value="">{t('customer.selectArea', 'Select area')}</option>
                            {areaOptions.map((a) => <option key={a.value} value={a.value}>{a.value}</option>)}
                        </select>
                    ) : (
                        <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder={t('customer.areaPlaceholder', 'Locality / area')} style={fld} />
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label style={lbl}>{t('customers.notesOptional', 'Notes (optional)')}</label>
                    <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('customers.notesPlaceholder', 'Any special preferences or notes')}
                        style={{ ...fld, resize: "vertical" }} />
                </div>

                <button type="button" onClick={handleSubmit} disabled={!isValid || loading}
                    style={{ width: "100%", marginTop: 4, cursor: (!isValid || loading) ? "not-allowed" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: (!isValid || loading) ? 0.55 : 1 }}>
                    {loading ? t('common.loading', 'Saving…') : isEdit ? t('customers.saveChanges', 'Save Changes') : t('customers.addCustomer', 'Add Customer')}
                </button>
            </div>
        </LResponsiveDialog>
    );
}
