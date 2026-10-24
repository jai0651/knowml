import type { Metadata } from "next";
import { AdminScripts } from "./admin-client";
import "./admin.css";

export const metadata: Metadata = {
  title: "Stats",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="pg-admin">
      <div className="ad-wrap">
        {/* admin.js owns everything inside #root */}
        <div id="root" suppressHydrationWarning />
      </div>
      <AdminScripts />
    </div>
  );
}
