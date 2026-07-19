export default function Forbidden({ need }: { need: string }) {
  return (
    <div className="main">
      <div className="crumb">ACCESS</div>
      <h1 className="title" style={{ fontSize: 26 }}>{need} area</h1>
      <div className="notice">
        Your account doesn't have <b>{need}</b> access. Sign out (top right) and sign in with a {need.toLowerCase()} account.
      </div>
    </div>
  );
}
