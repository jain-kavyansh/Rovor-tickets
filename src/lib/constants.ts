export const TICKET_STATUSES = ["TODO", "ACTIVE", "DONE"] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  TODO: "Todo",
  ACTIVE: "In Progress",
  DONE: "Done",
};
export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const LIMITS = {
  projectName: 100,
  projectDescription: 1000,
  ticketTitle: 200,
  ticketDescription: 5000,
  search: 100,
} as const;
