export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui",
        maxWidth: 720,
        margin: "80px auto",
        padding: 24,
      }}
    >
      <h1>Course Studio API</h1>
      <p>Online Course Service · Next.js + MongoDB</p>
      <p>
        The API is running. Open the React frontend to sign in and manage your
        courses.
      </p>
      <p>Protected endpoints: /api/course · /api/user · /api/auth/me</p>
    </main>
  );
}
