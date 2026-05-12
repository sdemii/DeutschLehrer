export const metadata = {
  title: "Deutschlehrer — Your Personal German Teacher",
  description: "TELC-aligned German lessons covering all 4 skills with AI feedback",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
