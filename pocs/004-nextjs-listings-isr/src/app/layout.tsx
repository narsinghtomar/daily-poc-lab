import type { ReactNode } from "react";

export const metadata = { title: "Listings", description: "Property listings demo" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem auto", maxWidth: 720 }}>
        {children}
      </body>
    </html>
  );
}
