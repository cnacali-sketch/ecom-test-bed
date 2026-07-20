"use client";

import { AdminApp } from "@/components/admin/AdminApp";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminApp />
    </RequireAuth>
  );
}
