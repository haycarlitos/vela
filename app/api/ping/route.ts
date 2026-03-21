export async function GET() {
  return Response.json({ ping: "pong", method: "GET", time: new Date().toISOString() });
}

export async function POST() {
  return Response.json({ ping: "pong", method: "POST", time: new Date().toISOString() });
}
