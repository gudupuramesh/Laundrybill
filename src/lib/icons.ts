/**
 * Laundrybill icon system — ONE Lucide icon per concept, shared by every screen.
 * Generated from the design-system inventory; edit the inventory, not this file.
 *
 * Rules: stroke 1.75 everywhere (2 at 14px), sizes by context —
 *   nav 20 · section 18 · tile 18 (white on a 42px tile) · attention 18 (in a 40px soft circle)
 *   · action 16 · chip 14 · feature 22. Grey #6B7280 by default, blue #2563EB when active.
 */
import { createElement, type ComponentProps } from "react";
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BadgePercent, Ban, Banknote, BanknoteArrowUp, Barcode, Bell, Bike, BookOpen, Building2, Calendar, CalendarCheck, CalendarClock, CalendarDays, CalendarOff, CalendarPlus, CalendarX, Camera, Car, ChartColumn, ChartLine, ChartPie, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleDashed, CircleEllipsis, CircleHelp, CirclePause, CircleX, ClipboardList, Clock, ClockAlert, Cloud, Coins, Contrast, Copy, CopyPlus, CreditCard, Crown, Download, EllipsisVertical, ExternalLink, Eye, EyeOff, Factory, FileDown, FileText, Flashlight, Footprints, Gift, Globe, GripVertical, HandCoins, Hash, History, Home, Hourglass, Image, IndianRupee, KeyRound, Landmark, Languages, Laptop, Layers, LayoutDashboard, LayoutGrid, LayoutTemplate, Link, ListChecks, ListFilter, ListPlus, Lock, LogIn, LogOut, Mail, MapPin, MapPinned, Megaphone, MessageCircle, MessageSquare, Minus, Navigation, Package, PackageCheck, PackageSearch, Paperclip, Pencil, Percent, Phone, PiggyBank, Plus, PlusCircle, Printer, QrCode, ReceiptText, Repeat, Rocket, RotateCcw, Route, ScanLine, Search, Send, Settings, Share2, Shield, ShieldAlert, ShieldCheck, Shirt, ShoppingBag, ShoppingCart, SlidersHorizontal, Smartphone, Sparkles, Star, StickyNote, Store, Tag, Trash2, TrendingDown, TrendingUp, TriangleAlert, Truck, Undo2, Upload, UserCog, UserPlus, UserRound, Users, Volume2, Wallet, WashingMachine, Webhook, Weight, Wrench, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ICON_SIZE = { nav: 20, section: 18, tile: 18, attention: 18, action: 16, chip: 14, feature: 22 } as const;
export const ICON_STROKE = 1.75;
export type IconContext = keyof typeof ICON_SIZE;

