import "./globals.css";

export const metadata = {
  title: "Scan Struk AI",
  description: "Foto struk, catatan keuangan otomatis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
