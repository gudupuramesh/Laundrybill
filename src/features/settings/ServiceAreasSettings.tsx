/**
 * Service Areas & Time Slots Settings Components
 * 
 * Exports individual list components for use in Inventory tabs.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import {
    LCard,
    LButton,
    LTextInput,
    LSelect,
    LToggle,
    LSpinner,
    LResponsiveDialog,
} from "@/components/laundry";
import type { LSelectOption } from "@/components/laundry";
import {
    MapPin,
    Clock,
    Truck,
    Plus,
    Trash2,
    Navigation,
    AlertTriangle,
    Pencil,
} from "lucide-react";

// 15-min time options from 6:00 AM to 10:00 PM for slot start/end
const SLOT_TIME_OPTIONS: LSelectOption[] = (() => {
    const opts: LSelectOption[] = [];
    for (let m = 6 * 60; m <= 22 * 60; m += 15) {
        const hour = Math.floor(m / 60);
        const min = m % 60;
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? "PM" : "AM";
        const label = `${hour12}:${min.toString().padStart(2, "0")} ${ampm}`;
        opts.push({ value: label, label });
    }
    return opts;
})();

function parseSlotValue(value: string): { start: string; end: string } | null {
    const match = value.match(/^(.+?)\s*-\s*(.+)$/);
    if (!match) return null;
    const start = match[1].trim();
    const end = match[2].trim();
    return start && end ? { start, end } : null;
}

function slotValueFromStartEnd(start: string, end: string): string {
    return `${start} - ${end}`;
}

// Service Areas List Component
export function ServiceAreasList() {
    const { t } = useTranslation();
    const {
        settings,
        loading,
        saving,
        addServiceArea,
        removeServiceArea,
        toggleServiceAreaItem,
    } = useDeliverySettings();

    const [newArea, setNewArea] = useState("");
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string } | null>(null);

    // Auto-detect shop location and get nearby area
    const handleDetectLocation = async () => {
        if (!navigator.geolocation) {
            alert(t("settings.geolocationNotSupported"));
            return;
        }

        setDetectingLocation(true);

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                });
            });

            const { latitude, longitude } = position.coords;

            // Use Google Geocoding API to get locality name
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
            );

            const data = await response.json();

            if (data.status === "OK" && data.results.length > 0) {
                // Extract best possible area name
                const result = data.results[0];
                let bestName = "";

                // Priority: Sublocality > Neighborhood > Route > Locality
                for (const component of result.address_components) {
                    if (component.types.includes("sublocality_level_1") || component.types.includes("sublocality")) {
                        bestName = component.long_name;
                        break; // Stop if we find sublocality
                    }
                    if (!bestName && component.types.includes("neighborhood")) {
                        bestName = component.long_name;
                    }
                    if (!bestName && component.types.includes("route")) {
                        bestName = component.long_name;
                    }
                    if (!bestName && component.types.includes("locality")) {
                        bestName = component.long_name;
                    }
                }

                if (bestName) {
                    if (!settings.serviceAreas.some(a => a.value === bestName)) {
                        await addServiceArea(bestName);
                    } else {
                        // Already exists
                    }
                } else {
                    alert(t("settings.couldNotDetectLocality"));
                }
            } else {
                alert(t("settings.geocodingFailed"));
            }
        } catch (err) {
            console.error("Error detecting location:", err);
            alert(t("settings.locationDetectionFailed"));
        } finally {
            setDetectingLocation(false);
        }
    };

    const handleAddArea = async () => {
        if (newArea.trim()) {
            await addServiceArea(newArea);
            setNewArea("");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <LSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* Service Areas (Always Enabled) */}
            {(
                <>
                    {/* Auto-detect button */}
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<Navigation className="h-4 w-4" />}
                        onClick={handleDetectLocation}
                        loading={detectingLocation}
                        className="mb-4"
                    >
                        {t("settings.detectMyLocation")}
                    </LButton>

                    {/* Add new area */}
                    <div className="flex gap-2 mb-4">
                        <LTextInput
                            value={newArea}
                            onChange={(e) => setNewArea(e.target.value)}
                            placeholder={t("settings.enterAreaName")}
                            onKeyDown={(e) => e.key === "Enter" && handleAddArea()}
                            className="flex-1 capitalize"
                        />
                        <LButton
                            variant="primary"
                            size="md"
                            leftIcon={<Plus className="h-4 w-4" />}
                            onClick={handleAddArea}
                            disabled={!newArea.trim() || saving}
                        >
                            {t("common.add")}
                        </LButton>
                    </div>
                </>
            )}

            {/* Area chips */}
            {(
                settings.serviceAreas.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {settings.serviceAreas.map((area) => (
                            <div
                                key={area.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${area.isActive
                                    ? 'bg-card border-border'
                                    : 'bg-muted/30 border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <LToggle
                                        checked={area.isActive}
                                        onChange={(val) => toggleServiceAreaItem(area.id, val)}
                                        disabled={saving}
                                    />
                                    <span className={`font-medium ${!area.isActive && 'text-muted-foreground line-through'}`}>
                                        {area.value}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setDeleteConfirm({ open: true, id: area.id, name: area.value })}
                                    className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                    disabled={saving}
                                    title="Remove area"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-lg border border-dashed border-border">
                        <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                            {t("settings.noAreasAdded")}
                        </p>
                    </div>
                )
            )}

            {/* Delete Confirmation Dialog */}
            <LResponsiveDialog
                open={!!deleteConfirm?.open}
                onClose={() => setDeleteConfirm(null)}
                title={t('common.delete')}
            >
                <div className="flex flex-col gap-4">
                    <div className="bg-destructive/10 p-4 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-destructive">
                                {t('common.warning')}
                            </p>
                            <p className="text-sm text-destructive/80">
                                {t('settings.deleteAreaWarning', 'Deleting "{{name}}" will remove it from your service area list permanently.', { name: deleteConfirm?.name })}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <LButton variant="outline" onClick={() => setDeleteConfirm(null)}>
                            {t('common.cancel')}
                        </LButton>
                        <LButton
                            variant="destructive"
                            onClick={() => {
                                if (deleteConfirm) {
                                    removeServiceArea(deleteConfirm.id);
                                    setDeleteConfirm(null);
                                }
                            }}
                        >
                            {t('common.delete')}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>
        </div>
    );
}

// Pickup Slots List Component
export function PickupSlotsList() {
    const { t } = useTranslation();
    const {
        settings,
        loading,
        saving,
        addPickupSlot,
        removePickupSlot,
        togglePickupSlotItem,
        updatePickupSlotCapacity,
        updatePickupSlotValue,
        updateSettings,
    } = useDeliverySettings();

    const [addStart, setAddStart] = useState("");
    const [addEnd, setAddEnd] = useState("");
    const [addCapacity, setAddCapacity] = useState<string>("");
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string } | null>(null);
    const [editSlot, setEditSlot] = useState<{ id: string; value: string; capacity?: number } | null>(null);
    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");
    const [editCapacity, setEditCapacity] = useState<string>("");

    const startIdxPickup = addStart ? SLOT_TIME_OPTIONS.findIndex((o) => o.value === addStart) : -1;
    const endOptionsPickup = startIdxPickup >= 0 ? SLOT_TIME_OPTIONS.filter((_, i) => i > startIdxPickup) : [];

    const handleAddPickupSlot = async () => {
        if (!addStart || !addEnd) return;
        const value = slotValueFromStartEnd(addStart, addEnd);
        const cap = addCapacity === "" ? undefined : parseInt(addCapacity, 10);
        if (cap !== undefined && (Number.isNaN(cap) || cap < 0)) return;
        await addPickupSlot(value, cap);
        setAddStart("");
        setAddEnd("");
        setAddCapacity("");
    };

    const openEdit = (slot: { id: string; value: string; capacity?: number }) => {
        const parsed = parseSlotValue(slot.value);
        if (parsed) {
            setEditSlot(slot);
            setEditStart(parsed.start);
            setEditEnd(parsed.end);
            setEditCapacity(slot.capacity != null ? String(slot.capacity) : "");
        }
    };

    const handleSaveEdit = async () => {
        if (!editSlot || !editStart || !editEnd) return;
        const value = slotValueFromStartEnd(editStart, editEnd);
        await updatePickupSlotValue(editSlot.id, value);
        const cap = editCapacity === "" ? undefined : parseInt(editCapacity, 10);
        if (cap !== undefined && !Number.isNaN(cap)) {
            await updatePickupSlotCapacity(editSlot.id, cap <= 0 ? undefined : cap);
        }
        setEditSlot(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <LSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* Auto-save note */}
            <p className="text-xs text-muted-foreground">
                {saving ? t("settings.saving", "Saving…") : t("settings.autoSaveNote", "Changes save automatically.")}
            </p>

            {/* Buffer: min minutes before slot start to allow booking */}
            <div className="p-3 rounded-lg border border-border bg-muted/20">
                <label className="block text-sm font-medium text-foreground mb-1">
                    {t("settings.bufferBeforeSlot", "Buffer (minutes) before slot")}
                </label>
                <input
                    type="number"
                    min={0}
                    value={settings.bufferMinutes ?? 0}
                    onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        updateSettings({ bufferMinutes: Number.isNaN(v) ? 0 : Math.max(0, v) });
                    }}
                    className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                    disabled={saving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                    {t("settings.bufferBeforeSlotHint", "e.g. 30 = user cannot book 9–10 AM slot after 8:30 AM")}
                </p>
            </div>

            {/* Add new slot: start, end dropdowns + capacity, then Save */}
            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-3">
                <p className="text-sm font-medium text-foreground">{t("settings.addSlot", "Add time slot")}</p>
                <div className="flex flex-wrap items-end gap-2">
                    <LSelect
                        label={t("settings.slotStart", "Start time")}
                        value={addStart}
                        onChange={setAddStart}
                        options={SLOT_TIME_OPTIONS}
                        placeholder={t("settings.selectStart", "Select start")}
                        className="min-w-[120px]"
                    />
                    <LSelect
                        label={t("settings.slotEnd", "End time")}
                        value={addEnd}
                        onChange={setAddEnd}
                        options={endOptionsPickup}
                        placeholder={t("settings.selectEnd", "Select end")}
                        disabled={!addStart}
                        className="min-w-[120px]"
                    />
                    <div className="min-w-[100px]">
                        <label className="block text-sm font-medium text-foreground mb-1">{t("settings.capacity", "Capacity")}</label>
                        <input
                            type="number"
                            min={0}
                            placeholder={t("settings.unlimited", "Unlimited")}
                            value={addCapacity}
                            onChange={(e) => setAddCapacity(e.target.value.replace(/\D/g, ""))}
                            className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground"
                            disabled={saving}
                        />
                    </div>
                    <LButton
                        variant="primary"
                        size="md"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={handleAddPickupSlot}
                        disabled={!addStart || !addEnd || saving}
                    >
                        {t("common.save")}
                    </LButton>
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.capacityHint", "Max orders per day for this slot; leave empty for unlimited")}</p>
            </div>

            {/* Slot chips */}
            {(
                settings.pickupTimeSlots.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {settings.pickupTimeSlots.map((slot) => (
                            <div
                                key={slot.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${slot.isActive
                                    ? 'bg-card border-border'
                                    : 'bg-muted/30 border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3 flex-wrap">
                                    <LToggle
                                        checked={slot.isActive}
                                        onChange={(val) => togglePickupSlotItem(slot.id, val)}
                                        disabled={saving}
                                    />
                                    <Clock className={`h-4 w-4 shrink-0 ${slot.isActive ? 'text-success' : 'text-muted-foreground'}`} />
                                    <span className={`font-medium shrink-0 ${!slot.isActive && 'text-muted-foreground line-through'}`}>
                                        {slot.value}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">{t("settings.capacity", "Capacity")}:</span>
                                    <span className="text-sm text-muted-foreground">{slot.capacity != null ? slot.capacity : t("settings.unlimited", "Unlimited")}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => openEdit(slot)}
                                        className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-colors"
                                        disabled={saving}
                                        title={t("common.edit", "Edit")}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm({ open: true, id: slot.id, name: slot.value })}
                                        className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                        disabled={saving}
                                        title="Remove slot"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-lg border border-dashed border-border">
                        <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                            {t("settings.noSlotsAdded")}
                        </p>
                    </div>
                )
            )}

            {/* Edit slot dialog */}
            <LResponsiveDialog
                open={!!editSlot}
                onClose={() => setEditSlot(null)}
                title={t("settings.editSlot", "Edit slot")}
            >
                <div className="space-y-4">
                    <LSelect
                        label={t("settings.slotStart", "Start time")}
                        value={editStart}
                        onChange={setEditStart}
                        options={SLOT_TIME_OPTIONS}
                    />
                    <LSelect
                        label={t("settings.slotEnd", "End time")}
                        value={editEnd}
                        onChange={setEditEnd}
                        options={(() => {
                            const idx = SLOT_TIME_OPTIONS.findIndex((o) => o.value === editStart);
                            return idx >= 0 ? SLOT_TIME_OPTIONS.filter((_, i) => i > idx) : [];
                        })()}
                    />
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t("settings.capacity", "Capacity")}</label>
                        <input
                            type="number"
                            min={0}
                            placeholder={t("settings.unlimited", "Unlimited")}
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(e.target.value.replace(/\D/g, ""))}
                            className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground"
                        />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <LButton variant="outline" onClick={() => setEditSlot(null)}>{t("common.cancel")}</LButton>
                        <LButton variant="primary" onClick={handleSaveEdit} disabled={!editStart || !editEnd || saving}>
                            {t("common.save")}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>

            {/* Delete Confirmation Dialog */}
            <LResponsiveDialog
                open={!!deleteConfirm?.open}
                onClose={() => setDeleteConfirm(null)}
                title={t('common.delete')}
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        {t('settings.deleteSlotWarning', 'Slot "{{name}}" will be removed permanently.', { name: deleteConfirm?.name })}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <LButton variant="outline" onClick={() => setDeleteConfirm(null)}>
                            {t('common.cancel')}
                        </LButton>
                        <LButton
                            variant="destructive"
                            onClick={() => {
                                if (deleteConfirm) {
                                    removePickupSlot(deleteConfirm.id);
                                    setDeleteConfirm(null);
                                }
                            }}
                        >
                            {t('common.delete')}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>
        </div>
    );
}

