import { PRIORITY_LABEL, STATUS_LABEL, type TicketPriority, type TicketStatus } from "@/lib/constants";

const statusCls: Record<TicketStatus, string> = {
  TODO: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-800",
};
const priorityCls: Record<TicketPriority, string> = {
  LOW: "bg-sky-100 text-sky-800",
  MEDIUM: "bg-violet-100 text-violet-800",
  HIGH: "bg-rose-100 text-rose-800",
};
const base = "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

export const StatusBadge = ({ status }: { status: TicketStatus }) => (
  <span className={`${base} ${statusCls[status]}`}>{STATUS_LABEL[status]}</span>
);
export const PriorityBadge = ({ priority }: { priority: TicketPriority }) => (
  <span className={`${base} ${priorityCls[priority]}`}>{PRIORITY_LABEL[priority]}</span>
);
