import "./globals.css";
export const metadata = {
  title: "Course Studio API",
  description: "Online Course Service backend",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
