import {Router} from 'express';
import {  registerController,  loginUserController,  logoutUserController, sendVerificationTokenController,  verifyEmailController, sendPasswordResetTokenController, resetPasswordController } from './auth.controller';

const router = Router();

router.post('/register', registerController);
router.post('/login', loginUserController);
router.post('/logout', logoutUserController);
router.post('/send-verification-token', sendVerificationTokenController);
router.post('/verify-email', verifyEmailController);
router.post('/forgot-password', sendPasswordResetTokenController);
router.post('/reset-password', resetPasswordController);

export default router;