/** Concept → icon. Keys are "<screen>__<concept>" slugs. */
export const ICONS = {
    /** Sidebar & top bar · Dashboard (nav) */
    "sidebar_and_top_bar__dashboard": LayoutDashboard,
    /** Sidebar & top bar · New Order (nav) */
    "sidebar_and_top_bar__new_order": PlusCircle,
    /** Sidebar & top bar · Orders (nav) */
    "sidebar_and_top_bar__orders": ClipboardList,
    /** Sidebar & top bar · Customers (nav) */
    "sidebar_and_top_bar__customers": Users,
    /** Sidebar & top bar · Tags (nav) */
    "sidebar_and_top_bar__tags": Tag,
    /** Sidebar & top bar · Finances (nav) */
    "sidebar_and_top_bar__finances": Wallet,
    /** Sidebar & top bar · Reports (nav) */
    "sidebar_and_top_bar__reports": ChartColumn,
    /** Sidebar & top bar · Staff (nav) */
    "sidebar_and_top_bar__staff": UserCog,
    /** Sidebar & top bar · Services (nav) */
    "sidebar_and_top_bar__services": WashingMachine,
    /** Sidebar & top bar · Attendance (nav) */
    "sidebar_and_top_bar__attendance": CalendarCheck,
    /** Sidebar & top bar · Payroll (nav) */
    "sidebar_and_top_bar__payroll": HandCoins,
    /** Sidebar & top bar · Expenses (nav) */
    "sidebar_and_top_bar__expenses": ReceiptText,
    /** Sidebar & top bar · Apps (nav) */
    "sidebar_and_top_bar__apps": Smartphone,
    /** Sidebar & top bar · Subscription (nav) */
    "sidebar_and_top_bar__subscription": Crown,
    /** Sidebar & top bar · Offers (nav) */
    "sidebar_and_top_bar__offers": BadgePercent,
    /** Sidebar & top bar · Public booking page (nav) */
    "sidebar_and_top_bar__public_booking_page": Globe,
    /** Sidebar & top bar · Settings (nav) */
    "sidebar_and_top_bar__settings": Settings,
    /** Sidebar & top bar · Help (nav) */
    "sidebar_and_top_bar__help": CircleHelp,
    /** Sidebar & top bar · Sign out (action) */
    "sidebar_and_top_bar__sign_out": LogOut,
    /** Sidebar & top bar · Search (action) */
    "sidebar_and_top_bar__search": Search,
    /** Sidebar & top bar · Scan a tag (action) */
    "sidebar_and_top_bar__scan_a_tag": ScanLine,
    /** Sidebar & top bar · Today / date picker (action) */
    "sidebar_and_top_bar__today_date_picker": CalendarDays,
    /** Sidebar & top bar · Notifications (action) */
    "sidebar_and_top_bar__notifications": Bell,
    /** Sidebar & top bar · Branch switcher (action) */
    "sidebar_and_top_bar__branch_switcher": ChevronDown,
    /** Sidebar & top bar · Collapse sidebar (action) */
    "sidebar_and_top_bar__collapse_sidebar": ChevronLeft,
    /** Sidebar & top bar · Plan chip / PRO+ (chip) */
    "sidebar_and_top_bar__plan_chip_pro": Crown,
    /** Sidebar & top bar · Brand mark (tile) */
    "sidebar_and_top_bar__brand_mark": Shirt,
    /** Sidebar & top bar · Scan (sidebar) (nav) */
    "sidebar_and_top_bar__scan_sidebar": ScanLine,
    /** Dashboard · Today's revenue (tile:blue) */
    "dashboard__today_s_revenue": BanknoteArrowUp,
    /** Dashboard · Collected today (tile:green) */
    "dashboard__collected_today": Wallet,
    /** Dashboard · Outstanding (tile:orange) */
    "dashboard__outstanding": CircleAlert,
    /** Dashboard · Orders today (tile:violet) */
    "dashboard__orders_today": ClipboardList,
    /** Dashboard · Ready to hand over (tile:sky) */
    "dashboard__ready_to_hand_over": ShoppingBag,
    /** Dashboard · Trend up (chip) */
    "dashboard__trend_up": TrendingUp,
    /** Dashboard · Trend down (chip) */
    "dashboard__trend_down": TrendingDown,
    /** Dashboard · Overdue (attention:red) */
    "dashboard__overdue": ClockAlert,
    /** Dashboard · Due today (attention:amber) */
    "dashboard__due_today": CalendarClock,
    /** Dashboard · Online booking to confirm (attention:sky) */
    "dashboard__online_booking_to_confirm": Globe,
    /** Dashboard · Ready & unpaid (attention:teal) */
    "dashboard__ready_and_unpaid": CreditCard,
    /** Dashboard · Stage · Placed (chip) */
    "dashboard__stage_placed": Package,
    /** Dashboard · Stage · Processing (chip) */
    "dashboard__stage_processing": WashingMachine,
    /** Dashboard · Stage · Ready (chip) */
    "dashboard__stage_ready": CircleCheck,
    /** Dashboard · Stage · Out for delivery (chip) */
    "dashboard__stage_out_for_delivery": Truck,
    /** Dashboard · Stage · Delivered (chip) */
    "dashboard__stage_delivered": PackageCheck,
    /** Dashboard · Collect (action) */
    "dashboard__collect": Wallet,
    /** Dashboard · Print (action) */
    "dashboard__print": Printer,
    /** Dashboard · WhatsApp (action) */
    "dashboard__whatsapp": MessageCircle,
    /** Dashboard · View all (action) */
    "dashboard__view_all": ArrowRight,
    /** Dashboard · Collected vs revenue chart (section) */
    "dashboard__collected_vs_revenue_chart": ChartLine,
    /** Dashboard · Payment mix (section) */
    "dashboard__payment_mix": ChartPie,
    /** Dashboard · Top services (section) */
    "dashboard__top_services": Shirt,
    /** Dashboard · Team (section) */
    "dashboard__team": UserCog,
    /** Dashboard · Agent on route (chip) */
    "dashboard__agent_on_route": Route,
    /** Dashboard · Plant queue (chip) */
    "dashboard__plant_queue": Factory,
    /** Dashboard · Present today (chip) */
    "dashboard__present_today": CalendarCheck,
    /** Orders list · Filters drawer (action) */
    "orders_list__filters_drawer": ListFilter,
    /** Orders list · Period (action) */
    "orders_list__period": CalendarDays,
    /** Orders list · Shop pickup (chip) */
    "orders_list__shop_pickup": Store,
    /** Orders list · Home pickup (chip) */
    "orders_list__home_pickup": Home,
    /** Orders list · Home delivery (chip) */
    "orders_list__home_delivery": Truck,
    /** Orders list · Service type (chip) */
    "orders_list__service_type": Shirt,
    /** Orders list · Source · Online (chip) */
    "orders_list__source_online": Globe,
    /** Orders list · Source · Counter (chip) */
    "orders_list__source_counter": Laptop,
    /** Orders list · Payment status (chip) */
    "orders_list__payment_status": CreditCard,
    /** Orders list · Overdue view (chip) */
    "orders_list__overdue_view": ClockAlert,
    /** Orders list · Scheduled view (chip) */
    "orders_list__scheduled_view": CalendarClock,
    /** Orders list · Collected today view (chip) */
    "orders_list__collected_today_view": Wallet,
    /** Orders list · Unpaid (chip) */
    "orders_list__unpaid": CircleAlert,
    /** Orders list · Export (action) */
    "orders_list__export": Download,
    /** Orders list · More actions (action) */
    "orders_list__more_actions": EllipsisVertical,
    /** Orders list · Open order (action) */
    "orders_list__open_order": ChevronRight,
    /** Orders list · New online booking (chip) */
    "orders_list__new_online_booking": Globe,
    /** Order details · Back (action) */
    "order_details__back": ArrowLeft,
    /** Order details · Edit (action) */
    "order_details__edit": Pencil,
    /** Order details · Print A4 (action) */
    "order_details__print_a4": Printer,
    /** Order details · Print 80 mm (action) */
    "order_details__print_80_mm": ReceiptText,
    /** Order details · PDF bill (action) */
    "order_details__pdf_bill": FileText,
    /** Order details · WhatsApp (action) */
    "order_details__whatsapp": MessageCircle,
    /** Order details · Update status (action) */
    "order_details__update_status": ListChecks,
    /** Order details · More (action) */
    "order_details__more": EllipsisVertical,
    /** Order details · Delete order (action) */
    "order_details__delete_order": Trash2,
    /** Order details · Duplicate (action) */
    "order_details__duplicate": CopyPlus,
    /** Order details · Picked up (shop pickup end) (chip) */
    "order_details__picked_up_shop_pickup_end": ShoppingBag,
    /** Order details · Expected ready (section) */
    "order_details__expected_ready": CalendarClock,
    /** Order details · Items (section) */
    "order_details__items": Shirt,
    /** Order details · Weight (kg) (chip) */
    "order_details__weight_kg": Weight,
    /** Order details · Piece count (chip) */
    "order_details__piece_count": Layers,
    /** Order details · Express (chip) */
    "order_details__express": Zap,
    /** Order details · Item note (chip) */
    "order_details__item_note": StickyNote,
    /** Order details · Discount (section) */
    "order_details__discount": Percent,
    /** Order details · Tax (GST/VAT) (section) */
    "order_details__tax_gst_vat": Landmark,
    /** Order details · Delivery fee (section) */
    "order_details__delivery_fee": Truck,
    /** Order details · Payment card (section) */
    "order_details__payment_card": CreditCard,
    /** Order details · Collect payment (action) */
    "order_details__collect_payment": Wallet,
    /** Order details · Payment history (section) */
    "order_details__payment_history": History,
    /** Order details · Refund (action) */
    "order_details__refund": Undo2,
    /** Order details · Customer (section) */
    "order_details__customer": UserRound,
    /** Order details · Call (action) */
    "order_details__call": Phone,
    /** Order details · Address (section) */
    "order_details__address": MapPin,
    /** Order details · Open in maps (action) */
    "order_details__open_in_maps": Navigation,
    /** Order details · Assigned agent (section) */
    "order_details__assigned_agent": Bike,
    /** Order details · Pickup / delivery slot (section) */
    "order_details__pickup_delivery_slot": Clock,
    /** Order details · Service area (section) */
    "order_details__service_area": MapPinned,
    /** Order details · QR tag (section) */
    "order_details__qr_tag": QrCode,
    /** Order details · Barcode tag (section) */
    "order_details__barcode_tag": Barcode,
    /** Order details · Print tag (action) */
    "order_details__print_tag": Tag,
    /** Order details · Timeline (section) */
    "order_details__timeline": Activity,
    /** Order details · Order notes (section) */
    "order_details__order_notes": StickyNote,
    /** Order details · Damage photos (section) */
    "order_details__damage_photos": Camera,
    /** Order details · Tracking link (action) */
    "order_details__tracking_link": Link,
    /** Order details · Copy (action) */
    "order_details__copy": Copy,
    /** Order details · Share (action) */
    "order_details__share": Share2,
    /** Order details · Created by (chip) */
    "order_details__created_by": UserRound,
    /** New Order (POS) · Checkout · Success · Search items (action) */
    "new_order_pos_checkout_success__search_items": Search,
    /** New Order (POS) · Checkout · Success · Category (chip) */
    "new_order_pos_checkout_success__category": LayoutGrid,
    /** New Order (POS) · Checkout · Success · Service item (tile:sky) */
    "new_order_pos_checkout_success__service_item": Shirt,
    /** New Order (POS) · Checkout · Success · Add (action) */
    "new_order_pos_checkout_success__add": Plus,
    /** New Order (POS) · Checkout · Success · Remove (action) */
    "new_order_pos_checkout_success__remove": Minus,
    /** New Order (POS) · Checkout · Success · Clear (action) */
    "new_order_pos_checkout_success__clear": X,
    /** New Order (POS) · Checkout · Success · Express toggle (chip) */
    "new_order_pos_checkout_success__express_toggle": Zap,
    /** New Order (POS) · Checkout · Success · Edit price (action) */
    "new_order_pos_checkout_success__edit_price": Pencil,
    /** New Order (POS) · Checkout · Success · Edit weight (action) */
    "new_order_pos_checkout_success__edit_weight": Weight,
    /** New Order (POS) · Checkout · Success · Custom item (action) */
    "new_order_pos_checkout_success__custom_item": ListPlus,
    /** New Order (POS) · Checkout · Success · Add customer (action) */
    "new_order_pos_checkout_success__add_customer": UserPlus,
    /** New Order (POS) · Checkout · Success · Walk-in customer (chip) */
    "new_order_pos_checkout_success__walk_in_customer": UserRound,
    /** New Order (POS) · Checkout · Success · Current order (section) */
    "new_order_pos_checkout_success__current_order": ShoppingBag,
    /** New Order (POS) · Checkout · Success · Hold order (action) */
    "new_order_pos_checkout_success__hold_order": CirclePause,
    /** New Order (POS) · Checkout · Success · Clear order (action) */
    "new_order_pos_checkout_success__clear_order": Trash2,
    /** New Order (POS) · Checkout · Success · Checkout (action) */
    "new_order_pos_checkout_success__checkout": ArrowRight,
    /** New Order (POS) · Checkout · Success · Order type · Shop pickup (tile:blue) */
    "new_order_pos_checkout_success__order_type_shop_pickup": Store,
    /** New Order (POS) · Checkout · Success · Order type · Home pickup (tile:blue) */
    "new_order_pos_checkout_success__order_type_home_pickup": Home,
    /** New Order (POS) · Checkout · Success · Order type · Home delivery (tile:blue) */
    "new_order_pos_checkout_success__order_type_home_delivery": Truck,
    /** New Order (POS) · Checkout · Success · Date (section) */
    "new_order_pos_checkout_success__date": CalendarDays,
    /** New Order (POS) · Checkout · Success · Time slot (chip) */
    "new_order_pos_checkout_success__time_slot": Clock,
    /** New Order (POS) · Checkout · Success · Address (section) */
    "new_order_pos_checkout_success__address": MapPin,
    /** New Order (POS) · Checkout · Success · Use my location (action) */
    "new_order_pos_checkout_success__use_my_location": Navigation,
    /** New Order (POS) · Checkout · Success · Notes (section) */
    "new_order_pos_checkout_success__notes": StickyNote,
    /** New Order (POS) · Checkout · Success · Discount (section) */
    "new_order_pos_checkout_success__discount": Percent,
    /** New Order (POS) · Checkout · Success · Pay · Cash (chip) */
    "new_order_pos_checkout_success__pay_cash": Banknote,
    /** New Order (POS) · Checkout · Success · Pay · UPI (chip) */
    "new_order_pos_checkout_success__pay_upi": QrCode,
    /** New Order (POS) · Checkout · Success · Pay · Card (chip) */
    "new_order_pos_checkout_success__pay_card": CreditCard,
    /** New Order (POS) · Checkout · Success · Pay later (chip) */
    "new_order_pos_checkout_success__pay_later": Hourglass,
    /** New Order (POS) · Checkout · Success · Place order (action) */
    "new_order_pos_checkout_success__place_order": Check,
    /** New Order (POS) · Checkout · Success · Order placed (feature) */
    "new_order_pos_checkout_success__order_placed": Check,
    /** New Order (POS) · Checkout · Success · Print receipt (action) */
    "new_order_pos_checkout_success__print_receipt": Printer,
    /** New Order (POS) · Checkout · Success · Print tag (action) */
    "new_order_pos_checkout_success__print_tag": Tag,
    /** New Order (POS) · Checkout · Success · WhatsApp bill (action) */
    "new_order_pos_checkout_success__whatsapp_bill": MessageCircle,
    /** New Order (POS) · Checkout · Success · Copy tracking link (action) */
    "new_order_pos_checkout_success__copy_tracking_link": Link,
    /** New Order (POS) · Checkout · Success · New order (action) */
    "new_order_pos_checkout_success__new_order": PlusCircle,
    /** New Order (POS) · Checkout · Success · View order (action) */
    "new_order_pos_checkout_success__view_order": ArrowRight,
    /** Customers · Add customer (action) */
    "customers__add_customer": UserPlus,
    /** Customers · Search (action) */
    "customers__search": Search,
    /** Customers · With dues (chip) */
    "customers__with_dues": CircleAlert,
    /** Customers · New this month (chip) */
    "customers__new_this_month": Sparkles,
    /** Customers · Inactive (chip) */
    "customers__inactive": Clock,
    /** Customers · Customer (section) */
    "customers__customer": UserRound,
    /** Customers · Phone (action) */
    "customers__phone": Phone,
    /** Customers · Email (action) */
    "customers__email": Mail,
    /** Customers · Address (section) */
    "customers__address": MapPin,
    /** Customers · Orders (chip) */
    "customers__orders": ClipboardList,
    /** Customers · Total spent (chip) */
    "customers__total_spent": Banknote,
    /** Customers · Outstanding (chip) */
    "customers__outstanding": CircleAlert,
    /** Customers · Last order (chip) */
    "customers__last_order": CalendarDays,
    /** Customers · WhatsApp (action) */
    "customers__whatsapp": MessageCircle,
    /** Customers · New order for customer (action) */
    "customers__new_order_for_customer": PlusCircle,
    /** Customers · View (action) */
    "customers__view": ChevronRight,
    /** Customers · Collect dues (action) */
    "customers__collect_dues": Wallet,
    /** Customers · Edit (action) */
    "customers__edit": Pencil,
    /** Customers · Loyalty points (chip) */
    "customers__loyalty_points": Star,
    /** Customers · Preferences (section) */
    "customers__preferences": SlidersHorizontal,
    /** Customers · Notes (section) */
    "customers__notes": StickyNote,
    /** Customers · Send reminder (action) */
    "customers__send_reminder": Send,
    /** Customers · Lifetime value (chip) */
    "customers__lifetime_value": TrendingUp,
    /** Finances & Reports · Net profit (tile:green) */
    "finances_and_reports__net_profit": PiggyBank,
    /** Finances & Reports · Revenue (tile:blue) */
    "finances_and_reports__revenue": BanknoteArrowUp,
    /** Finances & Reports · Collected (tile:green) */
    "finances_and_reports__collected": Wallet,
    /** Finances & Reports · Expenses (tile:orange) */
    "finances_and_reports__expenses": ReceiptText,
    /** Finances & Reports · Outstanding (tile:orange) */
    "finances_and_reports__outstanding": CircleAlert,
    /** Finances & Reports · Orders (tile:violet) */
    "finances_and_reports__orders": ClipboardList,
    /** Finances & Reports · Average order value (tile:sky) */
    "finances_and_reports__average_order_value": Coins,
    /** Finances & Reports · New customers (tile:sky) */
    "finances_and_reports__new_customers": UserPlus,
    /** Finances & Reports · Export PDF (action) */
    "finances_and_reports__export_pdf": FileDown,
    /** Finances & Reports · Period (action) */
    "finances_and_reports__period": CalendarDays,
    /** Finances & Reports · Revenue by day (section) */
    "finances_and_reports__revenue_by_day": ChartColumn,
    /** Finances & Reports · Trend (section) */
    "finances_and_reports__trend": ChartLine,
    /** Finances & Reports · Payment mix (section) */
    "finances_and_reports__payment_mix": ChartPie,
    /** Finances & Reports · Orders by status (section) */
    "finances_and_reports__orders_by_status": Layers,
    /** Finances & Reports · Orders by source (section) */
    "finances_and_reports__orders_by_source": Globe,
    /** Finances & Reports · Top services (section) */
    "finances_and_reports__top_services": Shirt,
    /** Finances & Reports · Peak hours (section) */
    "finances_and_reports__peak_hours": Clock,
    /** Finances & Reports · Staff metrics (section) */
    "finances_and_reports__staff_metrics": UserCog,
    /** Finances & Reports · Attendance summary (section) */
    "finances_and_reports__attendance_summary": CalendarCheck,
    /** Finances & Reports · Method · Cash (chip) */
    "finances_and_reports__method_cash": Banknote,
    /** Finances & Reports · Method · UPI (chip) */
    "finances_and_reports__method_upi": QrCode,
    /** Finances & Reports · Method · Card (chip) */
    "finances_and_reports__method_card": CreditCard,
    /** Finances & Reports · Method · Other (chip) */
    "finances_and_reports__method_other": CircleEllipsis,
    /** Finances & Reports · Quick expense (action) */
    "finances_and_reports__quick_expense": Plus,
    /** Services catalogue · Category (section) */
    "services_catalogue__category": LayoutGrid,
    /** Services catalogue · Add service (action) */
    "services_catalogue__add_service": Plus,
    /** Services catalogue · Import catalogue (action) */
    "services_catalogue__import_catalogue": Download,
    /** Services catalogue · Search (action) */
    "services_catalogue__search": Search,
    /** Services catalogue · Photo (section) */
    "services_catalogue__photo": Image,
    /** Services catalogue · Unit · per piece (chip) */
    "services_catalogue__unit_per_piece": Shirt,
    /** Services catalogue · Unit · per kg (chip) */
    "services_catalogue__unit_per_kg": Weight,
    /** Services catalogue · Unit · per pair (chip) */
    "services_catalogue__unit_per_pair": Footprints,
    /** Services catalogue · Price (section) */
    "services_catalogue__price": Banknote,
    /** Services catalogue · Express surcharge (chip) */
    "services_catalogue__express_surcharge": Zap,
    /** Services catalogue · Active (chip) */
    "services_catalogue__active": Check,
    /** Services catalogue · Edit (action) */
    "services_catalogue__edit": Pencil,
    /** Services catalogue · Duplicate (action) */
    "services_catalogue__duplicate": CopyPlus,
    /** Services catalogue · Delete (action) */
    "services_catalogue__delete": Trash2,
    /** Services catalogue · Drag to reorder (action) */
    "services_catalogue__drag_to_reorder": GripVertical,
    /** Services catalogue · Names in other languages (section) */
    "services_catalogue__names_in_other_languages": Languages,
    /** Services catalogue · Upload photo (action) */
    "services_catalogue__upload_photo": Upload,
    /** Attendance · Date (action) */
    "attendance__date": CalendarDays,
    /** Attendance · Previous / next (action) */
    "attendance__previous_next": ChevronLeft,
    /** Attendance · Day view (chip) */
    "attendance__day_view": CalendarCheck,
    /** Attendance · Month view (chip) */
    "attendance__month_view": Calendar,
    /** Attendance · Mark all present (action) */
    "attendance__mark_all_present": CheckCheck,
    /** Attendance · Present (chip) */
    "attendance__present": CircleCheck,
    /** Attendance · Half day (chip) */
    "attendance__half_day": Contrast,
    /** Attendance · Absent (chip) */
    "attendance__absent": CircleX,
    /** Attendance · Leave (chip) */
    "attendance__leave": CalendarOff,
    /** Attendance · Not marked (chip) */
    "attendance__not_marked": CircleDashed,
    /** Attendance · Note (action) */
    "attendance__note": StickyNote,
    /** Attendance · Check-in time (chip) */
    "attendance__check_in_time": Clock,
    /** Attendance · Flows into payroll (chip) */
    "attendance__flows_into_payroll": HandCoins,
    /** Expenses · Add expense (action) */
    "expenses__add_expense": Plus,
    /** Expenses · Month (action) */
    "expenses__month": CalendarDays,
    /** Expenses · Total expenses (tile:orange) */
    "expenses__total_expenses": ReceiptText,
    /** Expenses · vs last month (chip) */
    "expenses__vs_last_month": TrendingDown,
    /** Expenses · Salaries (from payroll) (chip) */
    "expenses__salaries_from_payroll": HandCoins,
    /** Expenses · Rent (chip) */
    "expenses__rent": Building2,
    /** Expenses · Electricity (chip) */
    "expenses__electricity": Zap,
    /** Expenses · Detergent & supplies (chip) */
    "expenses__detergent_and_supplies": ShoppingCart,
    /** Expenses · Transport (chip) */
    "expenses__transport": Car,
    /** Expenses · Maintenance (chip) */
    "expenses__maintenance": Wrench,
    /** Expenses · Other (chip) */
    "expenses__other": CircleEllipsis,
    /** Expenses · Paid by · Cash (chip) */
    "expenses__paid_by_cash": Banknote,
    /** Expenses · Paid by · UPI (chip) */
    "expenses__paid_by_upi": QrCode,
    /** Expenses · Paid by · Bank (chip) */
    "expenses__paid_by_bank": Landmark,
    /** Expenses · Receipt attached (chip) */
    "expenses__receipt_attached": Paperclip,
    /** Expenses · Receipt photo (action) */
    "expenses__receipt_photo": Camera,
    /** Expenses · By category (section) */
    "expenses__by_category": ChartPie,
    /** Expenses · Monthly trend (section) */
    "expenses__monthly_trend": ChartColumn,
    /** Expenses · Recurring (chip) */
    "expenses__recurring": Repeat,
    /** Payroll · Month (action) */
    "payroll__month": CalendarDays,
    /** Payroll · Add advance (action) */
    "payroll__add_advance": HandCoins,
    /** Payroll · Pay all pending (action) */
    "payroll__pay_all_pending": Banknote,
    /** Payroll · Total payroll (tile:blue) */
    "payroll__total_payroll": IndianRupee,
    /** Payroll · Paid (chip) */
    "payroll__paid": CircleCheck,
    /** Payroll · Pending (chip) */
    "payroll__pending": Clock,
    /** Payroll · Staff (section) */
    "payroll__staff": UserRound,
    /** Payroll · Salary (chip) */
    "payroll__salary": IndianRupee,
    /** Payroll · Present days (chip) */
    "payroll__present_days": CalendarCheck,
    /** Payroll · Advances (chip) */
    "payroll__advances": HandCoins,
    /** Payroll · Deductions (chip) */
    "payroll__deductions": Minus,
    /** Payroll · Net pay (chip) */
    "payroll__net_pay": Wallet,
    /** Payroll · Salary slip (action) */
    "payroll__salary_slip": FileText,
    /** Payroll · Print slip (action) */
    "payroll__print_slip": Printer,
    /** Payroll · Send slip on WhatsApp (action) */
    "payroll__send_slip_on_whatsapp": MessageCircle,
    /** Payroll · Pay (action) */
    "payroll__pay": Banknote,
    /** Staff & Team · Add staff (action) */
    "staff_and_team__add_staff": UserPlus,
    /** Staff & Team · Role · Manager (chip) */
    "staff_and_team__role_manager": Shield,
    /** Staff & Team · Role · Counter staff (chip) */
    "staff_and_team__role_counter_staff": Store,
    /** Staff & Team · Role · Delivery agent (chip) */
    "staff_and_team__role_delivery_agent": Bike,
    /** Staff & Team · Role · Plant (chip) */
    "staff_and_team__role_plant": Factory,
    /** Staff & Team · Present today (chip) */
    "staff_and_team__present_today": CalendarCheck,
    /** Staff & Team · Team logins used (chip) */
    "staff_and_team__team_logins_used": KeyRound,
    /** Staff & Team · On route (chip) */
    "staff_and_team__on_route": Route,
    /** Staff & Team · Login active (chip) */
    "staff_and_team__login_active": BadgeCheck,
    /** Staff & Team · Invite sent (chip) */
    "staff_and_team__invite_sent": Send,
    /** Staff & Team · Create login (action) */
    "staff_and_team__create_login": KeyRound,
    /** Staff & Team · Share invite (action) */
    "staff_and_team__share_invite": Share2,
    /** Staff & Team · Copy message (action) */
    "staff_and_team__copy_message": Copy,
    /** Staff & Team · Team app (section) */
    "staff_and_team__team_app": Smartphone,
    /** Staff & Team · Google Play (action) */
    "staff_and_team__google_play": Download,
    /** Staff & Team · Revoke login (action) */
    "staff_and_team__revoke_login": Ban,
    /** Staff & Team · Delete staff (action) */
    "staff_and_team__delete_staff": Trash2,
    /** Staff & Team · Joined (chip) */
    "staff_and_team__joined": CalendarDays,
    /** Staff & Team · Payroll (chip) */
    "staff_and_team__payroll": HandCoins,
    /** Settings sections · Business profile (section) */
    "settings_sections__business_profile": Store,
    /** Settings sections · Tax & currency (section) */
    "settings_sections__tax_and_currency": Landmark,
    /** Settings sections · Bank & payments (section) */
    "settings_sections__bank_and_payments": CreditCard,
    /** Settings sections · Operations & receipts (section) */
    "settings_sections__operations_and_receipts": Printer,
    /** Settings sections · Delivery & service areas (section) */
    "settings_sections__delivery_and_service_areas": MapPin,
    /** Settings sections · Public booking page (section) */
    "settings_sections__public_booking_page": Globe,
    /** Settings sections · Offers (section) */
    "settings_sections__offers": BadgePercent,
    /** Settings sections · Reminders & notifications (section) */
    "settings_sections__reminders_and_notifications": Bell,
    /** Settings sections · Language (section) */
    "settings_sections__language": Languages,
    /** Settings sections · Subscription (section) */
    "settings_sections__subscription": Crown,
    /** Settings sections · Apps (section) */
    "settings_sections__apps": Smartphone,
    /** Settings sections · Account (section) */
    "settings_sections__account": UserRound,
    /** Settings · inside the panes · Logo upload (action) */
    "settings_inside_the_panes__logo_upload": Image,
    /** Settings · inside the panes · Save changes (action) */
    "settings_inside_the_panes__save_changes": Check,
    /** Settings · inside the panes · Discard (action) */
    "settings_inside_the_panes__discard": X,
    /** Settings · inside the panes · Order number (never lowered) (chip) */
    "settings_inside_the_panes__order_number_never_lowered": Lock,
    /** Settings · inside the panes · Tag style · QR (chip) */
    "settings_inside_the_panes__tag_style_qr": QrCode,
    /** Settings · inside the panes · Tag style · Barcode (chip) */
    "settings_inside_the_panes__tag_style_barcode": Barcode,
    /** Settings · inside the panes · Receipt options (section) */
    "settings_inside_the_panes__receipt_options": Printer,
    /** Settings · inside the panes · UPI ID / scan to pay (section) */
    "settings_inside_the_panes__upi_id_scan_to_pay": QrCode,
    /** Settings · inside the panes · Payment link (section) */
    "settings_inside_the_panes__payment_link": Link,
    /** Settings · inside the panes · Bank details (section) */
    "settings_inside_the_panes__bank_details": Landmark,
    /** Settings · inside the panes · Service areas (section) */
    "settings_inside_the_panes__service_areas": MapPinned,
    /** Settings · inside the panes · Time slots (section) */
    "settings_inside_the_panes__time_slots": Clock,
    /** Settings · inside the panes · Delivery fee (section) */
    "settings_inside_the_panes__delivery_fee": Truck,
    /** Settings · inside the panes · Page template (section) */
    "settings_inside_the_panes__page_template": LayoutTemplate,
    /** Settings · inside the panes · Testimonials (section) */
    "settings_inside_the_panes__testimonials": MessageSquare,
    /** Settings · inside the panes · Offer banner (section) */
    "settings_inside_the_panes__offer_banner": Gift,
    /** Settings · inside the panes · Customer reminders (section) */
    "settings_inside_the_panes__customer_reminders": MessageCircle,
    /** Settings · inside the panes · Alert sound (chip) */
    "settings_inside_the_panes__alert_sound": Volume2,
    /** Settings · inside the panes · Device · browser (section) */
    "settings_inside_the_panes__device_browser": Laptop,
    /** Settings · inside the panes · Device · phone (section) */
    "settings_inside_the_panes__device_phone": Smartphone,
    /** Settings · inside the panes · One device per login (chip) */
    "settings_inside_the_panes__one_device_per_login": ShieldCheck,
    /** Settings · inside the panes · Sign out (action) */
    "settings_inside_the_panes__sign_out": LogOut,
    /** Settings · inside the panes · Sign out of all devices (action) */
    "settings_inside_the_panes__sign_out_of_all_devices": LogOut,
    /** Settings · inside the panes · Delete shop and account (action) */
    "settings_inside_the_panes__delete_shop_and_account": Trash2,
    /** Settings · inside the panes · Danger warning (chip) */
    "settings_inside_the_panes__danger_warning": TriangleAlert,
    /** Settings · inside the panes · Renews on (chip) */
    "settings_inside_the_panes__renews_on": CalendarDays,
    /** Settings · inside the panes · Invoices (section) */
    "settings_inside_the_panes__invoices": FileText,
    /** Settings · inside the panes · Edit profile (action) */
    "settings_inside_the_panes__edit_profile": Pencil,
    /** Help · Apps · Subscription · Help (section) */
    "help_apps_subscription__help": CircleHelp,
    /** Help · Apps · Subscription · Getting started (section) */
    "help_apps_subscription__getting_started": Rocket,
    /** Help · Apps · Subscription · Billing & receipts (section) */
    "help_apps_subscription__billing_and_receipts": ReceiptText,
    /** Help · Apps · Subscription · Orders & tags (section) */
    "help_apps_subscription__orders_and_tags": ClipboardList,
    /** Help · Apps · Subscription · Customers (section) */
    "help_apps_subscription__customers": Users,
    /** Help · Apps · Subscription · Team app (section) */
    "help_apps_subscription__team_app": Smartphone,
    /** Help · Apps · Subscription · Payments & dues (section) */
    "help_apps_subscription__payments_and_dues": CreditCard,
    /** Help · Apps · Subscription · Reports (section) */
    "help_apps_subscription__reports": ChartColumn,
    /** Help · Apps · Subscription · Subscription (section) */
    "help_apps_subscription__subscription": Crown,
    /** Help · Apps · Subscription · FAQ (section) */
    "help_apps_subscription__faq": BookOpen,
    /** Help · Apps · Subscription · Send feedback (action) */
    "help_apps_subscription__send_feedback": MessageSquare,
    /** Help · Apps · Subscription · Contact email (action) */
    "help_apps_subscription__contact_email": Mail,
    /** Help · Apps · Subscription · Owner app (tile:blue) */
    "help_apps_subscription__owner_app": Shirt,
    /** Help · Apps · Subscription · Team app card (tile:blue) */
    "help_apps_subscription__team_app_card": Smartphone,
    /** Help · Apps · Subscription · Web app (section) */
    "help_apps_subscription__web_app": Laptop,
    /** Help · Apps · Subscription · Store download (action) */
    "help_apps_subscription__store_download": Download,
    /** Help · Apps · Subscription · Install QR (section) */
    "help_apps_subscription__install_qr": QrCode,
    /** Help · Apps · Subscription · Open link (action) */
    "help_apps_subscription__open_link": ExternalLink,
    /** Help · Apps · Subscription · Current plan (section) */
    "help_apps_subscription__current_plan": Crown,
    /** Help · Apps · Subscription · Usage (chip) */
    "help_apps_subscription__usage": Users,
    /** Help · Apps · Subscription · Monthly / yearly (action) */
    "help_apps_subscription__monthly_yearly": Repeat,
    /** Help · Apps · Subscription · Currency INR/USD (chip) */
    "help_apps_subscription__currency_inr_usd": Coins,
    /** Help · Apps · Subscription · Included (chip) */
    "help_apps_subscription__included": Check,
    /** Help · Apps · Subscription · Not included (chip) */
    "help_apps_subscription__not_included": Minus,
    /** Help · Apps · Subscription · Popular (chip) */
    "help_apps_subscription__popular": Star,
    /** Help · Apps · Subscription · Upgrade (action) */
    "help_apps_subscription__upgrade": ArrowUpRight,
    /** Help · Apps · Subscription · Cancel plan (action) */
    "help_apps_subscription__cancel_plan": CircleX,
    /** Help · Apps · Subscription · Restore purchases (action) */
    "help_apps_subscription__restore_purchases": RotateCcw,
    /** Public booking & tracking · Shop (section) */
    "public_booking_and_tracking__shop": Store,
    /** Public booking & tracking · Offer banner (chip) */
    "public_booking_and_tracking__offer_banner": Gift,
    /** Public booking & tracking · WhatsApp the shop (action) */
    "public_booking_and_tracking__whatsapp_the_shop": MessageCircle,
    /** Public booking & tracking · Do we deliver to you (section) */
    "public_booking_and_tracking__do_we_deliver_to_you": MapPin,
    /** Public booking & tracking · Area served (chip) */
    "public_booking_and_tracking__area_served": CircleCheck,
    /** Public booking & tracking · Area not served (chip) */
    "public_booking_and_tracking__area_not_served": CircleX,
    /** Public booking & tracking · Services (section) */
    "public_booking_and_tracking__services": Shirt,
    /** Public booking & tracking · Per kg (chip) */
    "public_booking_and_tracking__per_kg": Weight,
    /** Public booking & tracking · Cart (action) */
    "public_booking_and_tracking__cart": ShoppingBag,
    /** Public booking & tracking · Book pickup (action) */
    "public_booking_and_tracking__book_pickup": Truck,
    /** Public booking & tracking · Pickup date (section) */
    "public_booking_and_tracking__pickup_date": CalendarDays,
    /** Public booking & tracking · Time slot (chip) */
    "public_booking_and_tracking__time_slot": Clock,
    /** Public booking & tracking · Address (section) */
    "public_booking_and_tracking__address": MapPin,
    /** Public booking & tracking · Use my location (action) */
    "public_booking_and_tracking__use_my_location": Navigation,
    /** Public booking & tracking · Your name (section) */
    "public_booking_and_tracking__your_name": UserRound,
    /** Public booking & tracking · Phone (section) */
    "public_booking_and_tracking__phone": Phone,
    /** Public booking & tracking · Country (chip) */
    "public_booking_and_tracking__country": Globe,
    /** Public booking & tracking · Notes (section) */
    "public_booking_and_tracking__notes": StickyNote,
    /** Public booking & tracking · Confirm pickup (action) */
    "public_booking_and_tracking__confirm_pickup": Check,
    /** Public booking & tracking · Track your order (feature) */
    "public_booking_and_tracking__track_your_order": PackageSearch,
    /** Public booking & tracking · Order number (section) */
    "public_booking_and_tracking__order_number": Hash,
    /** Public booking & tracking · Phone check (security) (chip) */
    "public_booking_and_tracking__phone_check_security": ShieldCheck,
    /** Public booking & tracking · Expected delivery (section) */
    "public_booking_and_tracking__expected_delivery": CalendarClock,
    /** Public booking & tracking · Balance due (chip) */
    "public_booking_and_tracking__balance_due": CircleAlert,
    /** Public booking & tracking · Scan to pay (section) */
    "public_booking_and_tracking__scan_to_pay": QrCode,
    /** Public booking & tracking · View receipt (action) */
    "public_booking_and_tracking__view_receipt": FileText,
    /** Public booking & tracking · Call shop (action) */
    "public_booking_and_tracking__call_shop": Phone,
    /** Public booking & tracking · Rate your experience (action) */
    "public_booking_and_tracking__rate_your_experience": Star,
    /** Login & shop setup · Email (section) */
    "login_and_shop_setup__email": Mail,
    /** Login & shop setup · Password (section) */
    "login_and_shop_setup__password": Lock,
    /** Login & shop setup · Show password (action) */
    "login_and_shop_setup__show_password": Eye,
    /** Login & shop setup · Hide password (action) */
    "login_and_shop_setup__hide_password": EyeOff,
    /** Login & shop setup · Sign in (action) */
    "login_and_shop_setup__sign_in": LogIn,
    /** Login & shop setup · Mobile number sign-in (action) */
    "login_and_shop_setup__mobile_number_sign_in": Smartphone,
    /** Login & shop setup · OTP code (section) */
    "login_and_shop_setup__otp_code": KeyRound,
    /** Login & shop setup · Resend code (action) */
    "login_and_shop_setup__resend_code": RotateCcw,
    /** Login & shop setup · Create account (action) */
    "login_and_shop_setup__create_account": UserPlus,
    /** Login & shop setup · Country (section) */
    "login_and_shop_setup__country": Globe,
    /** Login & shop setup · Shop name (section) */
    "login_and_shop_setup__shop_name": Store,
    /** Login & shop setup · Phone (section) */
    "login_and_shop_setup__phone": Phone,
    /** Login & shop setup · Location on map (section) */
    "login_and_shop_setup__location_on_map": MapPin,
    /** Login & shop setup · Get location (action) */
    "login_and_shop_setup__get_location": Navigation,
    /** Login & shop setup · Create shop & continue (action) */
    "login_and_shop_setup__create_shop_and_continue": ArrowRight,
    /** Login & shop setup · Setup steps (chip) */
    "login_and_shop_setup__setup_steps": CircleCheck,
    /** Login & shop setup · Team members sign in via Team app (chip) */
    "login_and_shop_setup__team_members_sign_in_via_team_app": Users,
    /** Owner app (mobile) · Tab · Home (nav) */
    "owner_app_mobile__tab_home": Home,
    /** Owner app (mobile) · Tab · Orders (nav) */
    "owner_app_mobile__tab_orders": ClipboardList,
    /** Owner app (mobile) · Tab · Customers (nav) */
    "owner_app_mobile__tab_customers": Users,
    /** Owner app (mobile) · Tab · Finances (nav) */
    "owner_app_mobile__tab_finances": Wallet,
    /** Owner app (mobile) · Tab · Settings (nav) */
    "owner_app_mobile__tab_settings": Settings,
    /** Owner app (mobile) · Scan QR (action) */
    "owner_app_mobile__scan_qr": ScanLine,
    /** Owner app (mobile) · New order (action) */
    "owner_app_mobile__new_order": PlusCircle,
    /** Owner app (mobile) · Collected (chip) */
    "owner_app_mobile__collected": Wallet,
    /** Owner app (mobile) · Outstanding (chip) */
    "owner_app_mobile__outstanding": CircleAlert,
    /** Owner app (mobile) · Orders pending (chip) */
    "owner_app_mobile__orders_pending": Clock,
    /** Owner app (mobile) · Quick · Expenses (tile:orange) */
    "owner_app_mobile__quick_expenses": ReceiptText,
    /** Owner app (mobile) · Quick · Attendance (tile:blue) */
    "owner_app_mobile__quick_attendance": CalendarCheck,
    /** Owner app (mobile) · Deliver order (action) */
    "owner_app_mobile__deliver_order": Truck,
    /** Owner app (mobile) · Start processing (action) */
    "owner_app_mobile__start_processing": WashingMachine,
    /** Owner app (mobile) · Collect (action) */
    "owner_app_mobile__collect": Wallet,
    /** Owner app (mobile) · Message customer (action) */
    "owner_app_mobile__message_customer": MessageCircle,
    /** Owner app (mobile) · Add (FAB) (action) */
    "owner_app_mobile__add_fab": Plus,
    /** Owner app (mobile) · Locked customer (chip) */
    "owner_app_mobile__locked_customer": Lock,
    /** Owner app (mobile) · Item photo (section) */
    "owner_app_mobile__item_photo": Image,
    /** Owner app (mobile) · Torch (action) */
    "owner_app_mobile__torch": Flashlight,
    /** Owner app (mobile) · Report (action) */
    "owner_app_mobile__report": FileText,
    /** Owner app (mobile) · Month picker (action) */
    "owner_app_mobile__month_picker": CalendarDays,
    /** Owner app (mobile) · Estimated net profit (section) */
    "owner_app_mobile__estimated_net_profit": PiggyBank,
    /** Owner app (mobile) · Help (action) */
    "owner_app_mobile__help": CircleHelp,
    /** Team app (Android) · Tab · Route (nav) */
    "team_app_android__tab_route": Route,
    /** Team app (Android) · Tab · Orders (nav) */
    "team_app_android__tab_orders": ClipboardList,
    /** Team app (Android) · Tab · Scan (nav) */
    "team_app_android__tab_scan": ScanLine,
    /** Team app (Android) · Tab · Profile (nav) */
    "team_app_android__tab_profile": UserRound,
    /** Team app (Android) · On route chip (chip) */
    "team_app_android__on_route_chip": Route,
    /** Team app (Android) · Navigate all stops (action) */
    "team_app_android__navigate_all_stops": Navigation,
    /** Team app (Android) · Stop · Pickup (chip) */
    "team_app_android__stop_pickup": Package,
    /** Team app (Android) · Stop · Deliver (chip) */
    "team_app_android__stop_deliver": PackageCheck,
    /** Team app (Android) · Stop · Collect (chip) */
    "team_app_android__stop_collect": Wallet,
    /** Team app (Android) · Call customer (action) */
    "team_app_android__call_customer": Phone,
    /** Team app (Android) · Plant · Inbound (chip) */
    "team_app_android__plant_inbound": Package,
    /** Team app (Android) · Plant · Processing (chip) */
    "team_app_android__plant_processing": WashingMachine,
    /** Team app (Android) · Plant · Ready (chip) */
    "team_app_android__plant_ready": CircleCheck,
    /** Team app (Android) · Add damage photo (action) */
    "team_app_android__add_damage_photo": Camera,
    /** Team app (Android) · Mark ready (action) */
    "team_app_android__mark_ready": CircleCheck,
    /** Team app (Android) · Dispatch (action) */
    "team_app_android__dispatch": Truck,
    /** Team app (Android) · Check-in (chip) */
    "team_app_android__check_in": Clock,
    /** Team app (Android) · Sign out (action) */
    "team_app_android__sign_out": LogOut,
    /** Super admin · Overview (nav) */
    "super_admin__overview": LayoutDashboard,
    /** Super admin · Shops (nav) */
    "super_admin__shops": Store,
    /** Super admin · Subscriptions (nav) */
    "super_admin__subscriptions": CreditCard,
    /** Super admin · Plans (nav) */
    "super_admin__plans": Layers,
    /** Super admin · Default catalogue (nav) */
    "super_admin__default_catalogue": WashingMachine,
    /** Super admin · Platform settings (nav) */
    "super_admin__platform_settings": SlidersHorizontal,
    /** Super admin · Feedback (nav) */
    "super_admin__feedback": MessageSquare,
    /** Super admin · Notifications (nav) */
    "super_admin__notifications": Bell,
    /** Super admin · Super admin chip (chip) */
    "super_admin__super_admin_chip": ShieldAlert,
    /** Super admin · MRR (tile:green) */
    "super_admin__mrr": TrendingUp,
    /** Super admin · Expiring soon (tile:orange) */
    "super_admin__expiring_soon": CalendarClock,
    /** Super admin · Failed payments (tile:orange) */
    "super_admin__failed_payments": CircleX,
    /** Super admin · Orders processed (tile:violet) */
    "super_admin__orders_processed": ClipboardList,
    /** Super admin · Countries (section) */
    "super_admin__countries": Globe,
    /** Super admin · System status (section) */
    "super_admin__system_status": Activity,
    /** Super admin · Recent signups (section) */
    "super_admin__recent_signups": UserPlus,
    /** Super admin · Export CSV (action) */
    "super_admin__export_csv": Download,
    /** Super admin · Change plan (action) */
    "super_admin__change_plan": Repeat,
    /** Super admin · Extend (action) */
    "super_admin__extend": CalendarPlus,
    /** Super admin · Mark expired (action) */
    "super_admin__mark_expired": CalendarX,
    /** Super admin · Suspend shop (action) */
    "super_admin__suspend_shop": Ban,
    /** Super admin · Razorpay plan IDs (section) */
    "super_admin__razorpay_plan_ids": KeyRound,
    /** Super admin · Missing setting (chip) */
    "super_admin__missing_setting": TriangleAlert,
    /** Super admin · Webhook events (section) */
    "super_admin__webhook_events": Webhook,
    /** Super admin · Retry payment (action) */
    "super_admin__retry_payment": RotateCcw,
    /** Super admin · Import CSV (action) */
    "super_admin__import_csv": Upload,
    /** Super admin · Announcement (section) */
    "super_admin__announcement": Megaphone,
    /** Super admin · Maintenance / read-only (section) */
    "super_admin__maintenance_read_only": Wrench,
    /** Super admin · Send push (action) */
    "super_admin__send_push": Send,
    /** Landing page · Brand (tile:blue) */
    "landing_page__brand": Shirt,
    /** Landing page · Countries (feature) */
    "landing_page__countries": Globe,
    /** Landing page · Languages (feature) */
    "landing_page__languages": Languages,
    /** Landing page · One device per login (feature) */
    "landing_page__one_device_per_login": ShieldCheck,
    /** Landing page · Free to start / cloud (feature) */
    "landing_page__free_to_start_cloud": Cloud,
    /** Landing page · Per piece or per kg (feature) */
    "landing_page__per_piece_or_per_kg": Weight,
    /** Landing page · A4 or 80 mm thermal (feature) */
    "landing_page__a4_or_80_mm_thermal": Printer,
    /** Landing page · PDF bill on WhatsApp (feature) */
    "landing_page__pdf_bill_on_whatsapp": MessageCircle,
    /** Landing page · Express, discounts, GST (feature) */
    "landing_page__express_discounts_gst": Zap,
    /** Landing page · Web POS (feature) */
    "landing_page__web_pos": Laptop,
    /** Landing page · Team app (feature) */
    "landing_page__team_app": Smartphone,
} as const satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;

/** Render an icon with the system defaults for its context; any prop can still be overridden. */
export function AppIcon({ icon, context = "action", ...rest }: { icon: LucideIcon; context?: IconContext } & Omit<ComponentProps<LucideIcon>, "ref">) {
    return createElement(icon, { size: ICON_SIZE[context], strokeWidth: context === "chip" ? 2 : ICON_STROKE, ...rest });
}
