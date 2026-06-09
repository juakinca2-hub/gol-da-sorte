import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import paymentsRouter from "./payments";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/payments", paymentsRouter);
router.use("/settings", settingsRouter);

export default router;
