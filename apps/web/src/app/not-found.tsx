import Link from "next/link";

export default function NotFound() {
  return (
    <div className="notice" role="alert">
      <div className="notice__title">Page not found</div>
      <div>The page you are looking for does not exist.</div>
      <div>
        <Link href="/">Back to overview</Link>
      </div>
    </div>
  );
}
