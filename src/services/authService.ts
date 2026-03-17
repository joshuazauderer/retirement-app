import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

export class AuthServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export const authService = {
  async signup(input: SignupInput) {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) {
      throw new AuthServiceError(
        parsed.error.issues[0].message,
        "VALIDATION_ERROR"
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      throw new AuthServiceError(
        "An account with this email already exists",
        "EMAIL_EXISTS"
      );
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  },

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        household: {
          select: {
            id: true,
            name: true,
            filingStatus: true,
            stateOfResidence: true,
            planningMode: true,
            members: true,
          },
        },
      },
    });
  },

  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
      },
    });
  },
};
