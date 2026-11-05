import { Router } from "express";
import {
    savePlaceController,
    getUserSavedPlacesController,
    updateSavedPlaceController,
    deleteSavedPlaceController
} from "./saved-place.controller";

const router = Router();

router.post("/", savePlaceController);
router.get("/", getUserSavedPlacesController);
router.patch("/:savedPlaceId", updateSavedPlaceController);
router.delete("/:savedPlaceId", deleteSavedPlaceController);

export default router;
