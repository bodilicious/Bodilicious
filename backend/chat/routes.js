import { Router } from "express";
import {
  handleChat,
  logRitualEvent,
  burstLimiter,
  chatLimiter
} from "./controller.js";
import { tryProtect } from "../middleware/auth.js";

const router = Router();

/*
  POST /chat
  - burstLimiter: protects against spam floods
  - chatLimiter: 500 requests/day per IP
*/
router.post(
  "/",
  burstLimiter,
  chatLimiter,
  handleChat
);

router.post(
  "/ritual-event",
  burstLimiter,
  tryProtect,
  logRitualEvent
);

export default router;