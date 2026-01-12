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
          radial-gradient(ellipse 60% 40% at 0% 0%, rgba(0, 240, 255, 0.03), transparent),
          radial-gradient(ellipse 50% 35% at 100% 100%, rgba(170, 85, 255, 0.03), transparent),
          radial-gradient(ellipse 40% 30% at 50% 50%, rgba(0, 255, 136, 0.02), transparent),
          linear-gradient(135deg, #0a0a0f 0%, #0f0f18 50%, #0a0a12 100%)
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
