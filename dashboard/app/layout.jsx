import "./globals.css";

export const metadata = {
  title: "Capital gains tax analysis dashboard | PolicyEngine",
  description:
    "Interactive dashboard estimating the revenue and distributional effects of equalising UK capital gains tax rates with income tax rates from 2026-27, using PolicyEngine UK microsimulation with CenTax-aligned behavioural responses.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
