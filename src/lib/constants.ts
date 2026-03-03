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
export const CURRENT_PHASE = 1;

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
