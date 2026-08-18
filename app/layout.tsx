import type { Metadata } from "next";
import { Suspense } from "react";
import { CreatePostRoute } from "@/components/create-post-route";
import { ExternalLinkGuard } from "@/components/external-link-guard";
import "material-symbols/outlined.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Nexus",
  description: "Campus Nexus collegiate social hub",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light font-sans">
      <body>
        {children}
        {modal}
        <Suspense fallback={null}>
          <CreatePostRoute />
        </Suspense>
        <ExternalLinkGuard />
      </body>
    </html>
  );
}
