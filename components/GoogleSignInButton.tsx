// "Sign in with Google" — a plain link to the student SSO start route.
export default function GoogleSignInButton({ label = "Sign in with Google" }: { label?: string }) {
  return (
    <a className="gsignin" href="/api/auth/google/student">
      <span className="gicon">G</span> {label}
    </a>
  );
}
