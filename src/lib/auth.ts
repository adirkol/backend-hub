import { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    EmailProvider({
      server: {}, // Not used, we use Resend directly
      from: process.env.EMAIL_FROM || "noreply@example.com",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";
        console.log(`[Auth] Sending magic link to ${email} from ${fromEmail}`);
        
        try {
          const result = await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "Sign in to AI Backend Hub",
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0b; padding: 40px 20px;">
                    <tr>
                      <td align="center">
                        <table width="100%" style="max-width: 480px; background: linear-gradient(135deg, #18181b 0%, #0f0f10 100%); border-radius: 16px; border: 1px solid rgba(63, 63, 70, 0.5); overflow: hidden;">
                          <tr>
                            <td style="padding: 40px 32px; text-align: center;">
                              <!-- Logo -->
                              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%); border-radius: 12px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                                <span style="color: #0a0a0b; font-size: 24px; font-weight: bold;">⚡</span>
                              </div>
                              
                              <h1 style="margin: 0 0 8px; color: #fafafa; font-size: 24px; font-weight: 600;">
                                AI Backend Hub
                              </h1>
                              
                              <p style="margin: 0 0 32px; color: #71717a; font-size: 15px;">
                                Click the button below to sign in to your admin account
                              </p>
                              
                              <!-- Button -->
                              <a href="${url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #00f0ff 0%, #00b8cc 100%); color: #000; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(0, 240, 255, 0.3);">
                                Sign in to Admin Panel
                              </a>
                              
                              <p style="margin: 32px 0 0; color: #71717a; font-size: 13px;">
                                This link expires in 24 hours and can only be used once.
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 20px 32px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(63, 63, 70, 0.3);">
                              <p style="margin: 0; color: #71717a; font-size: 12px; text-align: center;">
                                If you didn't request this email, you can safely ignore it.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
              </html>
            `,
          });
          console.log(`[Auth] Email sent successfully:`, result);
        } catch (error) {
          console.error("[Auth] Failed to send verification email:", error);
          throw new Error("Failed to send verification email");
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/login",
    verifyRequest: "/auth/verify",
    error: "/auth/login",
  },
  callbacks: {
    async signIn({ user }) {
      // Only allow admin users to sign in
      if (!user.email) return false;
      
      const adminUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      
      return !!adminUser;
    },
    async jwt({ token, user }) {
      // On first sign in, add user data to the token
      if (user) {
        token.id = user.id;
        
        const adminUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        
        if (adminUser) {
          token.role = adminUser.role;
          token.name = adminUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "SUPER_ADMIN";
        session.user.name = token.name as string | null;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

