import { Router } from "express";
import {
  createDisease,
  getDiseases,
} from "../controllers/disease.controller";
// import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// router.use(authMiddleware);

router.post("/", createDisease);
router.get("/", getDiseases);

export default router;
