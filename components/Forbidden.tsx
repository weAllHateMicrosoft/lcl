export default function Forbidden({ need }: { need: string }) {
  return (
    <div className="main">
      <h1>{need} view</h1>
      <div className="notice">
        You're currently acting as a different role. Use the <b>“acting as”</b> switcher in the top-right to become an{" "}
        <b>{need}</b>, then this page will load.
      </div>
    </div>
  );
}
