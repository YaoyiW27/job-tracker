import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight access gate. When APP_PASSWORD is set (e.g. on the Vercel
// deployment) every request needs HTTP Basic auth with that password; any
// username works. When it's unset (local dev), the app is open. This keeps the
// single-user app private on a public URL without a full auth system.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const provided = decoded.slice(decoded.indexOf(":") + 1);
      if (provided === password) return NextResponse.next();
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Job Tracker", charset="UTF-8"' },
  });
}

// Protect everything except Next's static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
