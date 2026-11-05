import { Router } from "express";
import {
    searchPlacesController,
    getPlaceByIdController,
    createPlaceController
} from "./places.controller";

const router = Router();

router.get("/search", searchPlacesController);
router.get("/:placeId", getPlaceByIdController);
router.post("/", createPlaceController);

export default router;
