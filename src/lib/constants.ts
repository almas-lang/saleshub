// Navigation items — all modules listed from day one
export const NAV_ITEMS = [
  // Group: Overview
  {
    group: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", phase: 1 },
      { name: "Tasks", href: "/tasks", icon: "CheckSquare", phase: 1 },
    ],
  },
  // Group: Sales
  {
    group: "Sales",
    items: [
      { name: "Prospects", href: "/prospects", icon: "Users", phase: 1 },
      { name: "Customers", href: "/customers", icon: "UserCheck", phase: 3 },
      { name: "Funnels", href: "/funnels", icon: "GitBranch", phase: 1 },
    ],
  },
  // Group: Communicate
  {
    group: "Communicate",
    items: [
      { name: "WhatsApp", href: "/whatsapp", icon: "MessageCircle", phase: 2 },
      { name: "Email", href: "/email", icon: "Mail", phase: 2 },
      { name: "Calendar", href: "/calendar", icon: "Calendar", phase: 2 },
    ],
  },
  // Group: Money
  {
    group: "Money",
    items: [
      { name: "Invoices", href: "/invoices", icon: "Receipt", phase: 3 },
      { name: "Finance", href: "/finance", icon: "IndianRupee", phase: 4 },
    ],
  },
  // Group: Insights
  {
    group: "Insights",
    items: [
      { name: "Analytics", href: "/analytics", icon: "BarChart3", phase: 4 },
    ],
  },
] as const;

// Current build phase — increment this as you complete phases
export const CURRENT_PHASE = 4;

// Default funnel stages for VSL flow
export const DEFAULT_VSL_STAGES = [
  { name: "New Lead", order: 1, color: "#94A3B8" },
  { name: "Contacted", order: 2, color: "#60A5FA" },
  { name: "121 Booked", order: 3, color: "#A78BFA" },
  { name: "121 Done", order: 4, color: "#F59E0B" },
  { name: "Proposal Sent", order: 5, color: "#FB923C" },
  { name: "Converted", order: 6, color: "#34D399", isTerminal: true },
  { name: "Lost", order: 7, color: "#EF4444", isTerminal: true },
];

// Default funnel stages for Webinar flow
export const DEFAULT_WEBINAR_STAGES = [
  { name: "Registered", order: 1, color: "#94A3B8" },
  { name: "Attended", order: 2, color: "#60A5FA" },
  { name: "Interested", order: 3, color: "#A78BFA" },
  { name: "Converted", order: 4, color: "#34D399", isTerminal: true },
  { name: "Lost", order: 5, color: "#EF4444", isTerminal: true },
];

// ──────────────────────────────────────────
// Booking Pages
// ──────────────────────────────────────────

export const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

import type { FormField, DaySchedule, AvailabilityRules } from "@/types/bookings";

/** The qualifying questions matching the Calendly form */
export const DEFAULT_BOOKING_FORM_FIELDS: FormField[] = [
  { id: "f1", label: "First Name", type: "text", required: true },
  { id: "f2", label: "Last Name", type: "text", required: true },
  { id: "f3", label: "Email", type: "email", required: true },
  { id: "f4", label: "Whatsapp/Phone number", type: "phone", required: true, defaultValue: "+91" },
  { id: "f5", label: "Share your LinkedIn profile link", type: "text", required: true },
  { id: "f6", label: "Total work experience", type: "radio", required: true, options: ["Fresher", "< 2 years", "3-5 years", "5-10 years", "10+ years"] },
  { id: "f7", label: "What is your current role?", type: "text", required: true },
  { id: "f8", label: "What are the key challenges that you're facing in your career?", type: "radio", required: true, options: ["Currently unemployed and actively looking for new opportunities", "Low Salary or undervalued compared to experience and effort", "Role feels focused on execution rather than strategy or outcomes", "High workload with repetitive or low-impact responsibilities", "Lack of influence in decisions and limited sense of ownership", "Uncertainty about the real business impact of one\u2019s work"] },
  { id: "f9", label: "What is the desired salary you are looking for?", type: "text", required: true },
  { id: "f10", label: "If you\u2019re being 100% honest, what\u2019s stopping you from growing into senior and design leaders and hitting your dream income? The clearer you are, the faster we\u2019ll find answers in our call! (*UX, UI, Product, Visual Designers)", type: "textarea", required: true },
  { id: "f11", label: "Which of these best describes your current financial situation for investing in your career growth?", type: "radio", required: true, options: ["I\u2019m ready to invest in my career and have the financial resources (60k - 90k) to make it happen.", "I\u2019m managing my finances carefully, but I can prioritize funding for my career if it helps me achieve my goals.", "My financial situation is tight, and I\u2019m not in a position to invest right now - I\u2019m okay with staying where I am for now."] },
  { id: "f12", label: "How soon you are ready to start working on improving your career challenges?", type: "radio", required: true, options: ["Right now: Let\u2019s get started - I\u2019m all in!", "Within 90 days: I need a little time to prepare first.", "More than 90 days: It\u2019s on my list, but not urgent."] },
];

/** Mon–Fri 10:00–18:00 IST */
export const DEFAULT_AVAILABILITY_RULES: AvailabilityRules = {
  timezone: "Asia/Kolkata",
  schedule: Array.from({ length: 7 }, (_, i): DaySchedule => ({
    day: i,
    enabled: i >= 1 && i <= 5, // Mon–Fri
    start_time: "10:00",
    end_time: "18:00",
  })),
  buffer_minutes: 15,
  max_per_day: 5,
  blocked_dates: [],
  assignment_mode: "round_robin",
};
