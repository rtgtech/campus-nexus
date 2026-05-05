import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const tailwindConfig = `
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          "surface": "#f8f9fb",
          "surface-dim": "#d6d9de",
          "surface-bright": "#ffffff",
          "surface-container-lowest": "#ffffff",
          "surface-container-low": "#f2f1f8",
          "surface-container": "#e9e7f3",
          "surface-container-high": "#dfdced",
          "surface-container-highest": "#d2cfe3",
          "on-surface": "#111317",
          "on-surface-variant": "#4a4f57",
          "inverse-surface": "#171b22",
          "inverse-on-surface": "#f3f4f6",
          "outline": "#777d86",
          "outline-variant": "#c8ccd3",
          "surface-tint": "#221D5C",
          "primary": "#221D5C",
          "on-primary": "#ffffff",
          "primary-container": "#312978",
          "on-primary-container": "#ffffff",
          "inverse-primary": "#a79fe0",
          "secondary": "#EC2024",
          "on-secondary": "#ffffff",
          "secondary-container": "#f45c5f",
          "on-secondary-container": "#ffffff",
          "tertiary": "#191c22",
          "on-tertiary": "#ffffff",
          "tertiary-container": "#2b313a",
          "on-tertiary-container": "#ffffff",
          "error-container": "#ffdad6",
          "error": "#ba1a1a",
          "on-error": "#ffffff",
          "on-error-container": "#93000a",
          "primary-fixed": "#ddd9f4",
          "primary-fixed-dim": "#b3abd9",
          "on-primary-fixed": "#15103e",
          "on-primary-fixed-variant": "#312978",
          "secondary-fixed": "#ffd7d7",
          "secondary-fixed-dim": "#ff9a9c",
          "on-secondary-fixed": "#4d0506",
          "on-secondary-fixed-variant": "#b6171b",
          "tertiary-fixed": "#d4d7dc",
          "tertiary-fixed-dim": "#a8afb9",
          "on-tertiary-fixed": "#0f1115",
          "on-tertiary-fixed-variant": "#2b313a",
          "background": "#f7f6fb",
          "on-background": "#111317",
          "surface-variant": "#e1e4e9"
        },
        borderRadius: {
          DEFAULT: "0.5rem",
          md: "0.75rem",
          lg: "1rem",
          xl: "1.5rem",
          full: "9999px"
        },
        spacing: {
          "base": "8px",
          "xs": "4px",
          "sm": "12px",
          "md": "24px",
          "lg": "40px",
          "xl": "64px",
          "gutter": "16px",
          "container-margin": "20px",
          "container-max": "1280px",
          "margin-desktop": "40px",
          "margin-mobile": "16px",
          "unit": "8px"
        },
        fontFamily: {
          "headline-md": ["Space Grotesk"],
          "display-lg": ["Space Grotesk"],
          "headline-lg": ["Space Grotesk"],
          "body-lg": ["Inter"],
          "body-md": ["Inter"],
          "label-md": ["Space Grotesk"]
        },
        fontSize: {
          "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
          "headline-lg": ["32px", { lineHeight: "1.2", fontWeight: "700" }],
          "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
          "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
          "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
          "label-md": ["14px", { lineHeight: "1.4", fontWeight: "600" }]
        }
      }
    }
  };
`;

export const metadata: Metadata = {
  title: "Campus Nexus",
  description: "Campus Nexus collegiate social hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <Script
          id="tailwind-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: tailwindConfig }}
        />
        <Script
          src="https://cdn.tailwindcss.com?plugins=forms,container-queries"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
