import session from "express-session";
import createMemoryStore from "memorystore";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export interface SessionUser {
  id: string;
  phoneNumber: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

export function setupAuth(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const MemoryStore = createMemoryStore(session);

  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "smartcart-dev-secret",
      store: new MemoryStore({ checkPeriod: sessionTtl }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        maxAge: sessionTtl,
      },
    })
  );
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).sessionUser = req.session.user;
  next();
};
