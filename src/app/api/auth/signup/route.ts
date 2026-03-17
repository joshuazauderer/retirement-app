import { NextRequest, NextResponse } from "next/server";
import { authService, AuthServiceError } from "@/services/authService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await authService.signup(body);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