// Delivery Slots List Component
export function DeliverySlotsList() {
    const { t } = useTranslation();
    const {
        settings,
        loading,
        saving,
        addDeliverySlot,
        removeDeliverySlot,
        toggleDeliverySlotItem,
        updateDeliverySlotCapacity,
        updateDeliverySlotValue,
        updateSettings,
    } = useDeliverySettings();

    const [addStart, setAddStart] = useState("");
    const [addEnd, setAddEnd] = useState("");
    const [addCapacity, setAddCapacity] = useState<string>("");
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string } | null>(null);
    const [editSlot, setEditSlot] = useState<{ id: string; value: string; capacity?: number } | null>(null);
    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");
    const [editCapacity, setEditCapacity] = useState<string>("");

    const startIdxDelivery = addStart ? SLOT_TIME_OPTIONS.findIndex((o) => o.value === addStart) : -1;
    const endOptionsDelivery = startIdxDelivery >= 0 ? SLOT_TIME_OPTIONS.filter((_, i) => i > startIdxDelivery) : [];

    const handleAddDeliverySlot = async () => {
        if (!addStart || !addEnd) return;
        const value = slotValueFromStartEnd(addStart, addEnd);
        const cap = addCapacity === "" ? undefined : parseInt(addCapacity, 10);
        if (cap !== undefined && (Number.isNaN(cap) || cap < 0)) return;
        await addDeliverySlot(value, cap);
        setAddStart("");
        setAddEnd("");
        setAddCapacity("");
    };

    const openEditDelivery = (slot: { id: string; value: string; capacity?: number }) => {
        const parsed = parseSlotValue(slot.value);
        if (parsed) {
            setEditSlot(slot);
            setEditStart(parsed.start);
            setEditEnd(parsed.end);
            setEditCapacity(slot.capacity != null ? String(slot.capacity) : "");
        }
    };

    const handleSaveEditDelivery = async () => {
        if (!editSlot || !editStart || !editEnd) return;
        const value = slotValueFromStartEnd(editStart, editEnd);
        await updateDeliverySlotValue(editSlot.id, value);
        const cap = editCapacity === "" ? undefined : parseInt(editCapacity, 10);
        if (cap !== undefined && !Number.isNaN(cap)) {
            await updateDeliverySlotCapacity(editSlot.id, cap <= 0 ? undefined : cap);
        }
        setEditSlot(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <LSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* Auto-save note */}
            <p className="text-xs text-muted-foreground">
                {saving ? t("settings.saving", "Saving…") : t("settings.autoSaveNote", "Changes save automatically.")}
            </p>

            {/* Buffer: shared with pickup; same setting */}
            <div className="p-3 rounded-lg border border-border bg-muted/20">
                <label className="block text-sm font-medium text-foreground mb-1">
                    {t("settings.bufferBeforeSlot", "Buffer (minutes) before slot")}
                </label>
                <input
                    type="number"
                    min={0}
                    value={settings.bufferMinutes ?? 0}
                    onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        updateSettings({ bufferMinutes: Number.isNaN(v) ? 0 : Math.max(0, v) });
                    }}
                    className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                    disabled={saving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                    {t("settings.bufferBeforeSlotHint", "e.g. 30 = user cannot book 9–10 AM slot after 8:30 AM")}
                </p>
            </div>

            {/* Add new slot: start, end dropdowns + capacity, then Save */}
            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-3">
                <p className="text-sm font-medium text-foreground">{t("settings.addSlot", "Add time slot")}</p>
                <div className="flex flex-wrap items-end gap-2">
                    <LSelect
                        label={t("settings.slotStart", "Start time")}
                        value={addStart}
                        onChange={setAddStart}
                        options={SLOT_TIME_OPTIONS}
                        placeholder={t("settings.selectStart", "Select start")}
                        className="min-w-[120px]"
                    />
                    <LSelect
                        label={t("settings.slotEnd", "End time")}
                        value={addEnd}
                        onChange={setAddEnd}
                        options={endOptionsDelivery}
                        placeholder={t("settings.selectEnd", "Select end")}
                        disabled={!addStart}
                        className="min-w-[120px]"
                    />
                    <div className="min-w-[100px]">
                        <label className="block text-sm font-medium text-foreground mb-1">{t("settings.capacity", "Capacity")}</label>
                        <input
                            type="number"
                            min={0}
                            placeholder={t("settings.unlimited", "Unlimited")}
                            value={addCapacity}
                            onChange={(e) => setAddCapacity(e.target.value.replace(/\D/g, ""))}
                            className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground"
                            disabled={saving}
                        />
                    </div>
                    <LButton
                        variant="primary"
                        size="md"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={handleAddDeliverySlot}
                        disabled={!addStart || !addEnd || saving}
                    >
                        {t("common.save")}
                    </LButton>
                </div>
                <p className="text-xs text-muted-foreground">{t("settings.capacityHint", "Max orders per day for this slot; leave empty for unlimited")}</p>
            </div>

            {/* Slot chips */}
            {(
                settings.deliveryTimeSlots.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {settings.deliveryTimeSlots.map((slot) => (
                            <div
                                key={slot.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${slot.isActive
                                    ? 'bg-card border-border'
                                    : 'bg-muted/30 border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3 flex-wrap">
                                    <LToggle
                                        checked={slot.isActive}
                                        onChange={(val) => toggleDeliverySlotItem(slot.id, val)}
                                        disabled={saving}
                                    />
                                    <Clock className={`h-4 w-4 shrink-0 ${slot.isActive ? 'text-warning' : 'text-muted-foreground'}`} />
                                    <span className={`font-medium shrink-0 ${!slot.isActive && 'text-muted-foreground line-through'}`}>
                                        {slot.value}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">{t("settings.capacity", "Capacity")}:</span>
                                    <span className="text-sm text-muted-foreground">{slot.capacity != null ? slot.capacity : t("settings.unlimited", "Unlimited")}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => openEditDelivery(slot)}
                                        className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-colors"
                                        disabled={saving}
                                        title={t("common.edit", "Edit")}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm({ open: true, id: slot.id, name: slot.value })}
                                        className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                        disabled={saving}
                                        title="Remove slot"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-lg border border-dashed border-border">
                        <Truck className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                            {t("settings.noSlotsAdded")}
                        </p>
                    </div>
                )
            )}

            {/* Edit slot dialog */}
            <LResponsiveDialog
                open={!!editSlot}
                onClose={() => setEditSlot(null)}
                title={t("settings.editSlot", "Edit slot")}
            >
                <div className="space-y-4">
                    <LSelect
                        label={t("settings.slotStart", "Start time")}
                        value={editStart}
                        onChange={setEditStart}
                        options={SLOT_TIME_OPTIONS}
                    />
                    <LSelect
                        label={t("settings.slotEnd", "End time")}
                        value={editEnd}
                        onChange={setEditEnd}
                        options={(() => {
                            const idx = SLOT_TIME_OPTIONS.findIndex((o) => o.value === editStart);
                            return idx >= 0 ? SLOT_TIME_OPTIONS.filter((_, i) => i > idx) : [];
                        })()}
                    />
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">{t("settings.capacity", "Capacity")}</label>
                        <input
                            type="number"
                            min={0}
                            placeholder={t("settings.unlimited", "Unlimited")}
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(e.target.value.replace(/\D/g, ""))}
                            className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground"
                        />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <LButton variant="outline" onClick={() => setEditSlot(null)}>{t("common.cancel")}</LButton>
                        <LButton variant="primary" onClick={handleSaveEditDelivery} disabled={!editStart || !editEnd || saving}>
                            {t("common.save")}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>

            {/* Delete Confirmation Dialog */}
            <LResponsiveDialog
                open={!!deleteConfirm?.open}
                onClose={() => setDeleteConfirm(null)}
                title={t('common.delete')}
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        {t('settings.deleteSlotWarning', 'Slot "{{name}}" will be removed permanently.', { name: deleteConfirm?.name })}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <LButton variant="outline" onClick={() => setDeleteConfirm(null)}>
                            {t('common.cancel')}
                        </LButton>
                        <LButton
                            variant="destructive"
                            onClick={() => {
                                if (deleteConfirm) {
                                    removeDeliverySlot(deleteConfirm.id);
                                    setDeleteConfirm(null);
                                }
                            }}
                        >
                            {t('common.delete')}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>
        </div>
    );
}

// Backward compatibility or default export if needed
export function ServiceAreasSettings() {
    return (
        <div className="space-y-8">
            <LCard variant="outlined" padding="lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Service Areas</h3>
                        <p className="text-sm text-muted-foreground">Manage service areas</p>
                    </div>
                </div>
                <ServiceAreasList />
            </LCard>

            <LCard variant="outlined" padding="lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-success" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Pickup Time Slots</h3>
                        <p className="text-sm text-muted-foreground">Manage pickup time slots</p>
                    </div>
                </div>
                <PickupSlotsList />
            </LCard>

            <LCard variant="outlined" padding="lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                        <Truck className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Delivery Time Slots</h3>
                        <p className="text-sm text-muted-foreground">Manage delivery time slots</p>
                    </div>
                </div>
                <DeliverySlotsList />
            </LCard>
        </div>
    );
}
