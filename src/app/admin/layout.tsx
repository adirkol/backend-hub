import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div 
      style={{ 
        height: '100vh', 
        display: 'flex',
        overflow: 'hidden', // Prevent body scroll
        background: `
          radial-gradient(ellipse 50% 30% at 0% 0%, rgba(16, 185, 129, 0.04), transparent),
          radial-gradient(ellipse 40% 25% at 100% 100%, rgba(99, 102, 241, 0.03), transparent),
          #09090b
        `
      }}
    >
      {/* Sidebar - fixed height, no scroll */}
      <AdminSidebar user={session.user} />
      
      {/* Main content - this is the scrollable area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <AdminHeader user={session.user} />
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ padding: '32px', maxWidth: '1600px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
