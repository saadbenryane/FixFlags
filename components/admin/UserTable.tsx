"use client";

import { adminDate } from "@/lib/admin/format";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/components/admin/AdminTable";

interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  role: string;
  auditsUsed: number;
  auditsLimit: number;
  createdAt: Date | string;
  totalCostLabel: string;
}

const planColors: Record<string, string> = {
  FREE: "bg-muted text-muted-foreground",
  BUILDER: "bg-grade-B/15 text-grade-B border-grade-B/25",
  TEAM: "bg-brand/10 text-brand border-brand/25",
};

function formatLimit(limit: number): string {
  return limit === -1 ? "Unlimited" : String(limit);
}

export function UserTable({
  users,
  emptyMessage = "No users yet.",
}: {
  users: User[];
  emptyMessage?: string;
}) {
  return (
    <AdminTable isEmpty={users.length === 0} emptyMessage={emptyMessage}>
      <AdminTableHead>
        <AdminTableHeaderCell>Email</AdminTableHeaderCell>
        <AdminTableHeaderCell>Plan</AdminTableHeaderCell>
        <AdminTableHeaderCell>Checks</AdminTableHeaderCell>
        <AdminTableHeaderCell>Est. cost</AdminTableHeaderCell>
        <AdminTableHeaderCell>Joined</AdminTableHeaderCell>
        <AdminTableHeaderCell />
      </AdminTableHead>
      <tbody>
        {users.map((user, i) => (
          <AdminTableRow key={user.id} index={i}>
            <AdminTableCell>
              <div className="font-medium truncate max-w-[200px]">
                {user.email}
              </div>
              {user.name && (
                <div className="text-xs text-muted-foreground">{user.name}</div>
              )}
              {user.role === "admin" && (
                <Badge className="text-xs mt-1" variant="destructive">
                  Admin
                </Badge>
              )}
            </AdminTableCell>
            <AdminTableCell>
              <Badge className={cn("text-xs", planColors[user.plan] ?? "")}>
                {user.plan}
              </Badge>
            </AdminTableCell>
            <AdminTableCell className="text-muted-foreground">
              {user.auditsUsed} / {formatLimit(user.auditsLimit)}
            </AdminTableCell>
            <AdminTableCell className="text-muted-foreground">
              {user.totalCostLabel}
            </AdminTableCell>
            <AdminTableCell className="text-xs text-muted-foreground">
              {adminDate(user.createdAt)}
            </AdminTableCell>
            <AdminTableCell>
              <Link
                href={`/admin/users/${user.id}`}
                className="text-sm underline"
              >
                Manage customer
              </Link>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  );
}
