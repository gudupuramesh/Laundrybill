/**
 * Staff Detail Panel
 * 
 * Used within master-detail layout on desktop
 * Displays full staff details inline
 */

import { useState, useMemo } from "react";
import {
    LCard,
    LButton,
    LAvatar,
    LAmount,
    LBadge,
    LSpinner,
    LActionSheet,
    LDateDisplay,
    LToggle,
} from "@/components/laundry";
import { useStaff, useStaffMutations, useAttendance, usePayroll } from "@/hooks/use-staff";
import { StaffFormSheet } from "./StaffFormSheet";
import {
    ArrowLeft,
    MoreVertical,
    Phone,
    MessageCircle,
    Edit,
    Trash2,
    Shield,
    Calendar,
    Wallet,
    Check,
    X,
    Clock,
    Truck,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";

interface StaffDetailPanelProps {
    staffId: string;
    onClose?: () => void;
}

export function StaffDetailPanel({ staffId, onClose }: StaffDetailPanelProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const { staff: staffList, loading } = useStaff();
    const { updateStaff, deactivateStaff } = useStaffMutations();
    const { getStaffSummary } = useAttendance(new Date());
    const { payroll } = usePayroll(format(new Date(), "yyyy-MM"));

    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [actionSheetOpen, setActionSheetOpen] = useState(false);

    // Find the staff member
    const staff = useMemo(() =>
        staffList.find((s) => s.id === staffId),
        [staffList, staffId]
    );

    // Get attendance summary for this staff
    const attendanceSummary = useMemo(() =>
        getStaffSummary(staffId),
        [getStaffSummary, staffId]
    );

    // Get payroll for this staff
    const staffPayroll = useMemo(() =>
        payroll.find((p) => p.staffId === staffId),
        [payroll, staffId]
    );

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium">{t('staff.notFound')}</p>
                <LButton variant="ghost" className="mt-4" onClick={onClose}>
                    {t('common.goBack')}
                </LButton>
            </div>
        );
    }

    const handleUpdateStaff = async (data: any) => {
        await updateStaff(staff.id, data);
        setEditSheetOpen(false);
    };

    const handleDeactivate = async () => {
        await deactivateStaff(staff.id);
        setActionSheetOpen(false);
    };

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        {onClose && (
                            <LButton variant="ghost" size="icon-sm" onClick={onClose}>
                                <ArrowLeft className="h-5 w-5" />
                            </LButton>
                        )}
                        <LAvatar name={staff.name} size="xl" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-foreground">{staff.name}</h1>
                                {staff.role === "admin" && (
                                    <Shield className="h-4 w-4 text-primary" />
                                )}
                            </div>
                            <p className="text-muted-foreground">{staff.phone}</p>
                            <LBadge
                                variant={staff.isActive ? "success" : "destructive"}
                                size="sm"
                                className="mt-1"
                            >
                                {staff.isActive ? t('common.active') : t('staff.inactive')}
                            </LBadge>
                            {/* Agent Badge */}
                            {staff.memberType === 'agent' && (
                                <LBadge variant="default" size="sm" className="mt-1 ml-1">
                                    <Truck className="h-3 w-3 mr-1" />
                                    {t('staff.deliveryAgent', 'Delivery Agent')}
                                </LBadge>
                            )}
                        </div>
                    </div>
                    <LButton
                        variant="ghost"
                        size="icon"
                        onClick={() => setActionSheetOpen(true)}
                    >
                        <MoreVertical className="h-5 w-5" />
                    </LButton>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
                {/* Quick Actions */}
                <div className="flex gap-2">
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<Phone className="h-4 w-4" />}
                        onClick={() => window.open(`tel:${staff.phone}`)}
                    >
                        {t('common.call')}
                    </LButton>
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<MessageCircle className="h-4 w-4" />}
                        onClick={() => window.open(`https://wa.me/91${staff.phone}`)}
                    >
                        WhatsApp
                    </LButton>
                    <LButton
                        variant="primary"
                        size="sm"
                        leftIcon={<Edit className="h-4 w-4" />}
                        onClick={() => setEditSheetOpen(true)}
                    >
                        {t('staff.editStaff')}
                    </LButton>
                </div>

                {/* Contact Info */}
                <LCard variant="outlined" padding="md">
                    <h3 className="font-semibold text-foreground mb-3">{t('staff.contactDetails', 'Contact Details')}</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">{t('staff.mobile', 'Mobile')}</p>
                                <p className="font-medium text-foreground">{staff.phone}</p>
                            </div>
                        </div>
                        {staff.email && (
                            <div className="flex items-center gap-3">
                                <div className="h-4 w-4 flex items-center justify-center">
                                    <span className="text-muted-foreground text-xs">@</span>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('staff.emailOptional', 'Email')}</p>
                                    <p className="font-medium text-foreground">{staff.email}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </LCard>

                {/* Salary Info */}
                <LCard variant="filled" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">{t('staff.payType')}</p>
                            <p className="font-medium text-foreground capitalize">
                                {t(`staff.${staff.payType}`, staff.payType)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                                {staff.payType === "monthly" ? t('staff.monthlySalary') : t('staff.dailyWage')}
                            </p>
                            <LAmount value={staff.baseSalary} size="xl" />
                        </div>
                    </div>
                </LCard>

                {/* Agent Online Toggle & Vehicle Info */}
                {staff.memberType === 'agent' && (
                    <LCard variant="filled" padding="md" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Truck className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-800 dark:text-green-200">
                                    {t('staff.agentStatus', 'Agent Status')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${staff.isOnline ? 'text-green-700 dark:text-green-300' : 'text-gray-500'}`}>
                                    {staff.isOnline ? t('staff.online', 'Online') : t('staff.offline', 'Offline')}
                                </span>
                                <LToggle
                                    checked={staff.isOnline ?? false}
                                    onChange={async (checked) => {
                                        await updateStaff(staff.id, { isOnline: checked });
                                    }}
                                />
                            </div>
                        </div>
                        {staff.vehicle && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('staff.vehicle', 'Vehicle')}</span>
                                <span className="font-medium capitalize">
                                    {staff.vehicle.type}{staff.vehicle.number ? ` - ${staff.vehicle.number}` : ''}
                                </span>
                            </div>
                        )}
                        {staff.serviceAreas && staff.serviceAreas.length > 0 && (
                            <div className="text-sm">
                                <span className="text-muted-foreground block mb-2">{t('staff.serviceAreas', 'Service Areas')}</span>
                                <div className="flex flex-wrap gap-1">
                                    {staff.serviceAreas.map((area, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-full text-xs">
                                            {area}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {staff.stats && (
                            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                                        {staff.stats.totalPickups}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{t('staff.pickups', 'Pickups')}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                                        {staff.stats.totalDeliveries}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{t('staff.deliveries', 'Deliveries')}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-green-800 dark:text-green-200">
                                        {formatAmount(staff.stats.totalCollected)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{t('staff.collected', 'Collected')}</p>
                                </div>
                            </div>
                        )}
                    </LCard>
                )}

                {/* Attendance Summary */}
                <LCard variant="outlined" padding="md">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">{t('staff.attendance')} - {format(new Date(), "MMMM yyyy")}</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                            <div className="flex items-center justify-center gap-1 text-success">
                                <Check className="h-4 w-4" />
                                <span className="text-xl font-bold">{attendanceSummary.present}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('staff.present')}</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-center gap-1 text-destructive">
                                <X className="h-4 w-4" />
                                <span className="text-xl font-bold">{attendanceSummary.absent}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('staff.absent')}</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-center gap-1 text-warning">
                                <Clock className="h-4 w-4" />
                                <span className="text-xl font-bold">{attendanceSummary.half}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('staff.halfDay')}</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-center gap-1 text-primary">
                                <Calendar className="h-4 w-4" />
                                <span className="text-xl font-bold">{attendanceSummary.leave}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('staff.leave')}</p>
                        </div>
                    </div>
                </LCard>

                {/* Staff App Access */}
                <LCard variant="outlined" padding="md">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">{t('staff.appAccess')}</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">{t('staff.inviteCode')}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-lg tracking-wider text-primary">
                                    {staff.inviteCode || "N/A"}
                                </span>
                                {staff.inviteCode && (
                                    <button
                                        onClick={() => staff.inviteCode && navigator.clipboard.writeText(staff.inviteCode)}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        {t('common.copy')}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">{t('staff.status')}</span>
                            <LBadge
                                variant={staff.inviteStatus === 'accepted' ? "success" : "warning"}
                                size="sm"
                            >
                                {staff.inviteStatus === 'accepted'
                                    ? t('staff.inviteAccepted')
                                    : t('staff.invitePending')}
                            </LBadge>
                        </div>
                    </div>
                </LCard>

                {/* Payroll Info */}
                {staffPayroll && (
                    <LCard variant="outlined" padding="md">
                        <div className="flex items-center gap-2 mb-3">
                            <Wallet className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold text-foreground">{t('staff.payroll')} - {format(new Date(), "MMMM yyyy")}</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('staff.daysWorked')}</span>
                                <span className="font-medium">{staffPayroll.daysWorked}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('orders.total')}</span>
                                <LAmount value={staffPayroll.netSalary} size="md" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t('staff.status')}</span>
                                <LBadge variant={staffPayroll.status === "paid" ? "success" : "warning"} size="sm">
                                    {staffPayroll.status === "paid" ? t('staff.paid') : t('staff.pending')}
                                </LBadge>
                            </div>
                        </div>
                    </LCard>
                )}

                {/* Bank Details */}
                {(staff.bankDetails?.bankName || staff.bankDetails?.accountNumber) && (
                    <LCard variant="outlined" padding="md">
                        <h3 className="font-semibold text-foreground mb-3">{t('staff.bankDetails')}</h3>
                        <div className="space-y-2 text-sm">
                            {staff.bankDetails?.bankName && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('staff.bankName')}</span>
                                    <span className="font-medium">{staff.bankDetails.bankName}</span>
                                </div>
                            )}
                            {staff.bankDetails?.accountNumber && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('staff.accountNumber')}</span>
                                    <span className="font-medium font-mono">{staff.bankDetails.accountNumber}</span>
                                </div>
                            )}
                            {staff.bankDetails?.ifscCode && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('staff.ifscCode')}</span>
                                    <span className="font-medium font-mono">{staff.bankDetails.ifscCode}</span>
                                </div>
                            )}
                        </div>
                    </LCard>
                )}

                {/* Join Date */}
                <LCard variant="filled" padding="md">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('staff.joinDate')}</span>
                        <LDateDisplay date={staff.joiningDate?.toDate ? staff.joiningDate.toDate() : new Date()} format="date" />
                    </div>
                </LCard>
            </div>

            {/* Sheets */}
            <StaffFormSheet
                open={editSheetOpen}
                onClose={() => setEditSheetOpen(false)}
                staff={staff}
                onSubmit={handleUpdateStaff}
            />

            <LActionSheet
                open={actionSheetOpen}
                onClose={() => setActionSheetOpen(false)}
                title={staff.name}
                actions={[
                    {
                        id: "edit",
                        label: t('staff.editStaff'),
                        icon: <Edit className="h-5 w-5" />,
                        onClick: () => { setActionSheetOpen(false); setEditSheetOpen(true); }
                    },
                    {
                        id: "call",
                        label: t('common.call'),
                        icon: <Phone className="h-5 w-5" />,
                        onClick: () => window.open(`tel:${staff.phone}`)
                    },
                    {
                        id: "whatsapp",
                        label: "WhatsApp",
                        icon: <MessageCircle className="h-5 w-5" />,
                        onClick: () => window.open(`https://wa.me/91${staff.phone}`)
                    },
                    {
                        id: "deactivate",
                        label: staff.isActive ? t('staff.deactivate') : t('staff.activate'),
                        icon: <Trash2 className="h-5 w-5" />,
                        destructive: staff.isActive,
                        onClick: handleDeactivate
                    },
                ]}
            />
        </div>
    );
}
