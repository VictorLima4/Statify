import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import spotifyRouter from "./spotify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(spotifyRouter);

export default router;
